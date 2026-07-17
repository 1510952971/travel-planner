/**
 * 摄影装备库 · 重量 · 电池 Wh · 简易合规提示
 */
(function (global) {
  "use strict";

  const DEFAULT_GEAR = [
    { id: "g1", name: "全画幅机身", cat: "机身", weight: 700, wh: 16, qty: 1 },
    { id: "g2", name: "24-70mm f/2.8", cat: "镜头", weight: 900, wh: 0, qty: 1 },
    { id: "g3", name: "70-200mm f/2.8", cat: "镜头", weight: 1500, wh: 0, qty: 1 },
    { id: "g4", name: "碳纤维三脚架", cat: "支撑", weight: 1400, wh: 0, qty: 1 },
    { id: "g5", name: "备用电池 x2", cat: "电源", weight: 160, wh: 32, qty: 1 },
    { id: "g6", name: "充电宝 20000mAh", cat: "电源", weight: 340, wh: 74, qty: 1 },
    { id: "g7", name: "无人机", cat: "航拍", weight: 900, wh: 43, qty: 1 },
    { id: "g8", name: "ND/CPL 滤镜组", cat: "滤镜", weight: 200, wh: 0, qty: 1 },
  ];

  function summarize(selectedGear) {
    let weight = 0;
    let wh = 0;
    let hasDrone = false;
    (selectedGear || []).forEach((g) => {
      if (!g.on) return;
      const q = Number(g.qty) || 1;
      weight += (Number(g.weight) || 0) * q;
      wh += (Number(g.wh) || 0) * q;
      if (g.cat === "航拍" || /无人机|drone/i.test(g.name || "")) hasDrone = true;
    });
    return { weightG: weight, weightKg: weight / 1000, wh, hasDrone };
  }

  // 全画幅等效 FOV 对角线估算（简化）
  function fovHorizontal(focalMm, sensor) {
    // sensor: full / apsc / m43
    const crop = sensor === "apsc" ? 1.5 : sensor === "m43" ? 2 : 1;
    const eff = (Number(focalMm) || 50) * crop;
    // 全画幅宽 36mm
    const width = 36;
    const fov = (2 * Math.atan(width / 2 / eff) * 180) / Math.PI;
    return { effFocal: eff, fovDeg: fov };
  }

  const AIRLINE_PRESETS = {
    generic: {
      label: "通用国际（参考）",
      handWh: 100,
      approveWh: 160,
      note: "多数航司：≤100Wh 常见可自带；100–160Wh 或需批准；>160Wh 多不允许。",
    },
    ca: {
      label: "国航/南航类（参考）",
      handWh: 100,
      approveWh: 160,
      note: "国内三大航常见：锂电池手提；以值机柜台最新规定为准。",
    },
    ana: {
      label: "日航/全日空类（参考）",
      handWh: 100,
      approveWh: 160,
      note: "日本航司对移动电池申报较严，建议英文/日文页核对。",
    },
    budget: {
      label: "廉航保守（参考）",
      handWh: 100,
      approveWh: 100,
      note: "廉航政策多变，建议按 ≤100Wh、备用电池单独包装。",
    },
  };

  function complianceNotes(totalWh, hasDrone, dest, airlineKey) {
    const preset = AIRLINE_PRESETS[airlineKey] || AIRLINE_PRESETS.generic;
    const notes = [];
    notes.push({ level: "ok", text: "航司模板：" + preset.label + " — " + preset.note });
    if (totalWh > 0 && totalWh <= preset.handWh) {
      notes.push({
        level: "ok",
        text: `电池合计约 ${totalWh.toFixed(0)} Wh ≤ ${preset.handWh}Wh 参考自带线`,
      });
    } else if (totalWh > preset.handWh && totalWh <= preset.approveWh) {
      notes.push({
        level: "warn",
        text: `合计约 ${totalWh.toFixed(0)} Wh，处于参考「需航司同意」区间（${preset.handWh}–${preset.approveWh}Wh）`,
      });
    } else if (totalWh > preset.approveWh) {
      notes.push({
        level: "bad",
        text: `合计约 ${totalWh.toFixed(0)} Wh，可能超过本模板上限 ${preset.approveWh}Wh`,
      });
    }
    if (hasDrone) {
      notes.push({
        level: "warn",
        text:
          "已勾选无人机：请查目的地禁飞/实名（日本户外、城市核心、自然保护区常限制）。本提示非法律意见。",
      });
      if (/北京|上海|香港|故宫|机场/.test(dest || "")) {
        notes.push({
          level: "bad",
          text: "目的地关键词显示可能高管控区域，起飞前务必查官方通告。",
        });
      }
    }
    notes.push({
      level: "ok",
      text: "锂电池通常禁止托运、需随身携带；具体以航司与国家海关最新规定为准。",
    });
    return notes;
  }

  global.TravelGear = {
    DEFAULT_GEAR,
    AIRLINE_PRESETS,
    complianceNotes,
    summarize,
    fovHorizontal,
  };
})(typeof window !== "undefined" ? window : globalThis);
