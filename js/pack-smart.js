/**
 * 按天气 / 偏好生成行李建议（纯本地规则）
 */
(function (global) {
  "use strict";

  function analyzeWeather(days) {
    const flags = {
      rain: false,
      cold: false,
      hot: false,
      snow: false,
      storm: false,
    };
    if (!days || !days.length) return flags;
    days.forEach((d) => {
      const code = Number(d.code);
      const tMax = Number(d.tMax);
      const tMin = Number(d.tMin);
      const rain = Number(d.rain);
      if (rain >= 40 || (code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
        flags.rain = true;
      }
      if (code >= 71 && code <= 77) flags.snow = true;
      if (code >= 95) flags.storm = true;
      if (!Number.isNaN(tMax) && tMax >= 30) flags.hot = true;
      if (!Number.isNaN(tMin) && tMin <= 10) flags.cold = true;
    });
    return flags;
  }

  function suggestionsFromWeather(flags, style) {
    const items = [];
    const add = (name, cat, reason) => items.push({ name, cat, reason });

    if (flags.rain || flags.storm) {
      add("折叠伞", "日用", "有雨/阵雨概率");
      add("防水鞋套或防水外套", "衣物", "防雨");
    }
    if (flags.storm) add("薄冲锋衣", "衣物", "雷雨天气");
    if (flags.snow || flags.cold) {
      add("保暖内衣 / 毛衣", "衣物", "低温");
      add("手套与围巾", "衣物", "保暖");
      add("防滑鞋", "衣物", "湿滑或低温");
    }
    if (flags.hot) {
      add("防晒霜 SPF50", "日用", "高温暴晒");
      add("遮阳帽 / 墨镜", "日用", "防晒");
      add("清凉短袖替换", "衣物", "炎热");
      add("补水喷雾或水杯", "日用", "补水");
    }
    if (!flags.hot && !flags.cold) {
      add("薄外套", "衣物", "温差备用");
    }

    if (style === "photo") {
      add("移动电源（大容量）", "数码", "拍照耗电");
      add("镜头布 / 备用存储卡", "数码", "拍照向");
    }
    if (style === "family") {
      add("儿童零食与湿巾", "日用", "亲子");
      add("创可贴与退热贴", "健康", "亲子出行");
    }
    if (style === "rush") {
      add("压缩袜 / 舒适跑鞋", "衣物", "特种兵多走路");
      add("能量棒", "日用", "高强度日程");
    }
    if (style === "food") {
      add("肠胃药 / 消化酶", "健康", "美食向");
    }

    // 去重
    const seen = new Set();
    return items.filter((it) => {
      if (seen.has(it.name)) return false;
      seen.add(it.name);
      return true;
    });
  }

  global.TravelPackSmart = {
    analyzeWeather,
    suggestionsFromWeather,
  };
})(typeof window !== "undefined" ? window : globalThis);
