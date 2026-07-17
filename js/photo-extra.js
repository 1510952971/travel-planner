/**
 * 摄影扩展：云量/能见度、搭子板、治安提示
 */
(function (global) {
  "use strict";

  async function fetchPhotoAtmosphere(lat, lng, dateStr) {
    if (lat == null || lng == null || !dateStr) return null;
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&hourly=cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,visibility` +
      `&timezone=auto&start_date=${dateStr}&end_date=${dateStr}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.hourly || !data.hourly.time) return null;
      const rows = data.hourly.time.map((time, i) => ({
        time,
        hour: Number(time.slice(11, 13)),
        cloud: data.hourly.cloud_cover[i],
        low: data.hourly.cloud_cover_low ? data.hourly.cloud_cover_low[i] : null,
        mid: data.hourly.cloud_cover_mid ? data.hourly.cloud_cover_mid[i] : null,
        high: data.hourly.cloud_cover_high ? data.hourly.cloud_cover_high[i] : null,
        vis: data.hourly.visibility ? data.hourly.visibility[i] : null,
      }));
      // 日落窗口摘要：16–20 点
      const evening = rows.filter((r) => r.hour >= 16 && r.hour <= 20);
      const avg = (arr, key) => {
        const v = arr.map((x) => x[key]).filter((n) => n != null);
        if (!v.length) return null;
        return Math.round(v.reduce((a, b) => a + b, 0) / v.length);
      };
      return {
        rows,
        evening: {
          cloud: avg(evening, "cloud"),
          high: avg(evening, "high"),
          mid: avg(evening, "mid"),
          low: avg(evening, "low"),
          vis: avg(evening, "vis"),
        },
      };
    } catch (_) {
      return null;
    }
  }

  function fireCloudHint(evening) {
    if (!evening || evening.high == null) return "暂无云量数据";
    if (evening.high >= 40 && evening.high <= 80 && (evening.low == null || evening.low < 50)) {
      return "中高云适中，有一定火烧云潜力（非保证）";
    }
    if (evening.cloud != null && evening.cloud < 20) return "云量偏低，天空干净，适合清晰轮廓/银河前期";
    if (evening.cloud != null && evening.cloud > 85) return "云量偏高，火烧云与星空概率都偏低";
    return "云量普通，建议到场灵活调整";
  }

  function lightPollutionHint(dest) {
    const d = dest || "";
    if (/东京|大阪|上海|北京|香港|台北|成都|纽约|巴黎|伦敦/.test(d)) {
      return { level: "high", text: "都市核心光污染偏高，银河难度大；夜景/灯火更合适" };
    }
    if (/京都|厦门|杭州|郊外|沙漠|高原|海边/.test(d)) {
      return { level: "mid", text: "中等光污染可能，郊野方向更有星空机会" };
    }
    return { level: "unknown", text: "光污染需结合具体机位判断，远离城区灯光" };
  }

  /** 示意性治安提示（非实时数据，仅教育性提醒） */
  function safetyHints(dest, hourMin) {
    const list = [];
    const night = hourMin != null && (hourMin >= 22 * 60 || hourMin < 5 * 60);
    list.push({
      level: "ok",
      text: "器材贵重：少露商标、分背包、不把全部机身镜头放同一外袋。",
    });
    if (night) {
      list.push({
        level: "warn",
        text: "夜间拍摄：尽量结伴、选有人流量的灯火机位，避免偏僻巷弄久留。",
      });
    }
    if (/巴黎|巴塞|罗马|里约|约翰内斯堡/.test(dest || "")) {
      list.push({
        level: "warn",
        text: "部分旅游城市有飞车党/扒窃高发报道，地铁与景点入口提高警惕（提示非官方统计）。",
      });
    }
    if (/东京|大阪|京都|新加坡|香港/.test(dest || "")) {
      list.push({
        level: "ok",
        text: "整体治安口碑较好，仍需防偷拍器材与遗忘物品。",
      });
    }
    list.push({
      level: "ok",
      text: "本层为通用安全提示，不构成真实热力图；出行请以当地官方信息为准。",
    });
    return list;
  }

  const BUDDY_KEY = "travel_buddy_board_v1";

  function loadBuddies() {
    try {
      return JSON.parse(localStorage.getItem(BUDDY_KEY) || "[]");
    } catch (_) {
      return [];
    }
  }

  function saveBuddies(list) {
    localStorage.setItem(BUDDY_KEY, JSON.stringify(list));
  }

  function matchBuddies(city, start, end, role) {
    const all = loadBuddies();
    return all.filter((b) => {
      if (role && b.role === role) return false; // 推荐互补角色
      if (city && b.city && b.city !== city && !b.city.includes(city) && !city.includes(b.city)) {
        return false;
      }
      if (!start || !end || !b.start || !b.end) return true;
      return !(b.end < start || b.start > end);
    });
  }

  global.TravelPhotoExtra = {
    fetchPhotoAtmosphere,
    fireCloudHint,
    lightPollutionHint,
    safetyHints,
    loadBuddies,
    saveBuddies,
    matchBuddies,
  };
})(typeof window !== "undefined" ? window : globalThis);
