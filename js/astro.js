/**
 * 日出日落 / 黄金时刻 / 蓝调时刻（纯本地天文近似，无商业 API）
 * 算法：简化 NOAA 太阳位置
 */
(function (global) {
  "use strict";

  function toJulian(date) {
    return date.getTime() / 86400000 + 2440587.5;
  }

  function solarEvents(lat, lng, dateStr) {
    // dateStr: YYYY-MM-DD，按本地日理解；计算用 UTC 正午近似
    const d = new Date(dateStr + "T12:00:00");
    if (Number.isNaN(d.getTime())) return null;

    const rad = Math.PI / 180;
    const dayMs = 86400000;
    // 一年中的日序
    const start = new Date(d.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((d - start) / dayMs);

    const lngHour = lng / 15;
    // 日出/日落近似（公式）
    function calc(isRise) {
      const t = dayOfYear + ((isRise ? 6 : 18) - lngHour) / 24;
      const M = 0.9856 * t - 3.289;
      let L =
        M +
        1.916 * Math.sin(M * rad) +
        0.02 * Math.sin(2 * M * rad) +
        282.634;
      L = ((L % 360) + 360) % 360;
      let RA = (Math.atan(0.91764 * Math.tan(L * rad)) / rad + 360) % 360;
      const Lq = Math.floor(L / 90) * 90;
      const RAq = Math.floor(RA / 90) * 90;
      RA = RA + (Lq - RAq);
      RA /= 15;
      const sinDec = 0.39782 * Math.sin(L * rad);
      const cosDec = Math.cos(Math.asin(sinDec));
      const cosH =
        (Math.cos(90.833 * rad) - sinDec * Math.sin(lat * rad)) /
        (cosDec * Math.cos(lat * rad));
      if (cosH > 1 || cosH < -1) return null; // 极昼极夜
      let H = isRise
        ? 360 - (Math.acos(cosH) / rad)
        : Math.acos(cosH) / rad;
      H /= 15;
      const T = H + RA - 0.06571 * t - 6.622;
      let UT = ((T - lngHour) % 24 + 24) % 24;
      // 转本地：用系统时区偏移
      const local = new Date(dateStr + "T00:00:00");
      const utcMs =
        Date.UTC(
          local.getFullYear(),
          local.getMonth(),
          local.getDate(),
          Math.floor(UT),
          Math.round((UT % 1) * 60)
        );
      // 上面 UT 已是“近似本地”混用，改为直接按偏移构造
      const hours = Math.floor(UT);
      const mins = Math.round((UT - hours) * 60);
      const out = new Date(dateStr + "T00:00:00");
      // 使用本地午夜 + UT 与时区差校正
      const offsetMin = -out.getTimezoneOffset();
      const totalMin = hours * 60 + mins + offsetMin;
      // 简化：把 UT 当本地太阳时再减经度修正已在 lngHour
      // 实际：用浏览器本地时区显示
      const result = new Date(dateStr + "T12:00:00");
      result.setHours(0, 0, 0, 0);
      // 重新：以 UTC 公式结果 + getTimezoneOffset
      const utcDate = new Date(Date.UTC(
        Number(dateStr.slice(0, 4)),
        Number(dateStr.slice(5, 7)) - 1,
        Number(dateStr.slice(8, 10)),
        hours,
        mins
      ));
      return utcDate;
    }

    // 更稳健：使用 midday 迭代简化版 sunrise-sunset
    const events = approxSunTimes(lat, lng, dateStr);
    if (!events) return null;

    const { sunrise, sunset } = events;
    // 黄金时刻：日出后 1h、日落前 1h
    const goldenMorningEnd = new Date(sunrise.getTime() + 60 * 60000);
    const goldenEveningStart = new Date(sunset.getTime() - 60 * 60000);
    // 蓝调：日出前 30m～日出，日落后～+30m
    const blueMorningStart = new Date(sunrise.getTime() - 30 * 60000);
    const blueEveningEnd = new Date(sunset.getTime() + 30 * 60000);

    return {
      date: dateStr,
      sunrise,
      sunset,
      golden: [
        { start: sunrise, end: goldenMorningEnd, name: "晨间黄金" },
        { start: goldenEveningStart, end: sunset, name: "傍晚黄金" },
      ],
      blue: [
        { start: blueMorningStart, end: sunrise, name: "晨间蓝调" },
        { start: sunset, end: blueEveningEnd, name: "傍晚蓝调" },
      ],
    };
  }

  function approxSunTimes(lat, lng, dateStr) {
    // 基于日序的均时差近似
    const date = new Date(dateStr + "T12:00:00Z");
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    // 儒略日
    const A = Math.floor((14 - m) / 12);
    const yy = y + 4800 - A;
    const mm = m + 12 * A - 3;
    const JDN =
      day +
      Math.floor((153 * mm + 2) / 5) +
      365 * yy +
      Math.floor(yy / 4) -
      Math.floor(yy / 100) +
      Math.floor(yy / 400) -
      32045;
    const n = JDN - 2451545.0 + 0.0008;
    const Jstar = n - lng / 360;
    const M = (357.5291 + 0.98560028 * Jstar) % 360;
    const Mrad = (M * Math.PI) / 180;
    const C =
      1.9148 * Math.sin(Mrad) +
      0.02 * Math.sin(2 * Mrad) +
      0.0003 * Math.sin(3 * Mrad);
    const lambda = (M + C + 180 + 102.9372) % 360;
    const Jtransit = 2451545.0 + Jstar + 0.0053 * Math.sin(Mrad) - 0.0069 * Math.sin((2 * lambda * Math.PI) / 180);
    const sinDec = Math.sin((lambda * Math.PI) / 180) * Math.sin((23.44 * Math.PI) / 180);
    const cosDec = Math.cos(Math.asin(sinDec));
    const cosOmega =
      (Math.sin((-0.83 * Math.PI) / 180) - Math.sin((lat * Math.PI) / 180) * sinDec) /
      (Math.cos((lat * Math.PI) / 180) * cosDec);
    if (cosOmega > 1 || cosOmega < -1) return null;
    const omega = (Math.acos(cosOmega) * 180) / Math.PI;
    const Jrise = Jtransit - omega / 360;
    const Jset = Jtransit + omega / 360;
    function jdToDate(jd) {
      return new Date((jd - 2440587.5) * 86400000);
    }
    return { sunrise: jdToDate(Jrise), sunset: jdToDate(Jset) };
  }

  function fmtHM(date) {
    if (!date || Number.isNaN(date.getTime())) return "—";
    return (
      String(date.getHours()).padStart(2, "0") +
      ":" +
      String(date.getMinutes()).padStart(2, "0")
    );
  }

  function toMinutes(date) {
    return date.getHours() * 60 + date.getMinutes();
  }

  function parseHM(hm) {
    if (!hm || !String(hm).includes(":")) return null;
    const [h, m] = String(hm).split(":").map(Number);
    if (Number.isNaN(h)) return null;
    return h * 60 + (m || 0);
  }

  function minutesToHM(mins) {
    mins = ((mins % (24 * 60)) + 24 * 60) % (24 * 60);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  }

  /** 将时间吸附到最近的黄金/蓝调窗口中心（阈值分钟） */
  function snapToMagicHour(hm, events, thresholdMin) {
    const t = parseHM(hm);
    if (t == null || !events) return { hm, snapped: false, label: "" };
    const thr = thresholdMin == null ? 20 : thresholdMin;
    const targets = [];
    events.golden.forEach((g) => {
      const mid = (toMinutes(g.start) + toMinutes(g.end)) / 2;
      targets.push({ min: mid, label: g.name });
    });
    events.blue.forEach((g) => {
      const mid = (toMinutes(g.start) + toMinutes(g.end)) / 2;
      targets.push({ min: mid, label: g.name });
    });
    let best = null;
    let bestD = Infinity;
    targets.forEach((tg) => {
      const d = Math.abs(tg.min - t);
      if (d < bestD) {
        bestD = d;
        best = tg;
      }
    });
    if (best && bestD <= thr) {
      return { hm: minutesToHM(Math.round(best.min)), snapped: true, label: best.label };
    }
    return { hm, snapped: false, label: "" };
  }

  function bandStyleForMinute(min, events) {
    if (!events) return "day";
    const inRange = (a, b) => {
      const s = toMinutes(a);
      const e = toMinutes(b);
      if (s <= e) return min >= s && min < e;
      return min >= s || min < e;
    };
    for (const g of events.blue) {
      if (inRange(g.start, g.end)) return "blue";
    }
    for (const g of events.golden) {
      if (inRange(g.start, g.end)) return "golden";
    }
    const sr = toMinutes(events.sunrise);
    const ss = toMinutes(events.sunset);
    if (min < sr - 30 || min > ss + 30) return "night";
    if (min < sr || min > ss) return "twilight";
    if (min >= 10 * 60 && min <= 15 * 60) return "noon";
    return "day";
  }

  /**
   * 北半球银河核心可见季（简化规则，非精确天文软件）
   * 大致 5–9 月较好；纬度越高季节窗口越短
   */
  function galaxySeasonTip(lat, month /*1-12*/) {
    const absLat = Math.abs(lat || 35);
    const m = month || new Date().getMonth() + 1;
    if (absLat > 55) {
      return {
        level: "low",
        text: "高纬度地区银河核心季节短、地平高度低，难度大，需极暗场地与长曝光经验。",
      };
    }
    if (m >= 5 && m <= 9) {
      return {
        level: "good",
        text: "约 5–9 月北半球常见银河核心季（简化）。选无月、低光污染郊野，午夜前后较佳。",
      };
    }
    if (m === 4 || m === 10) {
      return {
        level: "mid",
        text: "肩季：偶有可拍窗口，需盯天气与月相，核心高度一般一般。",
      };
    }
    return {
      level: "low",
      text: "当前月份银河核心季偏弱/不适（简化规则）。可改拍城市夜景、星轨或月景。",
    };
  }

  global.TravelAstro = {
    solarEvents,
    fmtHM,
    snapToMagicHour,
    bandStyleForMinute,
    parseHM,
    minutesToHM,
    toMinutes,
    galaxySeasonTip,
  };
})(typeof window !== "undefined" ? window : globalThis);
