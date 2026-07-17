/**
 * 免费地理工具：距离、同日路线优化、天气（Open-Meteo，无商业 Key）
 */
(function (global) {
  "use strict";

  function haversineKm(a, b) {
    if (!a || !b) return 0;
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b[0] - a[0]);
    const dLng = toRad(b[1] - a[1]);
    const lat1 = toRad(a[0]);
    const lat2 = toRad(b[0]);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function pathLengthKm(points) {
    let s = 0;
    for (let i = 1; i < points.length; i++) s += haversineKm(points[i - 1], points[i]);
    return s;
  }

  /** 最近邻近似（同日站点重排，减少回头路） */
  function nearestNeighborOrder(items, getPoint) {
    if (!items || items.length <= 2) return items ? items.slice() : [];
    const remaining = items.map((it, i) => ({ it, i, p: getPoint(it, i) }));
    const withPt = remaining.filter((x) => x.p);
    const without = remaining.filter((x) => !x.p).map((x) => x.it);
    if (withPt.length <= 1) return items.slice();

    // 从「最靠西/北」的点出发（较稳定）
    withPt.sort((a, b) => a.p[1] - b.p[1] || a.p[0] - b.p[0]);
    const ordered = [];
    let cur = withPt.shift();
    ordered.push(cur);
    while (withPt.length) {
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < withPt.length; i++) {
        const d = haversineKm(cur.p, withPt[i].p);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      cur = withPt.splice(best, 1)[0];
      ordered.push(cur);
    }
    return ordered.map((x) => x.it).concat(without);
  }

  /** 按间隔分钟重排时间字段 */
  function retimeActivities(activities, startHHMM, gapMin) {
    const start = startHHMM || "09:00";
    const gap = gapMin || 90;
    const [sh, sm] = start.split(":").map(Number);
    let mins = sh * 60 + sm;
    return (activities || []).map((a) => {
      const hh = String(Math.floor(mins / 60) % 24).padStart(2, "0");
      const mm = String(mins % 60).padStart(2, "0");
      const next = Object.assign({}, a, { time: hh + ":" + mm });
      mins += gap;
      return next;
    });
  }

  async function fetchWeather(lat, lng, startDate, endDate) {
    if (lat == null || lng == null) return null;
    const start = startDate || new Date().toISOString().slice(0, 10);
    let end = endDate || start;
    // Open-Meteo forecast 通常约 16 天
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&timezone=auto&start_date=${start}&end_date=${end}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.daily || !data.daily.time) return null;
      const days = data.daily.time.map((date, i) => ({
        date,
        code: data.daily.weathercode[i],
        tMax: data.daily.temperature_2m_max[i],
        tMin: data.daily.temperature_2m_min[i],
        rain: data.daily.precipitation_probability_max
          ? data.daily.precipitation_probability_max[i]
          : null,
        label: weatherLabel(data.daily.weathercode[i]),
      }));
      return { days, lat, lng };
    } catch (_) {
      return null;
    }
  }

  function weatherLabel(code) {
    const c = Number(code);
    if (c === 0) return "晴";
    if (c <= 3) return "多云";
    if (c <= 48) return "雾";
    if (c <= 57) return "毛毛雨";
    if (c <= 67) return "雨";
    if (c <= 77) return "雪";
    if (c <= 82) return "阵雨";
    if (c <= 86) return "阵雪";
    if (c >= 95) return "雷雨";
    return "天气";
  }

  function weatherEmoji(code) {
    const c = Number(code);
    if (c === 0) return "☀️";
    if (c <= 3) return "⛅";
    if (c <= 48) return "🌫️";
    if (c <= 67) return "🌧️";
    if (c <= 77) return "❄️";
    if (c >= 95) return "⛈️";
    return "🌤️";
  }

  global.TravelGeo = {
    haversineKm,
    pathLengthKm,
    nearestNeighborOrder,
    retimeActivities,
    fetchWeather,
    weatherLabel,
    weatherEmoji,
  };
})(typeof window !== "undefined" ? window : globalThis);
