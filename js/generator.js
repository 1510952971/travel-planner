/**
 * 智能行程规则引擎（P0：本地模板，不依赖外部 API）
 * 后续可替换为 AI / 景点 API 结果，接口保持 generateItinerary(...)
 */
(function (global) {
  "use strict";

  /** 目的地 POI 库：按风格标签过滤 */
  const DEST_DB = {
    东京: [
      { place: "浅草寺 · 雷门", tags: ["photo", "balanced", "family", "deep"], area: "浅草", note: "经典打卡，建议早到" },
      { place: "晴空塔", tags: ["photo", "balanced", "family", "rush"], area: "押上", note: "可预约观景" },
      { place: "秋叶原电器街", tags: ["rush", "balanced", "food"], area: "秋叶原", note: "动漫/数码" },
      { place: "明治神宫", tags: ["deep", "family", "balanced", "photo"], area: "原宿", note: "安静漫步" },
      { place: "涩谷十字路口", tags: ["photo", "rush", "balanced"], area: "涩谷", note: "傍晚氛围好" },
      { place: "新宿御苑", tags: ["deep", "family", "photo"], area: "新宿", note: "需门票，节奏慢" },
      { place: "筑地外卖市场", tags: ["food", "balanced", "rush"], area: "筑地", note: "海鲜早餐" },
      { place: "队道拉面 / 一兰", tags: ["food", "rush", "balanced"], area: "多处", note: "排队预留时间" },
      { place: "上野公园 · 博物馆", tags: ["family", "deep", "balanced"], area: "上野", note: "亲子友好" },
      { place: "台场海滨", tags: ["family", "photo", "balanced"], area: "台场", note: "夜景" },
      { place: "吉祥寺三鹰之森", tags: ["deep", "photo", "family"], area: "三鹰", note: "需预约" },
      { place: "中目黑散步", tags: ["deep", "photo", "food"], area: "中目黑", note: "咖啡与河畔" },
    ],
    京都: [
      { place: "伏见稻荷大社", tags: ["photo", "rush", "balanced", "deep"], area: "伏见", note: "千本鸟居" },
      { place: "清水寺", tags: ["photo", "balanced", "family", "rush"], area: "东山", note: "与二年坂连走" },
      { place: "二年坂 · 三年坂", tags: ["photo", "food", "family"], area: "东山", note: "小吃与和服" },
      { place: "岚山竹林", tags: ["photo", "deep", "family"], area: "岚山", note: "半日游" },
      { place: "金阁寺", tags: ["photo", "balanced", "rush", "deep"], area: "北区", note: "经典" },
      { place: "祇园夜巷", tags: ["deep", "photo", "food"], area: "祇园", note: "傍晚散步" },
      { place: "锦市场", tags: ["food", "balanced", "family", "rush"], area: "市中心", note: "美食街" },
      { place: "南禅寺 · 水路阁", tags: ["deep", "photo"], area: "左京", note: "安静" },
      { place: "宇治平等院", tags: ["deep", "family", "photo"], area: "宇治", note: "可品茶" },
      { place: "咖啡 / 抹茶甜品", tags: ["food", "deep", "photo"], area: "多处", note: "下午茶" },
    ],
    大阪: [
      { place: "大阪城公园", tags: ["photo", "balanced", "family", "rush"], area: "中央区", note: "天守阁" },
      { place: "道顿堀 · 心斋桥", tags: ["food", "photo", "rush", "balanced"], area: "难波", note: "晚上更热闹" },
      { place: "通天阁 · 新世界", tags: ["food", "photo", "balanced"], area: "新世界", note: "串炸" },
      { place: "海游馆", tags: ["family", "balanced"], area: "天保山", note: "亲子" },
      { place: "环球影城 USJ", tags: ["family", "rush", "photo"], area: "此花", note: "建议单独一天" },
      { place: "黑门市场", tags: ["food", "rush", "balanced"], area: "日本桥", note: "海鲜" },
      { place: "中之岛公会堂外景", tags: ["photo", "deep"], area: "中之岛", note: "建筑拍照" },
    ],
    上海: [
      { place: "外滩夜景", tags: ["photo", "balanced", "family", "rush"], area: "黄浦", note: "夜景必去" },
      { place: "豫园 · 城隍庙", tags: ["food", "family", "balanced", "photo"], area: "黄浦", note: "小吃" },
      { place: "田子坊", tags: ["photo", "deep", "food"], area: "黄浦", note: "巷弄" },
      { place: "武康路 · 安福路", tags: ["photo", "deep", "food"], area: "徐汇", note: "咖啡街拍" },
      { place: "迪士尼乐园", tags: ["family", "rush", "photo"], area: "浦东", note: "建议单独一天" },
      { place: "陆家嘴 · 东方明珠外", tags: ["photo", "rush", "balanced"], area: "浦东", note: "天际线" },
      { place: "南京西路 · 静安寺", tags: ["shopping", "balanced", "rush"], area: "静安", note: "购物" },
      { place: "本帮菜 / 小笼包", tags: ["food", "balanced", "family"], area: "多处", note: "美食" },
    ],
    北京: [
      { place: "故宫博物院", tags: ["deep", "balanced", "photo", "family", "rush"], area: "东城", note: "需预约" },
      { place: "天安门广场", tags: ["photo", "balanced", "rush", "family"], area: "东城", note: "安检预留" },
      { place: "长城（八达岭/慕田峪）", tags: ["photo", "rush", "family", "deep"], area: "郊区", note: "建议单独一天" },
      { place: "颐和园", tags: ["deep", "family", "photo", "balanced"], area: "海淀", note: "半日+" },
      { place: "南锣鼓巷 · 什刹海", tags: ["food", "photo", "balanced"], area: "西城", note: "傍晚" },
      { place: "798 艺术区", tags: ["photo", "deep"], area: "朝阳", note: "艺术拍照" },
      { place: "烤鸭 · 炸酱面", tags: ["food", "balanced", "family"], area: "多处", note: "美食" },
      { place: "天坛公园", tags: ["family", "deep", "balanced"], area: "东城", note: "晨练氛围" },
    ],
    成都: [
      { place: "大熊猫繁育研究基地", tags: ["family", "photo", "balanced", "rush"], area: "成华", note: "早去看活跃" },
      { place: "宽窄巷子", tags: ["photo", "food", "balanced", "family"], area: "青羊", note: "人多" },
      { place: "锦里", tags: ["food", "photo", "family", "balanced"], area: "武侯", note: "夜景" },
      { place: "武侯祠", tags: ["deep", "balanced"], area: "武侯", note: "文化" },
      { place: "春熙路 · 太古里", tags: ["photo", "rush", "balanced"], area: "锦江", note: "逛街" },
      { place: "火锅 / 串串", tags: ["food", "balanced", "rush", "family"], area: "多处", note: "预留肠胃" },
      { place: "都江堰 / 青城山", tags: ["deep", "photo", "family"], area: "郊区", note: "可一日游" },
    ],
    杭州: [
      { place: "西湖断桥 · 白堤", tags: ["photo", "family", "balanced", "deep"], area: "西湖", note: "经典" },
      { place: "雷峰塔外景", tags: ["photo", "balanced"], area: "西湖", note: "可登塔" },
      { place: "河坊街", tags: ["food", "family", "balanced"], area: "上城", note: "小吃" },
      { place: "灵隐寺", tags: ["deep", "balanced"], area: "西湖西", note: "半日" },
      { place: "宋城（可选）", tags: ["family", "rush"], area: "之江", note: "演出" },
      { place: "龙井问茶", tags: ["deep", "food", "photo"], area: "龙井", note: "慢节奏" },
    ],
    厦门: [
      { place: "鼓浪屿", tags: ["photo", "family", "deep", "balanced", "food"], area: "鼓浪屿", note: "建议一天" },
      { place: "中山路步行街", tags: ["food", "balanced", "rush"], area: "思明", note: "夜市" },
      { place: "曾厝垵", tags: ["food", "photo", "balanced"], area: "思明", note: "文艺小吃" },
      { place: "环岛路骑行", tags: ["photo", "family", "deep"], area: "环岛", note: "海边" },
      { place: "南普陀寺", tags: ["deep", "balanced"], area: "思明", note: "文化" },
      { place: "沙茶面 · 海鲜", tags: ["food", "balanced", "family"], area: "多处", note: "本地味" },
    ],
    香港: [
      { place: "维港夜景 · 天星小轮", tags: ["photo", "balanced", "family", "rush"], area: "维港", note: "夜景" },
      { place: "太平山顶", tags: ["photo", "family", "balanced"], area: "中环", note: "缆车/巴士" },
      { place: "旺角 · 女人街", tags: ["rush", "balanced", "food"], area: "旺角", note: "逛街" },
      { place: "尖沙咀海滨", tags: ["photo", "food", "balanced"], area: "九龙", note: "散步" },
      { place: "茶餐厅 · 点心", tags: ["food", "family", "balanced"], area: "多处", note: "美食" },
      { place: "迪士尼 / 海洋公园", tags: ["family", "rush", "photo"], area: "大屿山等", note: "择一" },
    ],
    台北: [
      { place: "台北 101 外景", tags: ["photo", "balanced", "rush", "family"], area: "信义", note: "可登楼" },
      { place: "九份老街", tags: ["photo", "food", "deep", "balanced"], area: "瑞芳", note: "半日+ " },
      { place: "士林夜市", tags: ["food", "rush", "family", "balanced"], area: "士林", note: "晚上" },
      { place: "中正纪念堂", tags: ["photo", "balanced", "family"], area: "中正", note: "礼仪时间" },
      { place: "猫空缆车", tags: ["photo", "deep", "family"], area: "文山", note: "天气好去" },
      { place: "牛肉面 · 小吃", tags: ["food", "balanced"], area: "多处", note: "美食" },
    ],
  };

  const GENERIC = [
    { place: "老城区步行", tags: ["deep", "photo", "balanced", "family"], area: "市中心", note: "感受街区" },
    { place: "地标观景点", tags: ["photo", "rush", "balanced"], area: "地标", note: "拍照" },
    { place: "当地市场 / 夜市", tags: ["food", "family", "balanced", "rush"], area: "市集", note: "小吃" },
    { place: "博物馆 / 美术馆", tags: ["deep", "family", "balanced"], area: "文化区", note: "可休息" },
    { place: "公园绿地", tags: ["family", "deep", "photo"], area: "公园", note: "放松" },
    { place: "特色餐厅", tags: ["food", "balanced", "deep"], area: "餐厅", note: "提前查评价" },
    { place: "咖啡店休息", tags: ["deep", "photo", "food"], area: "街区", note: "缓冲节奏" },
    { place: "夜景观光", tags: ["photo", "rush", "balanced"], area: "夜景", note: "晚饭后" },
    { place: "手信店采购", tags: ["rush", "balanced", "family"], area: "商业区", note: "伴手礼" },
    { place: "近郊半日游", tags: ["deep", "photo", "family"], area: "近郊", note: "视体力" },
  ];

  const STYLE_META = {
    balanced: { label: "均衡游", perDay: 4, start: "09:30", gap: 120 },
    deep: { label: "深度游", perDay: 3, start: "10:00", gap: 150 },
    rush: { label: "特种兵", perDay: 6, start: "08:00", gap: 75 },
    family: { label: "亲子", perDay: 3, start: "09:00", gap: 140 },
    food: { label: "美食向", perDay: 4, start: "10:00", gap: 120 },
    photo: { label: "拍照打卡", perDay: 5, start: "08:30", gap: 90 },
  };

  function normalizeDest(name) {
    const n = (name || "").trim();
    if (!n) return "";
    // 多城路径不要整段归一
    if (/[,，、\/|→～~]|->|到|至/.test(n) || /\s[→\-]\s/.test(n)) {
      return n;
    }
    // 省·市 规范标签（避免同名城）
    if (global.TravelCityCatalog && global.TravelCityCatalog.normalizeLabel) {
      const lab = global.TravelCityCatalog.normalizeLabel(n);
      if (lab) return lab;
    }
    if (DEST_DB[n]) return n;
    for (const key of Object.keys(DEST_DB)) {
      if (n === key) return key;
      if (n.length <= 8 && (n.includes(key) || key.includes(n))) return key;
    }
    return n;
  }

  /** POI 池：支持「浙江·金华」→ 金华 / 上海 */
  function pickPool(destKey) {
    const raw = destKey || "";
    if (DEST_DB[raw]) return DEST_DB[raw].slice();
    const short =
      (global.TravelCityCatalog && global.TravelCityCatalog.cityKey
        ? global.TravelCityCatalog.cityKey(raw)
        : raw) || raw;
    if (DEST_DB[short]) return DEST_DB[short].slice();
    // 旧数据仅市名
    for (const key of Object.keys(DEST_DB)) {
      if (raw.includes(key) || short === key) return DEST_DB[key].slice();
    }
    return GENERIC.slice();
  }

  function filterByStyle(pool, style) {
    const s = style || "balanced";
    let filtered = pool.filter((p) => (p.tags || []).includes(s) || (p.tags || []).includes("balanced"));
    if (filtered.length < 3) filtered = pool.slice();
    return filtered;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function addMinutes(hhmm, mins) {
    const [h, m] = hhmm.split(":").map(Number);
    let t = h * 60 + m + mins;
    t = ((t % (24 * 60)) + 24 * 60) % (24 * 60);
    const nh = String(Math.floor(t / 60)).padStart(2, "0");
    const nm = String(t % 60).padStart(2, "0");
    return nh + ":" + nm;
  }

  function fmtDate(d) {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${mo}-${day}`;
  }

  /** 解析多城市：数组 / 「东京→京都」/ 「东京,大阪」 */
  function parseDestinations(opts) {
    let list = [];
    if (Array.isArray(opts.destinations) && opts.destinations.length) {
      list = opts.destinations.slice();
    } else if (opts.destination) {
      // 不用空白作分隔，避免「New York」被拆；箭头/逗号/到 等才拆
      list = String(opts.destination)
        .split(/\s*[,，、\/|→～~]\s*|\s*->\s*|\s*到\s*|\s*至\s*/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    // 归一为「省·市」；保留重复途经
    list = list
      .map((c) => {
        const n = (c || "").trim();
        if (!n) return "";
        return normalizeDest(n) || n;
      })
      .filter(Boolean);
    if (!list.length) list = [""];
    return list;
  }

  /** 将总天数按城市分配（至少 1 天/城；城数 > 天数时截断城市） */
  function allocateDaysToCities(totalDays, cities) {
    let cs = cities.slice();
    if (cs.length > totalDays) cs = cs.slice(0, totalDays);
    const m = cs.length;
    const base = Math.floor(totalDays / m);
    let rem = totalDays % m;
    const plan = [];
    cs.forEach((city, i) => {
      let n = base + (rem > 0 ? 1 : 0);
      if (rem > 0) rem--;
      if (n < 1) n = 1;
      for (let k = 0; k < n; k++) plan.push({ city, cityDay: k + 1, cityDays: n });
    });
    // 修正长度
    while (plan.length > totalDays) plan.pop();
    while (plan.length < totalDays) {
      const last = plan[plan.length - 1] || { city: cs[cs.length - 1], cityDay: 1, cityDays: 1 };
      plan.push({
        city: last.city,
        cityDay: last.cityDay + 1,
        cityDays: last.cityDays + 1,
      });
    }
    return plan;
  }

  function buildDayActivities(pool, style, meta, cursorStart, isTransferIn, fromCity) {
    const activities = [];
    let time = meta.start;
    let cursor = cursorStart;
    if (isTransferIn && fromCity) {
      activities.push({
        time: "09:00",
        place: `城际移动：${fromCity} → 抵达`,
        note: "高铁/自驾/大巴 · 预留行李与接驳",
      });
      time = "11:00";
    }
    const count = meta.perDay;
    for (let k = 0; k < count; k++) {
      const poi = pool[cursor % pool.length];
      cursor++;
      activities.push({
        time,
        place: poi.place,
        note: [poi.area, poi.note].filter(Boolean).join(" · "),
      });
      if (style === "food" && k === 1) {
        time = addMinutes(time, 90);
        activities.push({
          time,
          place: "特色餐厅 / 小吃街",
          note: "正餐，预留排队",
        });
      }
      time = addMinutes(time, meta.gap);
    }
    if (style === "rush" && !isTransferIn) {
      activities.unshift({ time: "07:30", place: "酒店出发 / 交通", note: "预留通勤" });
    }
    if (style === "family") {
      activities.push({ time: "15:30", place: "休息 / 回酒店", note: "避免过累" });
    }
    return { activities, cursor };
  }

  /**
   * @param {{
   *   destination?: string,
   *   destinations?: string[],
   *   days: number,
   *   style: string,
   *   startDate?: string,
   *   routeMode?: 'linear'|'loop'
   * }} opts
   */
  function generateItinerary(opts) {
    const days = Math.max(1, Math.min(30, Number(opts.days) || 3));
    const style = opts.style || "balanced";
    const meta = STYLE_META[style] || STYLE_META.balanced;
    const routeMode = opts.routeMode === "loop" ? "loop" : "linear";
    let cities = parseDestinations(opts).filter(Boolean);

    // 环线：若终点不是起点，自动补回首城（已手写回途经城的不会再补）
    // 例：上海→金华→义乌→金华 可完整保留；上海→金华→义乌 + 环线 → 补上海
    if (routeMode === "loop" && cities.length >= 2) {
      const first = cities[0];
      if (cities[cities.length - 1] !== first) {
        cities = cities.concat([first]);
      }
    }

    const dayPlan = allocateDaysToCities(days, cities);
    // 路径站序（可含重复途经）；unique 仅用于 POI 池
    const routeStops = cities.slice();
    const uniqueCities = [];
    routeStops.forEach((c) => {
      if (c && !uniqueCities.includes(c)) uniqueCities.push(c);
    });

    // 每城独立 POI 池与游标
    const pools = {};
    const cursors = {};
    uniqueCities.forEach((c) => {
      const pool = shuffle(filterByStyle(pickPool(c), style));
      pool.sort((a, b) => String(a.area).localeCompare(String(b.area), "zh"));
      pools[c] = pool.length ? pool : pickPool("");
      cursors[c] = 0;
    });

    let start = opts.startDate ? new Date(opts.startDate + "T00:00:00") : new Date();
    if (Number.isNaN(start.getTime())) start = new Date();

    const resultDays = [];
    let prevCity = null;
    for (let i = 0; i < dayPlan.length; i++) {
      const { city } = dayPlan[i];
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const isTransferIn = prevCity && prevCity !== city;
      const pool = pools[city] || pickPool("");
      const built = buildDayActivities(
        pool,
        style,
        meta,
        cursors[city] || 0,
        isTransferIn,
        prevCity
      );
      cursors[city] = built.cursor;

      // 环线最后一天且回到首站：加返程注记
      if (
        routeMode === "loop" &&
        i === dayPlan.length - 1 &&
        routeStops.length >= 2 &&
        city === routeStops[0]
      ) {
        built.activities.push({
          time: "18:00",
          place: "环线收官 / 返程准备",
          note: "回到起点城市 · 可安排轻松活动或晚餐",
        });
      }

      resultDays.push({
        date: fmtDate(d),
        city: city || "",
        title: `D${i + 1} · ${city || "行程"}（${meta.label}）`,
        activities: built.activities,
      });
      prevCity = city;
    }

    const end = new Date(start);
    end.setDate(end.getDate() + days - 1);

    // 标题/路径保留完整站序（含二次途经）
    const pathLabel = routeStops.filter(Boolean).join(" → ") || "旅行";
    const multi = routeStops.filter(Boolean).length > 1;
    const hasRevisit = uniqueCities.length < routeStops.filter(Boolean).length;
    const budgetSeed = seedBudget(style, days, multi);
    const packSeed = seedPack(style);
    const titlePath =
      routeStops.length > 4
        ? routeStops[0] + " → … → " + routeStops[routeStops.length - 1]
        : pathLabel;

    return {
      title: `${titlePath}${days}日 · ${meta.label}${
        routeMode === "loop" && multi
          ? " · 环线"
          : hasRevisit
            ? " · 往返途经"
            : multi
              ? " · 多城"
              : ""
      }`,
      destination: pathLabel,
      destinations: routeStops.filter(Boolean),
      routeMode,
      startDate: fmtDate(start),
      endDate: fmtDate(end),
      style,
      summary: multi
        ? `多站行程：${pathLabel}，共 ${days} 天（${
            routeMode === "loop" ? "环线" : "线性"
          }${hasRevisit ? "，含重复途经" : ""}），偏好「${meta.label}」。` +
          `日程按站序分配天数，城际日含移动提示；同一城可出现多次（如金华→义乌→金华）。`
        : `自动生成：${pathLabel} ${days} 天，偏好「${meta.label}」。可在「日程」中自由调整。`,
      days: resultDays,
      budget: budgetSeed,
      pack: packSeed,
      notes:
        "【生成说明】多城为模板拆分；城际交通时段请按实际车次/自驾路况调整。重要预约请自行核对官网。",
    };
  }

  function seedBudget(style, days, multiCity) {
    const transfer = multiCity ? 350 * Math.max(1, Math.ceil(days / 2)) : 0;
    const base = [
      {
        category: "交通",
        note: multiCity ? "城际交通预估（多段）" : "城际 / 机票预估",
        amount: 800 * Math.ceil(days / 3) + transfer,
        currency: "CNY",
        paid: false,
        payer: "",
      },
      {
        category: "住宿",
        note: `约 ${days - 1 || 1} 晚` + (multiCity ? "（多城）" : ""),
        amount: 350 * Math.max(1, days - 1),
        currency: "CNY",
        paid: false,
        payer: "",
      },
      { category: "餐饮", note: "人均餐食预估", amount: 150 * days, currency: "CNY", paid: false, payer: "" },
      {
        category: "门票",
        note: "景点门票预估",
        amount: style === "rush" ? 200 * days : 120 * days,
        currency: "CNY",
        paid: false,
        payer: "",
      },
    ];
    if (style === "food") {
      base.push({
        category: "餐饮",
        note: "特色餐厅加码",
        amount: 100 * days,
        currency: "CNY",
        paid: false,
        payer: "",
      });
    }
    return base;
  }

  function seedPack(style) {
    const common = [
      { name: "身份证 / 护照", cat: "证件", done: false },
      { name: "手机充电器", cat: "数码", done: false },
      { name: "充电宝", cat: "数码", done: false },
      { name: "换洗衣物", cat: "衣物", done: false },
      { name: "洗漱用品", cat: "日用", done: false },
      { name: "常用药品", cat: "健康", done: false },
    ];
    if (style === "photo") common.push({ name: "相机 / 备用电池", cat: "数码", done: false });
    if (style === "family") common.push({ name: "儿童用品 / 零食", cat: "日用", done: false });
    if (style === "rush") common.push({ name: "舒适跑鞋", cat: "衣物", done: false });
    common.push({ name: "雨伞 / 防晒", cat: "日用", done: false });
    return common;
  }

  global.TravelGenerator = {
    generateItinerary,
    parseDestinations,
    normalizeDest,
    STYLE_META,
    /** 返回省·市标签列表（优先城市目录） */
    listDestinations: () => {
      if (global.TravelCityCatalog && global.TravelCityCatalog.listLabels) {
        return global.TravelCityCatalog.listLabels();
      }
      return Object.keys(DEST_DB);
    },
    /** POI 库短名（兼容） */
    listPoiCities: () => Object.keys(DEST_DB),
  };
})(typeof window !== "undefined" ? window : globalThis);
