/**
 * 旅途 · Fluid Travel
 * UI: Fluid Minimalism + Editorial Tech (2026)
 */
(function () {
  "use strict";

  const STORAGE_KEY = "travel_planner_v1";
  const THEME_KEY = "travel_planner_theme";
  const SIDEBAR_KEY = "travel_planner_sidebar_collapsed";
  const CONFIG_COLLAPSE_KEY = "travel_planner_config_collapsed";
  const BUDGET_CATS = ["交通", "住宿", "餐饮", "门票", "购物", "其他"];
  const CURRENCIES = ["CNY", "USD", "EUR", "JPY", "HKD"];
  const PACK_TEMPLATE = [
    { name: "身份证 / 护照", cat: "证件" },
    { name: "手机充电器", cat: "数码" },
    { name: "充电宝", cat: "数码" },
    { name: "换洗衣物", cat: "衣物" },
    { name: "洗漱用品", cat: "日用" },
    { name: "常用药品", cat: "健康" },
    { name: "雨伞 / 防晒", cat: "日用" },
    { name: "耳机", cat: "数码" },
  ];

  let state = {
    trips: [],
    activeId: null,
    rates: { USD: 7.2, EUR: 7.8, JPY: 0.048, HKD: 0.92, CNY: 1 },
    moodStyle: "balanced",
    openDays: {},
    search: "",
  };

  let lastGacha = null;
  /** @type {{ fromDay: number, fromIndex: number } | null} */
  let dragState = null;
  let mapRefreshTimer = null;
  /** @type {string[]} */
  let undoStack = [];
  const UNDO_MAX = 20;
  let weatherCacheKey = "";
  /** @type {null | Array<{date:string,code:number,tMax:number,tMin:number,rain:number|null,label:string,city?:string}>} */
  let lastWeatherDays = null;
  /** 天气城市筛选："all" 或城市名 */
  let weatherCityFilter = "all";
  /** @type {Record<string, {days: Array, lat:number, lng:number}>} */
  let weatherCityCache = {};
  /** @type {number|null} 目的地拖拽源下标 */
  let destDragFrom = null;
  /* 摄影能力常驻普通模式（始终 true，不再做开关） */
  const photoMode = true;
  let lastAstro = null;
  let gearList = [];

  function uid() {
    return "t_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function fmtDate(d) {
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function parseDate(s) {
    if (!s) return null;
    const d = new Date(s + "T00:00:00");
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function dayCount(start, end) {
    const a = parseDate(start);
    const b = parseDate(end);
    if (!a || !b) return 0;
    return Math.max(0, Math.round((b - a) / 86400000) + 1);
  }

  function emptyTrip() {
    const today = new Date();
    const end = new Date(today);
    end.setDate(end.getDate() + 2);
    return {
      id: uid(),
      title: "未命名旅程",
      destination: "",
      destinations: [],
      routeMode: "linear",
      startDate: fmtDate(today),
      endDate: fmtDate(end),
      people: 1,
      style: "balanced",
      companions: [],
      summary: "",
      notes: "",
      tips: {},
      days: [],
      budget: [],
      pack: [],
      updatedAt: Date.now(),
    };
  }

  /** 点选默认：省·市 / 省·市·县 */
  const DEFAULT_CITY_PICKS = [
    "上海",
    "北京",
    "浙江·杭州",
    "浙江·金华",
    "浙江·金华·义乌",
    "浙江·金华·东阳",
    "浙江·宁波",
    "江苏·苏州",
    "江苏·苏州·昆山",
    "江苏·南京",
    "四川·成都",
    "重庆",
    "广东·广州",
    "广东·深圳",
    "福建·厦门",
    "陕西·西安",
    "云南·丽江",
    "云南·大理",
    "广西·桂林·阳朔",
    "海南·三亚",
    "香港",
    "台湾·台北",
    "日本·东京",
    "日本·京都",
    "日本·大阪",
  ];

  /** 展开县市的父级标签，如 浙江·金华 */
  let destCountyExpand = "";

  function knownCityPicks() {
    if (window.TravelCityCatalog && TravelCityCatalog.listPrefectureLabels) {
      // 地级市置顶 + 全量（含县）
      const prefs = TravelCityCatalog.listPrefectureLabels();
      const all = DEFAULT_CITY_PICKS.concat(prefs).concat(
        TravelCityCatalog.listLabels()
      );
      const seen = new Set();
      return all.filter((c) => {
        if (!c || seen.has(c)) return false;
        seen.add(c);
        return true;
      });
    }
    if (window.TravelCityCatalog && TravelCityCatalog.listLabels) {
      const all = DEFAULT_CITY_PICKS.concat(TravelCityCatalog.listLabels());
      const seen = new Set();
      return all.filter((c) => {
        if (!c || seen.has(c)) return false;
        seen.add(c);
        return true;
      });
    }
    return DEFAULT_CITY_PICKS.slice();
  }

  /** 规范为 省·市 或 省·市·县；同名歧义时提示 */
  function toProvinceCityLabel(raw) {
    const s = String(raw || "").trim();
    if (!s) return "";
    if (window.TravelCityCatalog && TravelCityCatalog.resolvePlace) {
      const r = TravelCityCatalog.resolvePlace(s);
      if (r.ambiguous && r.ambiguous.length > 1) {
        toast(
          "「" +
            s +
            "」对应多地，请选带省·市（或县）的项：" +
            r.ambiguous.slice(0, 5).join(" / ")
        );
        return "";
      }
      return r.label || s;
    }
    if (window.TravelGenerator && TravelGenerator.normalizeDest) {
      return TravelGenerator.normalizeDest(s) || s;
    }
    return s;
  }

  /** 兼容旧数据：destination 字符串 ↔ destinations 数组（站序可含重复途经） */
  function normalizeTrip(t) {
    if (!t) return t;
    let list = [];
    if (Array.isArray(t.destinations) && t.destinations.length) {
      // 保留数组站序与重复（环线二次途经）
      list = t.destinations.map((s) => String(s).trim()).filter(Boolean);
    } else if (t.destination) {
      if (window.TravelGenerator && TravelGenerator.parseDestinations) {
        list = TravelGenerator.parseDestinations({ destination: t.destination });
      } else {
        list = String(t.destination)
          .split(/\s*[,，、\/|→～~]\s*|\s*->\s*|\s*到\s*|\s*至\s*/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }
    // 若 destination 路径站数更多（含重复途经），以字符串为准补全
    if (
      t.destination &&
      /[,，、→]|->|到|至/.test(t.destination)
    ) {
      const again =
        window.TravelGenerator && TravelGenerator.parseDestinations
          ? TravelGenerator.parseDestinations({ destination: t.destination })
          : String(t.destination)
              .split(/\s*[,，、\/|→～~]\s*|\s*->\s*|\s*到\s*|\s*至\s*/)
              .map((s) => s.trim())
              .filter(Boolean);
      // 仅当数组更短时用字符串（避免旧去重数据盖住完整路径）
      if (again.length > list.length) list = again;
    }
    // 升级为省·市标签（旧数据「金华」→「浙江·金华」）
    list = list
      .map((s) => {
        const n = String(s).trim();
        if (!n) return "";
        if (window.TravelCityCatalog && TravelCityCatalog.normalizeLabel) {
          return TravelCityCatalog.normalizeLabel(n) || n;
        }
        return n;
      })
      .filter(Boolean);
    t.destinations = list;
    t.destination = list.length ? list.join(" → ") : t.destination || "";
    if (t.routeMode !== "loop") t.routeMode = "linear";
    (t.days || []).forEach((d) => {
      if (d.city && window.TravelCityCatalog && TravelCityCatalog.normalizeLabel) {
        d.city = TravelCityCatalog.normalizeLabel(d.city) || d.city;
      }
      if (!d.city && list.length === 1) d.city = list[0];
    });
    return t;
  }

  function getDestinations(t) {
    if (!t) return [];
    normalizeTrip(t);
    return t.destinations || [];
  }

  /** 去重城市名（天气/选项用，不改路径站序） */
  function uniqueCitiesOf(list) {
    const u = [];
    (list || []).forEach((c) => {
      if (c && !u.includes(c)) u.push(c);
    });
    return u;
  }

  function setDestinations(t, list) {
    if (!t) return;
    // 允许同一城多次出现；统一存省·市
    t.destinations = (list || [])
      .map((s) => {
        const n = String(s).trim();
        if (!n) return "";
        if (window.TravelCityCatalog && TravelCityCatalog.normalizeLabel) {
          return TravelCityCatalog.normalizeLabel(n) || n;
        }
        return n;
      })
      .filter(Boolean);
    t.destination = t.destinations.join(" → ");
  }

  function primaryCity(t) {
    const ds = getDestinations(t);
    return ds[0] || "";
  }

  function dayCityOf(t, day) {
    return (day && day.city) || primaryCity(t) || "";
  }

  function pathLabelOf(t) {
    const ds = getDestinations(t);
    return ds.length ? ds.join(" → ") : t.destination || "";
  }

  function addDestination(t, raw, opts) {
    if (!t) return false;
    const quiet = opts && opts.quiet;
    let name = String(raw || "").trim();
    if (!name) return false;
    // 整段多城交给 parse（保留重复途经）
    if (/[,，、→]|->|到|至/.test(name) && window.TravelGenerator) {
      const parts = TravelGenerator.parseDestinations({ destination: name }).filter(Boolean);
      let n = 0;
      parts.forEach((p) => {
        if (addDestination(t, p, { quiet: true })) n++;
      });
      if (n && !quiet) toast("已加入 " + n + " 站（可重复途经）");
      return n > 0;
    }
    // 单站规范为省·市
    const labeled = toProvinceCityLabel(name);
    if (!labeled) return false;
    name = labeled;
    const list = getDestinations(t).slice();
    // 允许再次加入同一城（环线/往返二次途经）
    list.push(name);
    setDestinations(t, list);
    return true;
  }

  /** 按站序下标删除一站（不是删掉所有同名城） */
  function removeDestinationAt(t, index) {
    if (!t) return false;
    const prev = getDestinations(t).slice();
    if (index < 0 || index >= prev.length) return false;
    const removed = prev[index];
    prev.splice(index, 1);
    setDestinations(t, prev);
    if (weatherCityFilter === removed && !prev.includes(removed)) {
      weatherCityFilter = "all";
    }
    return true;
  }

  /** 点选：始终追加一站（可重复点同一城） */
  function appendDestinationStop(t, name) {
    if (!t || !name) return;
    addDestination(t, name, { quiet: true });
    const list = getDestinations(t);
    const times = list.filter((c) => c === name).length;
    toast(
      times > 1
        ? "已追加途经 " + name + "（第 " + times + " 次）"
        : "已加入 " + name + " · 再点可重复途经"
    );
    touch(t);
    renderDestChips(t);
    renderTripList();
    weatherCacheKey = "";
    loadWeather(false);
    scheduleMapRefresh(true);
  }

  function updateDestPathPreview(t) {
    const el = $("dest-path-preview");
    if (!el) return;
    const list = getDestinations(t);
    if (!list.length) {
      el.textContent =
        "尚未选择 · 点选 省·市，或 ▾县 选下辖县市（可 浙江·金华·义乌）";
      el.classList.add("is-empty");
      return;
    }
    const uniq = uniqueCitiesOf(list).length;
    const revisit = list.length > uniq;
    el.textContent =
      list.join(" → ") +
      "  ·  " +
      list.length +
      " 站" +
      (uniq !== list.length ? " / " + uniq + " 城" : "") +
      (revisit ? "（含重复途经）" : "");
    el.classList.remove("is-empty");
  }

  function renderDestPickGrid(t) {
    const grid = $("dest-pick-grid");
    if (!grid) return;
    const list = getDestinations(t);
    const countMap = {};
    list.forEach((c) => {
      countMap[c] = (countMap[c] || 0) + 1;
    });

    // 主列表：常用 + 地级市（不含县，县走展开）
    let picks = DEFAULT_CITY_PICKS.slice();
    if (window.TravelCityCatalog && TravelCityCatalog.listPrefectureLabels) {
      TravelCityCatalog.listPrefectureLabels().forEach((lab) => {
        if (!picks.includes(lab)) picks.push(lab);
      });
    }
    const showAll = grid.dataset.expanded === "1";
    const primary = picks.slice(0, 24);
    const rest = picks.slice(24);
    const visible = showAll ? picks : primary;

    grid.innerHTML = "";

    function makePickBtn(city, opts) {
      opts = opts || {};
      const n = countMap[city] || 0;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "dest-pick-btn" +
        (n > 0 ? " is-on" : "") +
        (opts.sub ? " is-county" : "") +
        (opts.parent && destCountyExpand === opts.parent ? " is-expand-parent" : "");
      btn.textContent = opts.short
        ? opts.short + (n > 1 ? " ×" + n : "")
        : n > 1
          ? city + " ×" + n
          : city;
      btn.title = opts.title || city;
      btn.addEventListener("click", () => {
        const cur = activeTrip();
        if (!cur) {
          toast("请先打开或创建行程");
          return;
        }
        if (opts.onClick) {
          opts.onClick(cur, city);
          return;
        }
        appendDestinationStop(cur, city);
      });
      return btn;
    }

    visible.forEach((city) => {
      const hasSub =
        window.TravelCityCatalog &&
        TravelCityCatalog.hasCounties &&
        TravelCityCatalog.hasCounties(city);
      // 本身已是 省·市·县 的常用项：直接追加
      const isCountyLabel = (city.match(/·/g) || []).length >= 2;

      if (hasSub && !isCountyLabel) {
        // 地级市：左键追加全市；也可展开下级县市
        const wrap = document.createElement("span");
        wrap.className = "dest-pick-combo";
        const main = makePickBtn(city, {
          title: "点击加入「" + city + "」；右侧 ▾ 展开下辖县市",
        });
        const exp = document.createElement("button");
        exp.type = "button";
        exp.className =
          "dest-pick-btn dest-pick-expand" +
          (destCountyExpand === city ? " is-open" : "");
        exp.textContent = destCountyExpand === city ? "▴" : "▾县";
        exp.title = "展开/收起下辖县市";
        exp.addEventListener("click", (e) => {
          e.stopPropagation();
          destCountyExpand = destCountyExpand === city ? "" : city;
          renderDestPickGrid(t);
        });
        wrap.append(main, exp);
        grid.appendChild(wrap);
      } else {
        grid.appendChild(
          makePickBtn(city, {
            title: "点击加入 " + city,
          })
        );
      }
    });

    // 展开的下辖县市条
    if (
      destCountyExpand &&
      window.TravelCityCatalog &&
      TravelCityCatalog.listCountiesOf
    ) {
      const counties = TravelCityCatalog.listCountiesOf(destCountyExpand);
      if (counties.length) {
        const bar = document.createElement("div");
        bar.className = "dest-county-bar";
        const lab = document.createElement("span");
        lab.className = "dest-county-lab";
        lab.textContent = destCountyExpand + " · 下辖";
        bar.appendChild(lab);
        // 全市
        bar.appendChild(
          makePickBtn(destCountyExpand, {
            short: "全市",
            sub: true,
            title: "加入地级市 " + destCountyExpand,
          })
        );
        counties.forEach((item) => {
          bar.appendChild(
            makePickBtn(item.label, {
              short: item.county,
              sub: true,
              title: "加入 " + item.label,
            })
          );
        });
        // 自定义县
        const custom = document.createElement("button");
        custom.type = "button";
        custom.className = "dest-pick-btn is-county dest-pick-custom-county";
        custom.textContent = "+ 其他县市";
        custom.title = "手写下辖县/市名";
        custom.addEventListener("click", () => {
          const cur = activeTrip();
          if (!cur) return;
          const name = prompt(
            "填写「" + destCountyExpand + "」下的县/县级市名称\n例如：义乌、东阳、兰溪",
            ""
          );
          if (!name || !String(name).trim()) return;
          const co = String(name).trim().replace(/(市|县|区)$/g, "");
          // 拼 省·市·县
          let full = destCountyExpand + "·" + co;
          if (window.TravelCityCatalog && TravelCityCatalog.normalizeLabel) {
            // 若目录有则规范；否则保留手写三级
            const norm = TravelCityCatalog.normalizeLabel(full);
            const r = TravelCityCatalog.resolvePlace(full);
            full = r.known ? norm : full;
          }
          appendDestinationStop(cur, full);
        });
        bar.appendChild(custom);
        grid.appendChild(bar);
      }
    }

    if (rest.length) {
      const more = document.createElement("button");
      more.type = "button";
      more.className = "dest-pick-btn dest-pick-more";
      more.textContent = showAll ? "收起" : "更多地级市…";
      more.addEventListener("click", () => {
        grid.dataset.expanded = showAll ? "0" : "1";
        renderDestPickGrid(t);
      });
      grid.appendChild(more);
    }
  }

  function reorderDestinations(t, from, to) {
    if (!t || from === to || from == null || to == null) return false;
    const list = getDestinations(t).slice();
    if (from < 0 || to < 0 || from >= list.length || to >= list.length) return false;
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
    setDestinations(t, list);
    touch(t);
    renderDestChips(t);
    renderTripList();
    // 顺序变化：天气按日重组（缓存仍可用）
    weatherCacheKey = "";
    loadWeather(false);
    scheduleMapRefresh(true);
    toast("城市顺序已更新 · 重抽日程会按新顺序分配");
    return true;
  }

  function renderDestChips(t) {
    const box = $("dest-chips");
    if (!box || !t) return;
    normalizeTrip(t);
    const list = t.destinations || [];
    updateDestPathPreview(t);
    renderDestPickGrid(t);
    box.innerHTML = "";
    list.forEach((city, i) => {
      if (i > 0) {
        const arr = document.createElement("span");
        arr.className = "dest-arrow";
        arr.textContent = "→";
        arr.setAttribute("aria-hidden", "true");
        box.appendChild(arr);
      }
      const chip = document.createElement("span");
      chip.className = "dest-chip";
      chip.draggable = true;
      chip.dataset.index = String(i);
      chip.title = "拖拽调整顺序";

      const handle = document.createElement("span");
      handle.className = "dest-chip-handle";
      handle.textContent = "⋮⋮";
      handle.setAttribute("aria-hidden", "true");

      const nameEl = document.createElement("span");
      nameEl.className = "dest-chip-name";
      const visitN = list.slice(0, i + 1).filter((c) => c === city).length;
      const visitTotal = list.filter((c) => c === city).length;
      nameEl.textContent =
        visitTotal > 1 ? city + " ·" + visitN : city;
      chip.title =
        visitTotal > 1
          ? city + "（第 " + visitN + " 次途经）· 拖拽排序"
          : "拖拽调整顺序";

      const x = document.createElement("button");
      x.type = "button";
      x.className = "dest-chip-x";
      x.setAttribute("aria-label", "移除本站 " + city);
      x.textContent = "×";
      x.draggable = false;
      x.addEventListener("click", (e) => {
        e.stopPropagation();
        removeDestinationAt(t, i);
        touch(t);
        renderDestChips(t);
        renderTripList();
        weatherCacheKey = "";
        loadWeather(true);
        scheduleMapRefresh(true);
      });
      x.addEventListener("mousedown", (e) => e.stopPropagation());
      x.addEventListener("pointerdown", (e) => e.stopPropagation());

      chip.append(handle, nameEl, x);

      chip.addEventListener("dragstart", (e) => {
        destDragFrom = i;
        chip.classList.add("is-dragging");
        try {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", String(i));
        } catch (_) {}
      });
      chip.addEventListener("dragend", () => {
        destDragFrom = null;
        box.querySelectorAll(".dest-chip").forEach((el) => {
          el.classList.remove("is-dragging", "is-drag-over");
        });
      });
      chip.addEventListener("dragover", (e) => {
        e.preventDefault();
        try {
          e.dataTransfer.dropEffect = "move";
        } catch (_) {}
        chip.classList.add("is-drag-over");
      });
      chip.addEventListener("dragleave", () => {
        chip.classList.remove("is-drag-over");
      });
      chip.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        chip.classList.remove("is-drag-over");
        let from = destDragFrom;
        try {
          const raw = e.dataTransfer.getData("text/plain");
          if (raw !== "" && raw != null) from = Number(raw);
        } catch (_) {}
        const to = Number(chip.dataset.index);
        if (Number.isFinite(from) && Number.isFinite(to)) {
          reorderDestinations(t, from, to);
        }
        destDragFrom = null;
      });

      box.appendChild(chip);
    });
    const routeRow = $("route-mode-row");
    if (routeRow) routeRow.classList.toggle("is-multi", list.length >= 2);
    document.querySelectorAll('input[name="route-mode"]').forEach((r) => {
      r.checked = (t.routeMode || "linear") === r.value;
    });
  }

  /** 按行程日生成天气槽：{date, city, dayIndex, label} */
  function buildTripWeatherSlots(t) {
    if (!t) return [];
    normalizeTrip(t);
    const days = t.days || [];
    if (days.length) {
      return days
        .map((d, i) => {
          const city = dayCityOf(t, d) || primaryCity(t) || "";
          return {
            date: d.date || "",
            city,
            dayIndex: i,
            label: "D" + (i + 1),
          };
        })
        .filter((s) => s.date && s.city);
    }
    const city = primaryCity(t);
    if (!city || !t.startDate) return [];
    const start = parseDate(t.startDate);
    const end = parseDate(t.endDate) || start;
    if (!start) return [];
    const slots = [];
    const cur = new Date(start.getTime());
    let i = 0;
    while (cur <= end && i < 16) {
      slots.push({
        date: fmtDate(cur),
        city,
        dayIndex: i,
        label: "D" + (i + 1),
      });
      cur.setDate(cur.getDate() + 1);
      i++;
    }
    return slots;
  }

  async function resolveCityLatLng(city) {
    if (!window.TravelMap) return null;
    const center = TravelMap.cityCenter(city);
    let lat = center[0];
    let lng = center[1];
    try {
      const pt = await TravelMap.geocode(city, "");
      if (pt) {
        lat = pt[0];
        lng = pt[1];
      }
    } catch (_) {}
    return { lat, lng };
  }

  async function fetchCityWeatherRange(city, start, end, force) {
    const key = city + "|" + start + "|" + end;
    if (!force && weatherCityCache[key] && weatherCityCache[key].days) {
      return weatherCityCache[key];
    }
    const ll = await resolveCityLatLng(city);
    if (!ll || !window.TravelGeo) return null;
    const weather = await TravelGeo.fetchWeather(ll.lat, ll.lng, start, end);
    if (!weather || !weather.days) return null;
    const packed = { days: weather.days, lat: ll.lat, lng: ll.lng, city };
    weatherCityCache[key] = packed;
    return packed;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.trips)) {
          state.trips = data.trips.map((t) => normalizeTrip(t));
          state.activeId = data.activeId || (data.trips[0] && data.trips[0].id) || null;
        }
        if (data.rates) state.rates = Object.assign(state.rates, data.rates);
        if (Array.isArray(data.gearList)) gearList = data.gearList;
      }
      if (!gearList.length && window.TravelGear) {
        gearList = TravelGear.DEFAULT_GEAR.map((g) =>
          Object.assign({}, g, { on: true })
        );
      }
      const th = localStorage.getItem(THEME_KEY);
      if (th === "dark" || th === "light") {
        document.documentElement.setAttribute("data-theme", th);
      } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        document.documentElement.setAttribute("data-theme", "dark");
      }
      // 清除旧版「摄影模式开关」状态，功能已并入普通模式
      try {
        localStorage.removeItem("travel_photo_mode");
        document.documentElement.classList.remove("photo-mode");
      } catch (_) {}
    } catch (e) {
      console.warn(e);
    }
  }

  function save() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          trips: state.trips,
          activeId: state.activeId,
          rates: state.rates,
          gearList,
        })
      );
    } catch (e) {
      toast("保存失败");
    }
  }

  function shutterClick() {
    // 常驻：轻量快门反馈（无声也可忽略）
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.value = 180;
      g.gain.value = 0.0001;
      o.connect(g);
      g.connect(ctx.destination);
      const t0 = ctx.currentTime;
      g.gain.exponentialRampToValueAtTime(0.08, t0 + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06);
      o.frequency.exponentialRampToValueAtTime(80, t0 + 0.05);
      o.start(t0);
      o.stop(t0 + 0.07);
      setTimeout(() => ctx.close(), 200);
    } catch (_) {}
    hapticLight();
  }

  function activeTrip() {
    return state.trips.find((t) => t.id === state.activeId) || null;
  }

  function touch(t) {
    t.updatedAt = Date.now();
    save();
  }

  function pushUndo() {
    try {
      const snap = JSON.stringify({
        trips: state.trips,
        activeId: state.activeId,
      });
      undoStack.push(snap);
      if (undoStack.length > UNDO_MAX) undoStack.shift();
    } catch (_) {}
  }

  function undo() {
    if (!undoStack.length) {
      toast("没有可撤销的操作");
      return;
    }
    try {
      const snap = JSON.parse(undoStack.pop());
      state.trips = snap.trips || [];
      state.activeId = snap.activeId || null;
      save();
      renderAll();
      scheduleMapRefresh(true);
      loadWeather(true);
      toast("已撤销");
      hapticLight();
    } catch (_) {
      toast("撤销失败");
    }
  }

  function withUndo(fn) {
    pushUndo();
    return fn();
  }

  const $ = (id) => document.getElementById(id);

  let toastTimer;
  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), 2400);
  }

  function hapticLight() {
    try {
      if (navigator.vibrate) navigator.vibrate(8);
    } catch (_) {}
  }

  function hapticOk() {
    try {
      if (navigator.vibrate) navigator.vibrate([12, 30, 12]);
    } catch (_) {}
  }

  function showView() {
    const has = !!activeTrip();
    $("empty-state").classList.toggle("hidden", has);
    $("trip-view").classList.toggle("hidden", !has);
  }

  function switchTab(name) {
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.tab === name);
    });
    document.querySelectorAll(".panel").forEach((p) => {
      p.classList.toggle("active", p.id === "panel-" + name);
    });
    if (name === "days") {
      // 工作台布局切换后需 invalidate Leaflet 尺寸
      fillMapPickDaySelect(activeTrip());
      scheduleMapRefresh(true);
      setTimeout(() => {
        if (window.TravelMap && TravelMap.invalidate) TravelMap.invalidate();
        if ($("chk-map-pick") && $("chk-map-pick").checked) syncMapPickMode(true);
      }, 80);
    } else if ($("chk-map-pick") && $("chk-map-pick").checked) {
      // 离开日程页时暂停选点视觉（勾选保留，回来继续）
      if (window.TravelMap && TravelMap.setPickMode) TravelMap.setPickMode(false);
    }
    if (name === "overview") {
      loadWeather(false);
    }
    if (name === "light") refreshLightPanel();
    if (name === "gear") renderGear();
    if (name === "lens") updateLensUI();
    if (name === "buddy") renderBuddyBoard();
  }

  function getMapFocusDay() {
    const sel = $("map-focus-day");
    if (!sel || sel.value === "all" || sel.value === "") return undefined;
    const n = Number(sel.value);
    return Number.isFinite(n) ? n : undefined;
  }

  function scheduleMapRefresh(force, focusDay) {
    clearTimeout(mapRefreshTimer);
    mapRefreshTimer = setTimeout(async () => {
      const t = activeTrip();
      if (t && window.TravelMap) {
        const showCaution = !!($("chk-caution") && $("chk-caution").checked);
        const fd = focusDay != null ? focusDay : getMapFocusDay();
        await TravelMap.renderTripMap(t, {
          force: !!force,
          showCaution,
          focusDay: fd,
        });
        updateRouteStats(t);
        // 选点模式在重绘后保持
        if ($("chk-map-pick") && $("chk-map-pick").checked) {
          syncMapPickMode(true);
        }
      }
    }, force ? 60 : 280);
  }

  function fillMapFocusDaySelect(t) {
    const sel = $("map-focus-day");
    if (!sel) return;
    const prev = sel.value;
    const days = (t && t.days) || [];
    sel.innerHTML = "";
    const all = document.createElement("option");
    all.value = "all";
    all.textContent = "全部日";
    sel.appendChild(all);
    days.forEach((d, i) => {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = "仅 D" + (i + 1) + (d.city ? " · " + d.city : "");
      sel.appendChild(o);
    });
    if (prev && [...sel.options].some((o) => o.value === prev)) sel.value = prev;
    else sel.value = "all";
  }

  function setConfigCollapsed(collapsed) {
    const bar = $("config-rail");
    const body = $("config-bar-body");
    const btn = $("btn-config-collapse");
    if (bar) bar.classList.toggle("is-collapsed", !!collapsed);
    if (body) body.hidden = !!collapsed;
    if (btn) {
      btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      btn.textContent = collapsed ? "▾ 展开配置" : "▴ 收起";
      btn.title = collapsed ? "展开路线与日期配置" : "折叠配置，腾出下方空间";
    }
    try {
      localStorage.setItem(CONFIG_COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch (_) {}
    setTimeout(() => {
      if (window.TravelMap && TravelMap.invalidate) TravelMap.invalidate();
    }, 200);
  }

  function openNavForActivity(act, day, t) {
    const place = (act && act.place) || "";
    const city = dayCityOf(t, day) || primaryCityOf(t) || "";
    let url = "";
    if (act && act.lat != null && act.lng != null && act.lat !== "") {
      const lat = Number(act.lat);
      const lng = Number(act.lng);
      // 通用查询，手机可唤起地图 App
      url =
        "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent(lat + "," + lng);
    } else {
      const q = [place, city].filter(Boolean).join(" ");
      if (!q) {
        toast("没有地点可导航");
        return;
      }
      url =
        "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function primaryCityOf(t) {
    return primaryCity(t);
  }

  function fillMapPickDaySelect(t) {
    const sel = $("map-pick-day");
    if (!sel) return;
    const prev = sel.value;
    const days = (t && t.days) || [];
    sel.innerHTML = "";
    if (!days.length) {
      const o = document.createElement("option");
      o.value = "0";
      o.textContent = "D1";
      sel.appendChild(o);
      fillMapFocusDaySelect(t);
      return;
    }
    days.forEach((d, i) => {
      const o = document.createElement("option");
      o.value = String(i);
      const city = d.city ? " · " + d.city : "";
      o.textContent = "D" + (i + 1) + city;
      sel.appendChild(o);
    });
    if (prev !== "" && Number(prev) < days.length) sel.value = prev;
    else {
      // 默认当前展开的第一天
      const openIdx = Object.keys(state.openDays || {}).find(
        (k) => state.openDays[k]
      );
      sel.value =
        openIdx != null && Number(openIdx) < days.length ? String(openIdx) : "0";
    }
    fillMapFocusDaySelect(t);
  }

  function syncMapPickMode(keepOn) {
    if (!window.TravelMap || !TravelMap.setPickMode) return;
    const on =
      keepOn != null
        ? !!keepOn
        : !!( $("chk-map-pick") && $("chk-map-pick").checked );
    const pane = $("map-pane");
    if (pane) pane.classList.toggle("is-pick-mode", on);
    const foot = $("map-footnote");
    if (foot) {
      foot.textContent = on
        ? "选点中：点击地图添加站点到所选日 · 地图钉点可拖拽微调"
        : "开启「选点」后点击地图，将坐标加入所选日。免费 OSM 瓦片 · 非商用导航。";
    }
    if (!on) {
      TravelMap.setPickMode(false);
      return;
    }
    TravelMap.setPickMode(true, async (lat, lng) => {
      const t = activeTrip();
      if (!t) {
        toast("请先打开行程");
        return;
      }
      if (!t.days || !t.days.length) {
        toast("请先添加日程天");
        return;
      }
      let di = Number($("map-pick-day") && $("map-pick-day").value);
      if (!Number.isFinite(di) || di < 0 || di >= t.days.length) di = 0;
      const day = t.days[di];
      toast("解析地点名…");
      let name = "";
      try {
        name = (await TravelMap.reverseGeocode(lat, lng)) || "";
      } catch (_) {}
      if (!name) {
        name = "地图点 " + lat.toFixed(4) + ", " + lng.toFixed(4);
      }
      const city = dayCityOf(t, day);
      withUndo(() => {
        if (!day.activities) day.activities = [];
        day.activities.push({
          time: "",
          place: name,
          note: "地图选点",
          lat: lat,
          lng: lng,
          _geoCity: city || "",
          _mapPinned: true,
        });
        touch(t);
      });
      state.openDays[di] = true;
      renderDays(t);
      renderOverview(t);
      scheduleMapRefresh(true, di);
      hapticOk();
      toast("已加入 D" + (di + 1) + " · " + name);
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toCNY(amount, currency) {
    const cur = currency || "CNY";
    const rate = cur === "CNY" ? 1 : Number(state.rates[cur]) || 1;
    return (Number(amount) || 0) * rate;
  }

  function formatMoney(n) {
    return Number(n || 0).toLocaleString("zh-CN", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    });
  }

  // ---------- inspire / gacha ----------
  function parseInspirePrompt(text) {
    const t = (text || "").trim();
    const dests = (window.TravelGenerator && TravelGenerator.listDestinations()) || [];
    const catalog =
      (window.TravelCityCatalog && TravelCityCatalog.CITIES) || [];

    // 显式路径：上海→浙江·金华 / 日本·东京→日本·京都
    let destinations = [];
    if (window.TravelGenerator && TravelGenerator.parseDestinations) {
      const parsed = TravelGenerator.parseDestinations({ destination: t });
      destinations = parsed
        .map((c) => toProvinceCityLabel(c) || c)
        .filter((c) => {
          if (!c) return false;
          if (dests.includes(c)) return true;
          // 省·市 最长约 10 字；过滤整句废话
          return (
            c.length >= 2 &&
            c.length <= 18 &&
            !/天|预算|环线|自驾|周末|想去/.test(c)
          );
        });
    }
    // 目录按「省·市」或短市名命中（长标签优先）
    if (!destinations.length) {
      const found = [];
      dests
        .slice()
        .sort((a, b) => b.length - a.length)
        .forEach((d) => {
          const idx = t.indexOf(d);
          if (idx >= 0) found.push({ d, idx });
        });
      catalog.forEach((e) => {
        const lab =
          window.TravelCityCatalog && TravelCityCatalog.labelOf
            ? TravelCityCatalog.labelOf(e)
            : e.city;
        const short = e.city;
        let idx = t.indexOf(lab);
        if (idx < 0) idx = t.indexOf(short);
        if (idx >= 0) found.push({ d: lab, idx });
      });
      found.sort((a, b) => a.idx - b.idx || b.d.length - a.d.length);
      const seenAt = new Set();
      destinations = found
        .filter((x) => {
          const key = x.idx + ":" + x.d;
          if (seenAt.has(key)) return false;
          seenAt.add(key);
          return true;
        })
        .map((x) => x.d);
      // 按出现位置去重保留顺序（允许重复途经若文本写两次）
    }
    if (!destinations.length) {
      let fallback = "";
      if (/海|沙滩|浪|厦门|三亚|青岛/.test(t)) fallback = "福建·厦门";
      else if (/古都|寺庙|和服|京都/.test(t)) fallback = "日本·京都";
      else if (/动漫|电器|涩谷|东京/.test(t)) fallback = "日本·东京";
      else if (/火锅|熊猫|成都/.test(t)) fallback = "四川·成都";
      else if (/西湖|杭州/.test(t)) fallback = "浙江·杭州";
      else if (/义乌/.test(t)) fallback = "浙江·金华·义乌";
      else if (/金华/.test(t)) fallback = "浙江·金华";
      else if (/故宫|长城|北京/.test(t)) fallback = "北京";
      else if (/外滩|上海/.test(t)) fallback = "上海";
      else if (/港|维港/.test(t)) fallback = "香港";
      else if (/发呆|慢|安静/.test(t)) fallback = "浙江·杭州";
      else fallback = "上海";
      destinations = [fallback];
    }
    // 再规范一遍省·市
    destinations = destinations
      .map((c) => toProvinceCityLabel(c) || c)
      .filter(Boolean);
    // 保留路径站序中的重复途经（不强制去重）

    let days = 3;
    const dm = t.match(/(\d+)\s*天/);
    if (dm) days = Math.min(30, Math.max(1, Number(dm[1])));
    else if (/周末/.test(t)) days = 2;
    else if (/一日|一天/.test(t)) days = 1;
    // 多城默认略加长
    if (destinations.length >= 2 && !dm && !/周末|一日|一天/.test(t)) {
      days = Math.max(days, destinations.length + 1);
    }

    let style = state.moodStyle || "balanced";
    if (/特种兵|赶|打卡很多|极限/.test(t)) style = "rush";
    else if (/深度|慢|发呆|逛逛/.test(t)) style = "deep";
    else if (/亲子|带娃|孩子/.test(t)) style = "family";
    else if (/吃|美食|拉面|火锅|烧肉/.test(t)) style = "food";
    else if (/拍|出片|ins|照片/.test(t)) style = "photo";

    let budgetHint = null;
    const bm = t.match(/预算\s*(\d+)/) || t.match(/(\d{3,5})\s*块/);
    if (bm) budgetHint = Number(bm[1]);

    const routeMode = /环线|绕一圈|闭环|回程回|自驾环/.test(t) ? "loop" : "linear";
    const destination = destinations.join(" → ");

    return { destination, destinations, days, style, budgetHint, routeMode, prompt: t };
  }

  function runGacha() {
    if (!window.TravelGenerator) {
      toast("灵感引擎未加载");
      return;
    }
    const deck = $("gacha-deck");
    deck.innerHTML =
      '<div class="gacha-loading">扭蛋中<span>.</span><span>.</span><span>.</span></div>';
    const parsed = parseInspirePrompt($("inspire-prompt").value);
    const orb = $("inspire-orb");
    orb.classList.add("is-spinning");
    hapticLight();

    let spinAnim = null;
    const slot = $("lottie-orb-slot");
    if (window.TravelLottie && slot) {
      slot.style.cssText =
        "position:fixed;left:50%;top:22%;width:120px;height:120px;margin-left:-60px;z-index:40;pointer-events:none";
      spinAnim = TravelLottie.playSpinIn(slot);
    }

    // 短延迟制造「抽出」仪式感
    setTimeout(() => {
      orb.classList.remove("is-spinning");
      if (spinAnim && spinAnim.destroy) spinAnim.destroy();
      if (slot) {
        slot.innerHTML = "";
        slot.style.cssText = "";
      }
      const gen = TravelGenerator.generateItinerary({
        destination: parsed.destination,
        destinations: parsed.destinations,
        days: parsed.days,
        style: parsed.style,
        startDate: fmtDate(new Date()),
        routeMode: parsed.routeMode || "linear",
      });

      if (parsed.budgetHint && gen.budget) {
        const sum = gen.budget.reduce((s, b) => s + (Number(b.amount) || 0), 0) || 1;
        const scale = parsed.budgetHint / sum;
        gen.budget.forEach((b) => {
          b.amount = Math.round((Number(b.amount) || 0) * scale);
          b.payer = "我";
        });
        gen.summary += ` 预算参考约 ¥${parsed.budgetHint}。`;
      } else {
        (gen.budget || []).forEach((b) => {
          b.payer = "我";
        });
      }

      lastGacha = gen;
      renderGachaCard(gen, parsed);
      hapticOk();
    }, 720);
  }

  function renderGachaCard(gen, parsed) {
    const deck = $("gacha-deck");
    deck.innerHTML = "";

    const burst = document.createElement("div");
    burst.className = "gacha-burst";
    deck.appendChild(burst);
    setTimeout(() => burst.remove(), 700);

    const stack = document.createElement("div");
    stack.className = "gacha-stack";
    stack.innerHTML = '<div class="gacha-ghost"></div><div class="gacha-ghost g2"></div>';

    const card = document.createElement("div");
    card.className = "gacha-card";
    const spots = (gen.days || [])
      .slice(0, 2)
      .map((d) => (d.activities || []).slice(0, 2).map((a) => a.place).join(" · "))
      .filter(Boolean)
      .join("  /  ");

    card.innerHTML =
      '<div class="gacha-shine"></div>' +
      "<h3></h3>" +
      '<div class="gacha-meta"></div>' +
      '<div class="gacha-preview"></div>' +
      '<div class="gacha-actions">' +
      '<button type="button" class="btn btn-ghost btn-sm" id="gacha-pass">→ 丢掉</button>' +
      '<button type="button" class="btn btn-primary btn-sm" id="gacha-keep">← 收藏</button>' +
      "</div>";
    card.querySelector("h3").textContent = gen.title;
    card.querySelector(".gacha-meta").textContent = [
      gen.destination,
      (parsed && parsed.days) + " 天",
      gen.routeMode === "loop" && (gen.destinations || []).length >= 2
        ? "环线"
        : (gen.destinations || []).length >= 2
          ? "多城"
          : "",
      (window.TravelGenerator.STYLE_META[gen.style] || {}).label || "",
    ]
      .filter(Boolean)
      .join(" · ");
    card.querySelector(".gacha-preview").textContent =
      spots || gen.summary || "收藏后可在画布里拖拽重排每一站。";

    stack.appendChild(card);
    deck.appendChild(stack);
    const hint = document.createElement("div");
    hint.className = "gacha-hint";
    hint.textContent = "手指按住卡片左右滑 · 或点下方按钮";
    deck.appendChild(hint);

    const dismiss = (dir) => {
      hapticLight();
      card.classList.add(dir === "left" ? "fly-left" : "fly-right");
      setTimeout(() => {
        if (dir === "left") {
          if (lastGacha) keepGacha(lastGacha);
        } else {
          deck.innerHTML = "";
          lastGacha = null;
          toast("已丢掉，再扭一次");
        }
      }, 320);
    };

    $("gacha-pass").addEventListener("click", (e) => {
      e.stopPropagation();
      dismiss("right");
    });
    $("gacha-keep").addEventListener("click", (e) => {
      e.stopPropagation();
      dismiss("left");
    });

    bindGachaSwipe(card, dismiss);
  }

  function bindGachaSwipe(card, dismiss) {
    let startX = 0;
    let startY = 0;
    let dx = 0;
    let dragging = false;

    const onStart = (x, y) => {
      startX = x;
      startY = y;
      dx = 0;
      dragging = true;
      card.classList.add("is-dragging");
      card.style.transition = "none";
    };
    const onMove = (x, y) => {
      if (!dragging) return;
      dx = x - startX;
      const dy = y - startY;
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 24) {
        // 纵向滚动优先
        dragging = false;
        card.classList.remove("is-dragging");
        card.style.transform = "";
        return;
      }
      const rot = dx * 0.06;
      card.style.transform = `translateX(${dx}px) rotate(${rot}deg)`;
      card.style.opacity = String(Math.max(0.35, 1 - Math.abs(dx) / 280));
    };
    const onEnd = () => {
      if (!dragging) return;
      dragging = false;
      card.classList.remove("is-dragging");
      card.style.transition = "";
      if (dx > 90) dismiss("right");
      else if (dx < -90) dismiss("left");
      else {
        card.style.transform = "";
        card.style.opacity = "1";
      }
      dx = 0;
    };

    card.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      card.setPointerCapture(e.pointerId);
      onStart(e.clientX, e.clientY);
    });
    card.addEventListener("pointermove", (e) => onMove(e.clientX, e.clientY));
    card.addEventListener("pointerup", onEnd);
    card.addEventListener("pointercancel", onEnd);
  }

  function keepGacha(gen) {
    const t = emptyTrip();
    Object.assign(t, {
      title: gen.title,
      destination: gen.destination,
      destinations: gen.destinations || [],
      routeMode: gen.routeMode || "linear",
      startDate: gen.startDate,
      endDate: gen.endDate,
      style: gen.style,
      summary: gen.summary,
      notes: gen.notes,
      days: gen.days,
      budget: gen.budget,
      pack: gen.pack,
      people: 2,
      companions: [],
      updatedAt: Date.now(),
    });
    normalizeTrip(t);
    state.trips.unshift(t);
    state.activeId = t.id;
    state.openDays = { 0: true };
    save();
    lastGacha = null;
    $("gacha-deck").innerHTML = "";
    if (window.TravelLottie) TravelLottie.playSuccessOverlay();
    renderAll();
    switchTab("days");
    hapticOk();
    toast("已收藏 · 地图连线中");
    scheduleMapRefresh(true);
  }

  // ---------- list / overview ----------
  function renderTripList() {
    const ul = $("trip-list");
    ul.innerHTML = "";
    const q = (state.search || "").trim().toLowerCase();
    const list = state.trips
      .slice()
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .filter((t) => {
        if (!q) return true;
        const blob = [
          t.title,
          t.destination,
          (t.destinations || []).join(" "),
          t.summary,
          t.style,
        ]
          .join(" ")
          .toLowerCase();
        return blob.includes(q);
      });
    if (!state.trips.length) {
      ul.innerHTML =
        '<li style="padding:10px 12px;color:var(--muted);font-size:0.82rem">还没有收藏</li>';
      return;
    }
    if (!list.length) {
      ul.innerHTML =
        '<li style="padding:10px 12px;color:var(--muted);font-size:0.82rem">无匹配行程</li>';
      return;
    }
    list.forEach((t) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      if (t.id === state.activeId) btn.classList.add("active");
      btn.innerHTML = '<span class="t-name"></span><span class="t-sub"></span>';
      btn.querySelector(".t-name").textContent = t.title || "未命名";
      const lab =
        (window.TravelGenerator &&
          TravelGenerator.STYLE_META[t.style] &&
          TravelGenerator.STYLE_META[t.style].label) ||
        "";
      btn.querySelector(".t-sub").textContent =
        [pathLabelOf(t) || t.destination, t.startDate, lab].filter(Boolean).join(" · ");
      btn.addEventListener("click", () => {
        state.activeId = t.id;
        state.openDays = { 0: true };
        weatherCacheKey = "";
        weatherCityFilter = "all";
        save();
        renderAll();
        loadWeather(true);
        scheduleMapRefresh(true);
        hapticLight();
      });
      li.appendChild(btn);
      ul.appendChild(li);
    });
  }

  function renderWeatherCityTabs(cities) {
    const tabs = $("weather-city-tabs");
    if (!tabs) return;
    const multi = cities.length > 1;
    if (!multi) {
      tabs.hidden = true;
      tabs.innerHTML = "";
      weatherCityFilter = "all";
      return;
    }
    tabs.hidden = false;
    if (weatherCityFilter !== "all" && !cities.includes(weatherCityFilter)) {
      weatherCityFilter = "all";
    }
    const items = ["all"].concat(cities);
    tabs.innerHTML = "";
    items.forEach((c) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "weather-city-tab" + (weatherCityFilter === c ? " active" : "");
      btn.textContent = c === "all" ? "全部日程" : c;
      btn.addEventListener("click", () => {
        weatherCityFilter = c;
        // 仅重绘，不重新请求
        const t = activeTrip();
        if (t && t._weatherSlots) {
          paintWeatherSlots(t, t._weatherSlots, cities);
        } else {
          loadWeather(false);
        }
      });
      tabs.appendChild(btn);
    });
  }

  function paintWeatherSlots(t, slots, cities) {
    const box = $("weather-box");
    const hint = $("weather-hint");
    if (!box) return;
    renderWeatherCityTabs(cities);

    const filtered =
      weatherCityFilter === "all"
        ? slots
        : slots.filter((s) => s.city === weatherCityFilter);

    if (!filtered.length) {
      box.innerHTML =
        '<span class="hint-text">当前筛选下没有日程日，换个城市标签试试</span>';
      box.dataset.ready = "1";
      return;
    }

    const todayStr = fmtDate(new Date());
    box.innerHTML = filtered
      .slice(0, 16)
      .map((s) => {
        const w = s.weather;
        const isToday = s.date === todayStr;
        const cityBadge =
          cities.length > 1
            ? `<div class="w-city" title="当日城市">${escapeHtml(s.city)}</div>`
            : "";
        if (!w) {
          return `<div class="weather-chip${isToday ? " is-today" : ""}">
            <div class="w-day">${escapeHtml(s.label)}</div>
            ${cityBadge}
            <div class="w-date">${escapeHtml((s.date || "").slice(5))}</div>
            <div class="w-miss">暂无预报</div>
          </div>`;
        }
        const rain =
          w.rain != null ? `<div class="w-label">降水 ${w.rain}%</div>` : "";
        return `<div class="weather-chip${isToday ? " is-today" : ""}" title="${escapeHtml(
          s.city + " · " + s.date
        )}">
          <div class="w-day">${escapeHtml(s.label)}</div>
          ${cityBadge}
          <span class="w-emoji">${TravelGeo.weatherEmoji(w.code)}</span>
          <div class="w-date">${escapeHtml((s.date || "").slice(5))}</div>
          <div class="w-temp">${Math.round(w.tMin)}~${Math.round(w.tMax)}°</div>
          <div class="w-label">${escapeHtml(w.label || "")}</div>
          ${rain}
        </div>`;
      })
      .join("");
    box.dataset.ready = "1";

    if (hint) {
      if (cities.length > 1) {
        hint.textContent =
          weatherCityFilter === "all"
            ? "按日程日显示各城天气（Open-Meteo）· 点上方城市可筛选"
            : "仅显示「" + weatherCityFilter + "」相关日程日 · 点「全部日程」看全程";
      } else {
        hint.textContent = "Open-Meteo 免费预报 · 与行程日期对齐";
      }
    }
  }

  async function loadWeather(force) {
    const t = activeTrip();
    const box = $("weather-box");
    const tabs = $("weather-city-tabs");
    const hint = $("weather-hint");
    if (!box) return;

    if (!t) {
      box.innerHTML = '<span class="hint-text">打开行程后显示天气预报</span>';
      if (tabs) {
        tabs.hidden = true;
        tabs.innerHTML = "";
      }
      return;
    }

    const slots = buildTripWeatherSlots(t);
    let cities = [];
    slots.forEach((s) => {
      if (s.city && !cities.includes(s.city)) cities.push(s.city);
    });
    getDestinations(t).forEach((c) => {
      if (c && !cities.includes(c)) cities.push(c);
    });

    if (!cities.length) {
      box.innerHTML = '<span class="hint-text">填写目的地后显示天气预报</span>';
      if (tabs) {
        tabs.hidden = true;
        tabs.innerHTML = "";
      }
      if (hint) hint.textContent = "添加城市与日期后自动拉取（Open-Meteo）";
      lastWeatherDays = null;
      return;
    }

    if (!window.TravelMap || !window.TravelGeo) {
      box.innerHTML = '<span class="hint-text">天气模块未加载</span>';
      return;
    }

    const start = t.startDate || (slots[0] && slots[0].date) || fmtDate(new Date());
    const end =
      t.endDate ||
      (slots.length && slots[slots.length - 1].date) ||
      start;
    const planSig = slots.map((s) => s.date + ":" + s.city).join("|");
    const key = cities.join(",") + "|" + start + "|" + end + "|" + planSig;
    if (!force && key === weatherCacheKey && box.dataset.ready === "1" && t._weatherSlots) {
      paintWeatherSlots(t, t._weatherSlots, cities);
      return;
    }

    box.innerHTML =
      '<span class="hint-text">拉取天气中…' +
      (cities.length > 1 ? "（按城 " + cities.join("、") + "）" : "") +
      "</span>";
    if (tabs) tabs.hidden = cities.length <= 1;

    const results = await Promise.all(
      cities.map((c) => fetchCityWeatherRange(c, start, end, force))
    );
    const byCity = {};
    cities.forEach((c, i) => {
      if (results[i]) byCity[c] = results[i];
    });

    // 无日程槽时：用首城整段预报
    let filled = slots.slice();
    if (!filled.length) {
      const c0 = cities[0];
      const pack = byCity[c0];
      filled = (pack && pack.days ? pack.days : []).slice(0, 8).map((d, i) => ({
        date: d.date,
        city: c0,
        dayIndex: i,
        label: "D" + (i + 1),
        weather: d,
      }));
    } else {
      filled = filled.map((s) => {
        const pack = byCity[s.city];
        const w =
          pack && pack.days
            ? pack.days.find((d) => d.date === s.date) || null
            : null;
        return Object.assign({}, s, { weather: w });
      });
    }

    weatherCacheKey = key;
    const okCount = filled.filter((s) => s.weather).length;
    if (!okCount) {
      box.innerHTML =
        '<span class="hint-text">暂时拉不到天气，请检查网络后刷新</span>';
      box.dataset.ready = "0";
      lastWeatherDays = null;
      t._weatherDays = null;
      t._weatherSlots = null;
      renderPackSuggestions(t);
      return;
    }

    lastWeatherDays = filled
      .filter((s) => s.weather)
      .map((s) =>
        Object.assign({}, s.weather, { city: s.city, dayLabel: s.label })
      );
    t._weatherDays = lastWeatherDays;
    t._weatherSlots = filled;
    t._weatherByCity = byCity;

    paintWeatherSlots(t, filled, cities);
    renderPackSuggestions(t);
  }

  function renderOverview(t) {
    normalizeTrip(t);
    $("trip-title").value = t.title || "";
    renderDestChips(t);
    $("trip-start").value = t.startDate || "";
    $("trip-end").value = t.endDate || "";
    $("trip-people").value = t.people || 1;
    $("trip-style").value = t.style || "balanced";
    $("trip-summary").value = t.summary || "";
    $("trip-notes").value = t.notes || "";
    if ($("trip-mood")) $("trip-mood").value = t.mood || "✨";

    const days = dayCount(t.startDate, t.endDate);
    $("stat-days").textContent = days ? String(days) : "—";
    let acts = 0;
    (t.days || []).forEach((d) => {
      acts += (d.activities || []).length;
    });
    $("stat-acts").textContent = String(acts);
    const budgetSum = (t.budget || []).reduce((s, b) => s + toCNY(b.amount, b.currency), 0);
    $("stat-budget").textContent = "¥" + formatMoney(budgetSum);
    const pack = t.pack || [];
    $("stat-pack").textContent = `${pack.filter((p) => p.done).length}/${pack.length}`;

    document.querySelectorAll("#quick-tips input[data-tip]").forEach((inp) => {
      inp.checked = !!(t.tips && t.tips[inp.getAttribute("data-tip")]);
    });

    renderProgress(t, budgetSum, acts);
    renderReminds(t);
  }

  function renderProgress(t, budgetSum, acts) {
    const tipKeys = ["visa", "ticket", "hotel", "ins", "weather", "map"];
    const tipsDone = tipKeys.filter((k) => t.tips && t.tips[k]).length;
    const tipsPct = Math.round((tipsDone / tipKeys.length) * 100);

    const pack = t.pack || [];
    const packPct = pack.length
      ? Math.round((pack.filter((p) => p.done).length / pack.length) * 100)
      : 0;

    const budget = t.budget || [];
    const paidSum = budget.reduce(
      (s, b) => s + (b.paid ? toCNY(b.amount, b.currency) : 0),
      0
    );
    const paidPct =
      budgetSum > 0 ? Math.round((paidSum / budgetSum) * 100) : 0;

    // 日程丰满：有站点数的天 / 总天数，且平均每天至少 2 站算满分贡献
    const dayN = Math.max(1, (t.days && t.days.length) || 0);
    let rich = 0;
    (t.days || []).forEach((d) => {
      const n = (d.activities || []).filter((a) => (a.place || "").trim()).length;
      rich += Math.min(1, n / 3);
    });
    const daysPct = dayN ? Math.round((rich / dayN) * 100) : 0;

    setProg("tips", tipsPct);
    setProg("pack", packPct);
    setProg("paid", paidPct);
    setProg("days", daysPct);

    const avg = Math.round((tipsPct + packPct + paidPct + daysPct) / 4);
    const hint = $("prog-hint");
    if (hint) {
      if (avg >= 80) hint.textContent = "完成度很高，可以安心出发了 ✨";
      else if (avg >= 45) hint.textContent = "骨架有了，继续补行李和预算会更稳。";
      else hint.textContent = "完善清单与日程，完成度会自己涨。";
    }

    const people = Math.max(1, Number(t.people) || 1);
    const companions = 1 + (t.companions || []).length;
    const headcount = Math.max(people, companions);
    const per = budgetSum / headcount;
    const pp = $("per-person-hint");
    if (pp) {
      pp.textContent = budgetSum
        ? `人均约 ¥${formatMoney(per)}（按 ${headcount} 人：人数设定与旅伴取较大值）`
        : "";
    }
  }

  function setProg(key, pct) {
    const label = $("prog-" + key);
    const bar = $("prog-" + key + "-bar");
    if (label) label.textContent = pct + "%";
    if (bar) bar.style.width = Math.max(0, Math.min(100, pct)) + "%";
  }

  function parseTimeToMin(s) {
    if (!s || !String(s).includes(":")) return null;
    const p = String(s).trim().split(":");
    const h = Number(p[0]);
    const m = Number(p[1]);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  }

  /** 返回有时间冲突的 activity 下标集合 */
  function findTimeConflicts(activities) {
    const bad = new Set();
    const list = activities || [];
    const timed = list
      .map((a, i) => ({ i, t: parseTimeToMin(a.time) }))
      .filter((x) => x.t != null)
      .sort((a, b) => a.t - b.t);
    for (let k = 1; k < timed.length; k++) {
      if (timed[k].t === timed[k - 1].t) {
        bad.add(timed[k].i);
        bad.add(timed[k - 1].i);
      } else if (timed[k].t - timed[k - 1].t < 30) {
        // 间隔 < 30 分钟：软冲突
        bad.add(timed[k].i);
        bad.add(timed[k - 1].i);
      }
    }
    return bad;
  }

  function isToday(dateStr) {
    if (!dateStr) return false;
    return dateStr === fmtDate(new Date());
  }

  function renderReminds(t) {
    const ul = $("remind-list");
    if (!ul) return;
    if (!t.reminds) t.reminds = [];
    ul.innerHTML = "";
    if (!t.reminds.length) {
      ul.innerHTML =
        '<li class="hint-text" style="list-style:none">还没有提醒，可添加「取票 / 充值 / 预约确认」等</li>';
      return;
    }
    t.reminds.forEach((r, i) => {
      const li = document.createElement("li");
      li.className = "remind-item" + (r.done ? " done" : "");
      const chk = document.createElement("input");
      chk.type = "checkbox";
      chk.checked = !!r.done;
      chk.addEventListener("change", () => {
        r.done = chk.checked;
        touch(t);
        renderReminds(t);
      });
      const span = document.createElement("span");
      span.textContent = r.text || "";
      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn-icon";
      del.textContent = "×";
      del.addEventListener("click", () => {
        withUndo(() => {
          t.reminds.splice(i, 1);
          touch(t);
        });
        renderReminds(t);
      });
      li.append(chk, span, del);
      ul.appendChild(li);
    });
  }

  function buildShareText(t) {
    const mood = t.mood || "✨";
    const lines = [];
    lines.push(`${mood} ${t.title || "旅程"}`);
    const path = pathLabelOf(t) || "—";
    const modeTag =
      t.routeMode === "loop" && getDestinations(t).length >= 2 ? " · 环线" : "";
    lines.push(
      `📍 ${path}${modeTag} · ${t.startDate || "?"} ~ ${t.endDate || "?"}`
    );
    lines.push("");
    (t.days || []).forEach((d, di) => {
      const cityTag = d.city ? ` · ${d.city}` : "";
      lines.push(
        `【D${di + 1}${d.date ? " " + d.date : ""}${cityTag}】${d.title || ""}`
      );
      (d.activities || []).slice(0, 6).forEach((a) => {
        if (!(a.place || "").trim()) return;
        lines.push(`· ${a.time || ""} ${a.place}`.trim());
      });
      if (d.note) lines.push(`备注：${d.note}`);
      lines.push("");
    });
    const sum = (t.budget || []).reduce((s, b) => s + toCNY(b.amount, b.currency), 0);
    if (sum) lines.push(`💰 预算约 ¥${formatMoney(sum)}`);
    lines.push("—— 来自 旅途 Fluid Travel");
    return lines.join("\n");
  }

  async function copyShare(t) {
    const text = buildShareText(t);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      toast("行程摘要已复制，可粘贴到微信");
      hapticOk();
    } catch (_) {
      toast("复制失败，请改用导出 Markdown");
    }
  }

  const NOTE_TPL = {
    booking:
      "【预订】\n- 机票/高铁：\n- 酒店：\n- 门票预约：\n- 确认号：\n",
    meet: "【集合】\n- 时间：\n- 地点：\n- 负责人：\n- 迟到联系：\n",
    alert: "【注意】\n- 饮食禁忌：\n- 过敏：\n- 紧急联系人：\n- 其他：\n",
  };

  function renderDays(t) {
    const box = $("days-container");
    box.innerHTML = "";
    fillMapPickDaySelect(t);
    const days = t.days || [];
    if (!days.length) {
      box.innerHTML =
        '<p class="hint-text">画布还是空的。试「重抽日程」或首页扭蛋。</p>';
      return;
    }
    days.forEach((day, di) => {
      const open = !!state.openDays[di];
      const card = document.createElement("div");
      card.className = "day-card" + (open ? " is-open" : "");

      const head = document.createElement("div");
      head.className = "day-head";
      const badge = document.createElement("span");
      badge.className = "day-badge";
      badge.textContent = "D" + (di + 1);
      const titleIn = document.createElement("input");
      titleIn.value = day.title || "";
      titleIn.placeholder = "这一天的情绪标题";
      titleIn.addEventListener("click", (e) => e.stopPropagation());
      titleIn.addEventListener("input", () => {
        day.title = titleIn.value;
        touch(t);
      });
      const sum = document.createElement("span");
      sum.className = "day-summary";
      const n = (day.activities || []).length;
      sum.textContent = n + " 站 · " + (day.date || "未标日期");
      if (day.city) {
        const cityPill = document.createElement("span");
        cityPill.className = "day-city-pill";
        cityPill.textContent = day.city;
        sum.appendChild(document.createTextNode(" "));
        sum.appendChild(cityPill);
      }
      const dateIn = document.createElement("input");
      dateIn.type = "date";
      dateIn.value = day.date || "";
      dateIn.style.maxWidth = "140px";
      dateIn.addEventListener("click", (e) => e.stopPropagation());
      dateIn.addEventListener("change", () => {
        day.date = dateIn.value;
        touch(t);
        renderDays(t);
      });

      // 当日城市（选项去重；路径站序本身可重复途经）
      const dests = getDestinations(t);
      const citySel = document.createElement("select");
      citySel.className = "day-city-select";
      citySel.title = "当日所在城市";
      const cityOpts = uniqueCitiesOf(dests);
      if (day.city && !cityOpts.includes(day.city)) cityOpts.push(day.city);
      if (!cityOpts.length) cityOpts.push("");
      cityOpts.forEach((c) => {
        const o = document.createElement("option");
        o.value = c;
        o.textContent = c || "城市";
        citySel.appendChild(o);
      });
      citySel.value = day.city || cityOpts[0] || "";
      citySel.addEventListener("click", (e) => e.stopPropagation());
      citySel.addEventListener("change", () => {
        day.city = citySel.value;
        // 换城后清掉旧坐标钉，强制按新城市重新地理编码
        if (window.TravelMap && TravelMap.clearDayGeoPins) {
          TravelMap.clearDayGeoPins(day);
        } else if (day.activities) {
          day.activities.forEach((a) => {
            delete a.lat;
            delete a.lng;
            delete a._geoCity;
          });
        }
        touch(t);
        renderDays(t);
        scheduleMapRefresh(true, di);
        weatherCacheKey = "";
        loadWeather(false);
        toast(
          "D" +
            (di + 1) +
            " 已切换到 " +
            (day.city || "—") +
            "，地图按新城市重定位"
        );
      });

      const tools = document.createElement("div");
      tools.className = "day-tools";
      tools.addEventListener("click", (e) => e.stopPropagation());

      const btnUp = miniBtn("↑", "上移整日", () => moveDay(t, di, -1));
      const btnDown = miniBtn("↓", "下移整日", () => moveDay(t, di, 1));
      const btnCopy = miniBtn("⧉", "复制这一天", () => duplicateDay(t, di));
      const btnOpt = miniBtn("◎", "优化本日顺序", () => optimizeDay(t, di));
      const delDay = document.createElement("button");
      delDay.type = "button";
      delDay.className = "btn-icon";
      delDay.title = "删除这一天";
      delDay.textContent = "×";
      delDay.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!confirm("折掉这一天？")) return;
        withUndo(() => {
          t.days.splice(di, 1);
          touch(t);
        });
        renderDays(t);
        renderOverview(t);
        scheduleMapRefresh(true);
      });
      tools.append(btnUp, btnDown, btnCopy, btnOpt, delDay);
      head.append(badge, titleIn, sum, dateIn);
      if (dests.length > 1 || day.city) head.appendChild(citySel);
      head.appendChild(tools);
      head.addEventListener("click", () => {
        state.openDays[di] = !state.openDays[di];
        hapticLight();
        renderDays(t);
      });

      const conflicts = findTimeConflicts(day.activities || []);
      if (conflicts.size) {
        const badgeC = document.createElement("span");
        badgeC.className = "conflict-badge";
        badgeC.textContent = "时间紧/冲突";
        badgeC.title = "有站点时间相同或间隔不足 30 分钟";
        sum.appendChild(badgeC);
      }
      if (isToday(day.date)) {
        const today = document.createElement("span");
        today.className = "today-pill";
        today.textContent = "今天";
        sum.appendChild(document.createTextNode(" "));
        sum.appendChild(today);
      }

      const body = document.createElement("div");
      body.className = "day-body";

      // 光影色条常驻
      const lightBand = document.createElement("div");
      lightBand.className = "day-light-strip";
      lightBand.title = "当日光影节奏示意（详见「光影」页精确时刻）";
      body.appendChild(lightBand);

      const list = document.createElement("div");
      list.className = "act-list";
      list.dataset.dayIndex = String(di);
      (day.activities || []).forEach((act, ai) => {
        list.appendChild(activityRow(t, day, act, ai, di, conflicts.has(ai)));
      });
      bindActListDnD(list, t, di);
      body.appendChild(list);

      const dayNote = document.createElement("textarea");
      dayNote.className = "day-note";
      dayNote.placeholder = "这一天的备注：集合点、预约号、避雷…";
      dayNote.value = day.note || "";
      dayNote.addEventListener("click", (e) => e.stopPropagation());
      dayNote.addEventListener("input", () => {
        day.note = dayNote.value;
        touch(t);
      });
      body.appendChild(dayNote);

      const qe = document.createElement("div");
      qe.className = "day-quick-expense";
      qe.innerHTML =
        '<span class="hint-text" style="margin:0">快捷记账</span>' +
        '<input type="number" min="0" step="1" placeholder="金额" class="qe-amt" style="width:88px" />' +
        '<input type="text" placeholder="说明" class="qe-note" style="width:120px" />' +
        '<select class="qe-cat"><option>餐饮</option><option>交通</option><option>门票</option><option>购物</option><option>其他</option></select>' +
        '<button type="button" class="btn btn-primary btn-sm qe-go">记入 D' +
        (di + 1) +
        "</button>";
      qe.addEventListener("click", (e) => e.stopPropagation());
      qe.querySelector(".qe-go").addEventListener("click", () => {
        const amount = Number(qe.querySelector(".qe-amt").value) || 0;
        const note = qe.querySelector(".qe-note").value.trim();
        const category = qe.querySelector(".qe-cat").value;
        if (!amount && !note) {
          toast("填个金额或说明");
          return;
        }
        withUndo(() => {
          if (!t.budget) t.budget = [];
          t.budget.push({
            dayIndex: di,
            category,
            note: note || "D" + (di + 1) + " 花费",
            amount,
            currency: "CNY",
            paid: true,
            payer: "我",
          });
          touch(t);
        });
        qe.querySelector(".qe-amt").value = "";
        qe.querySelector(".qe-note").value = "";
        renderBudget(t);
        renderOverview(t);
        renderSplit(t);
        toast("已记入预算 · D" + (di + 1));
        hapticOk();
      });
      body.appendChild(qe);

      const actions = document.createElement("div");
      actions.className = "day-actions";
      const addAct = document.createElement("button");
      addAct.type = "button";
      addAct.className = "btn btn-ghost btn-sm";
      addAct.textContent = "＋ 加一站";
      addAct.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!day.activities) day.activities = [];
        day.activities.push({ time: "", place: "", note: "" });
        state.openDays[di] = true;
        touch(t);
        renderDays(t);
        renderOverview(t);
      });
      actions.appendChild(addAct);
      body.appendChild(actions);

      card.append(head, body);
      box.appendChild(card);
    });
  }

  function activityRow(t, day, act, ai, di, hasConflict) {
    const row = document.createElement("div");
    row.className =
      "act-row" +
      (hasConflict ? " has-conflict" : "") +
      (act._mapPinned ? " has-map-pin" : "");
    row.draggable = true;
    row.dataset.index = String(ai);

    const handle = document.createElement("span");
    handle.className = "drag-handle";
    handle.title = "拖拽排序";
    handle.textContent = "⋮⋮";
    handle.addEventListener("click", (e) => e.stopPropagation());

    const time = document.createElement("input");
    time.placeholder = "时间";
    time.value = act.time || "";
    time.addEventListener("input", () => {
      act.time = time.value;
      touch(t);
    });
    time.addEventListener("blur", () => {
      if (!window.TravelAstro || !lastAstro) return;
      const r = TravelAstro.snapToMagicHour(time.value, lastAstro, 18);
      if (r.snapped) {
        act.time = r.hm;
        time.value = r.hm;
        touch(t);
        shutterClick();
        toast("已磁吸到「" + r.label + "」" + r.hm);
        renderDays(t);
      }
    });
    const place = document.createElement("input");
    place.placeholder = "地点";
    place.value = act.place || "";
    place.addEventListener("input", () => {
      act.place = place.value;
      // 手改地名后解除地图钉（除非仍是地图点前缀）
      if (act._mapPinned) {
        act._mapPinned = false;
        delete act.lat;
        delete act.lng;
        delete act._geoCity;
      }
      touch(t);
    });
    const note = document.createElement("input");
    note.placeholder = "备注";
    note.value = act.note || "";
    note.addEventListener("input", () => {
      act.note = note.value;
      touch(t);
    });
    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn-icon";
    del.textContent = "×";
    del.addEventListener("click", () => {
      day.activities.splice(ai, 1);
      touch(t);
      renderDays(t);
      renderOverview(t);
      scheduleMapRefresh(true);
    });

    let pinBadge = null;
    if (act._mapPinned && act.lat != null) {
      pinBadge = document.createElement("span");
      pinBadge.className = "act-pin-badge";
      pinBadge.title =
        Number(act.lat).toFixed(5) + ", " + Number(act.lng).toFixed(5);
      pinBadge.textContent = "📌";
    }

    row.addEventListener("dragstart", (e) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", di + ":" + ai);
      e.dataTransfer.setData(
        "application/x-act",
        JSON.stringify({ day: di, index: ai })
      );
      dragState = { fromDay: di, fromIndex: ai };
      row.classList.add("dragging");
      row.dataset.dragging = "1";
      const list = row.parentElement;
      if (list) list.classList.add("drag-active");
      // 跨天时自动展开其它天，方便投放
      const tNow = activeTrip();
      if (tNow && tNow.days) {
        tNow.days.forEach((_, idx) => {
          state.openDays[idx] = true;
        });
        // 不整页重渲染以免中断拖拽；仅给折叠的 body 强制显示
        document.querySelectorAll(".day-card").forEach((c) => c.classList.add("is-open"));
        document.querySelectorAll(".day-body").forEach((b) => {
          b.style.maxHeight = "2000px";
          b.style.padding = "14px 16px 18px";
        });
      }
      hapticLight();
    });
    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
      row.dataset.dragging = "0";
      document.querySelectorAll(".act-row.drag-over").forEach((el) => {
        el.classList.remove("drag-over");
      });
      document.querySelectorAll(".act-list.drag-active, .act-list.is-drop-target").forEach((el) => {
        el.classList.remove("drag-active");
        el.classList.remove("is-drop-target");
      });
      document.querySelectorAll(".day-card.is-drop-day").forEach((el) => {
        el.classList.remove("is-drop-day");
      });
      // 若未成功 drop，用 DOM 同步一次
      if (dragState) {
        const tNow = activeTrip();
        if (tNow) {
          pushUndo();
          syncAllDaysFromDom(tNow);
          touch(tNow);
          renderDays(tNow);
          renderOverview(tNow);
          scheduleMapRefresh(true);
        }
        dragState = null;
      }
    });

    const navBtn = document.createElement("button");
    navBtn.type = "button";
    navBtn.className = "btn-icon act-nav-btn";
    navBtn.title = "在地图中打开导航";
    navBtn.textContent = "↗";
    navBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openNavForActivity(act, day, t);
    });

    // 手柄按下时确保可拖
    handle.addEventListener("mousedown", () => {
      row.draggable = true;
    });
    [time, place, note, navBtn, del].forEach((el) => {
      el.addEventListener("mousedown", () => {
        row.draggable = false;
      });
      el.addEventListener("mouseup", () => {
        row.draggable = true;
      });
    });

    if (pinBadge) row.append(handle, time, place, pinBadge, note, navBtn, del);
    else row.append(handle, time, place, note, navBtn, del);

    // 时间拨轮 + 机位坐标：常驻
    const dial = document.createElement("input");
    dial.type = "range";
    dial.className = "act-time-dial";
    dial.min = "0";
    dial.max = "1439";
    dial.value = String(
      window.TravelAstro && TravelAstro.parseHM(act.time) != null
        ? TravelAstro.parseHM(act.time)
        : 1110
    );
    dial.title = "拨轮改时间（近黄金/蓝调会吸附）";
    dial.addEventListener("pointerdown", (e) => e.stopPropagation());
    dial.addEventListener("input", () => {
      if (!window.TravelAstro) return;
      const hm = TravelAstro.minutesToHM(Number(dial.value));
      act.time = hm;
      time.value = hm;
      hapticLight();
    });
    dial.addEventListener("change", () => {
      if (window.TravelAstro && lastAstro) {
        const r = TravelAstro.snapToMagicHour(act.time, lastAstro, 15);
        if (r.snapped) {
          act.time = r.hm;
          time.value = r.hm;
          dial.value = String(TravelAstro.parseHM(r.hm) ?? dial.value);
          toast("拨轮吸附 · " + r.label);
        }
      }
      touch(t);
      shutterClick();
    });

    const gps = document.createElement("div");
    gps.className = "act-gps";
    gps.innerHTML =
      '<input type="number" step="0.00001" placeholder="纬度 lat" class="g-lat" />' +
      '<input type="number" step="0.00001" placeholder="经度 lng" class="g-lng" />' +
      '<button type="button" class="btn btn-ghost btn-sm g-clear">清坐标</button>';
    const latIn = gps.querySelector(".g-lat");
    const lngIn = gps.querySelector(".g-lng");
    latIn.value = act.lat != null && act.lat !== "" ? act.lat : "";
    lngIn.value = act.lng != null && act.lng !== "" ? act.lng : "";
    latIn.addEventListener("change", () => {
      act.lat = latIn.value === "" ? null : Number(latIn.value);
      touch(t);
      scheduleMapRefresh(true);
    });
    lngIn.addEventListener("change", () => {
      act.lng = lngIn.value === "" ? null : Number(lngIn.value);
      touch(t);
      scheduleMapRefresh(true);
    });
    gps.querySelector(".g-clear").addEventListener("click", (e) => {
      e.stopPropagation();
      act.lat = null;
      act.lng = null;
      latIn.value = "";
      lngIn.value = "";
      touch(t);
      scheduleMapRefresh(true);
    });
    [dial, gps].forEach((el) => {
      el.addEventListener("mousedown", () => {
        row.draggable = false;
      });
      el.addEventListener("mouseup", () => {
        row.draggable = true;
      });
    });
    row.append(dial, gps);

    return row;
  }

  function bindActListDnD(list, t, dayIndex) {
    const dayCard = list.closest(".day-card");

    list.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      list.classList.add("is-drop-target");
      if (dayCard) dayCard.classList.add("is-drop-day");

      // 跨 Day：把正在拖的节点接到本列表
      const dragging =
        document.querySelector(".act-row.dragging") ||
        document.querySelector(".act-row[data-dragging='1']");
      if (!dragging) return;

      const after = getDragAfterElement(list, e.clientY);
      list.querySelectorAll(".act-row.drag-over").forEach((el) => {
        el.classList.remove("drag-over");
      });
      if (after == null) {
        list.appendChild(dragging);
      } else {
        after.classList.add("drag-over");
        list.insertBefore(dragging, after);
      }
    });

    list.addEventListener("dragleave", (e) => {
      if (!list.contains(e.relatedTarget)) {
        list.classList.remove("is-drop-target");
        if (dayCard) dayCard.classList.remove("is-drop-day");
      }
    });

    list.addEventListener("drop", (e) => {
      e.preventDefault();
      list.classList.remove("is-drop-target");
      if (dayCard) dayCard.classList.remove("is-drop-day");

      pushUndo();
      if (!dragState) {
        syncAllDaysFromDom(t);
      } else {
        applyCrossDayDrop(t, dayIndex, list);
      }
      dragState = null;
      touch(t);
      hapticOk();
      toast("已更新 · 跨天磁吸完成");
      renderDays(t);
      renderOverview(t);
      scheduleMapRefresh(true);
    });
  }

  function readActFromRow(row) {
    const inputs = row.querySelectorAll("input");
    return {
      time: inputs[0] ? inputs[0].value : "",
      place: inputs[1] ? inputs[1].value : "",
      note: inputs[2] ? inputs[2].value : "",
    };
  }

  /** 从所有 .act-list 的 DOM 顺序重建各天 activities（跨天拖后的权威来源） */
  function syncAllDaysFromDom(t) {
    document.querySelectorAll(".act-list[data-day-index]").forEach((list) => {
      const di = Number(list.dataset.dayIndex);
      if (!t.days[di]) return;
      t.days[di].activities = [...list.querySelectorAll(".act-row")].map(readActFromRow);
    });
  }

  function applyCrossDayDrop(t, toDayIndex, list) {
    // 权威：整页 DOM 同步（拖拽时节点已插入目标列表）
    syncAllDaysFromDom(t);
    // 确保目标天展开
    state.openDays[toDayIndex] = true;
    if (dragState && dragState.fromDay !== toDayIndex) {
      state.openDays[dragState.fromDay] = true;
    }
  }

  function getDragAfterElement(container, y) {
    const els = [...container.querySelectorAll(".act-row:not(.dragging)")];
    return els.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          return { offset, element: child };
        }
        return closest;
      },
      { offset: Number.NEGATIVE_INFINITY, element: null }
    ).element;
  }

  function miniBtn(text, title, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn-icon";
    b.title = title;
    b.textContent = text;
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick();
    });
    return b;
  }

  function moveDay(t, di, delta) {
    const nj = di + delta;
    if (nj < 0 || nj >= t.days.length) return;
    withUndo(() => {
      const arr = t.days;
      const tmp = arr[di];
      arr[di] = arr[nj];
      arr[nj] = tmp;
      touch(t);
    });
    const open = { ...state.openDays };
    state.openDays = {};
    Object.keys(open).forEach((k) => {
      const i = Number(k);
      if (i === di) state.openDays[nj] = open[k];
      else if (i === nj) state.openDays[di] = open[k];
      else state.openDays[i] = open[k];
    });
    renderDays(t);
    renderOverview(t);
    scheduleMapRefresh(true);
    toast(delta < 0 ? "已上移" : "已下移");
  }

  function duplicateDay(t, di) {
    withUndo(() => {
      const src = t.days[di];
      const copy = JSON.parse(JSON.stringify(src));
      copy.title = (copy.title || "Day") + " · 副本";
      t.days.splice(di + 1, 0, copy);
      touch(t);
    });
    state.openDays[di + 1] = true;
    renderDays(t);
    renderOverview(t);
    scheduleMapRefresh(true);
    toast("已复制这一天");
  }

  async function optimizeDay(t, di) {
    if (!window.TravelMap || !window.TravelGeo) {
      toast("优化模块未就绪");
      return;
    }
    const day = t.days[di];
    if (!day || !day.activities || day.activities.length < 3) {
      toast("至少 3 站才值得优化");
      return;
    }
    toast("优化本日路线…");
    const dest = dayCityOf(t, day) || primaryCity(t) || "";
    const pts = [];
    for (const act of day.activities) {
      const name = TravelMap.cleanPlaceName(act.place);
      if (!name) {
        pts.push(null);
        continue;
      }
      pts.push(await TravelMap.geocode(name, dest));
    }
    pushUndo();
    const ordered = TravelGeo.nearestNeighborOrder(day.activities, (_, i) => pts[i]);
    const style = t.style || "balanced";
    const meta =
      (window.TravelGenerator && TravelGenerator.STYLE_META[style]) || {
        start: "09:30",
        gap: 120,
      };
    day.activities = TravelGeo.retimeActivities(ordered, meta.start, meta.gap);
    touch(t);
    renderDays(t);
    renderOverview(t);
    scheduleMapRefresh(true);
    if (window.TravelLottie) TravelLottie.playSuccessOverlay();
    hapticOk();
    toast("本日已按最近邻重排并重排时间");
  }

  async function optimizeAllDays(t) {
    if (!t || !t.days) return;
    pushUndo();
    toast("正在优化全部日…");
    for (let di = 0; di < t.days.length; di++) {
      const day = t.days[di];
      if (!day.activities || day.activities.length < 3) continue;
      const dest = dayCityOf(t, day) || primaryCity(t) || "";
      const pts = [];
      for (const act of day.activities) {
        const name = TravelMap.cleanPlaceName(act.place);
        pts.push(name ? await TravelMap.geocode(name, dest) : null);
      }
      const ordered = TravelGeo.nearestNeighborOrder(day.activities, (_, i) => pts[i]);
      const meta =
        (window.TravelGenerator && TravelGenerator.STYLE_META[t.style || "balanced"]) || {
          start: "09:30",
          gap: 120,
        };
      day.activities = TravelGeo.retimeActivities(ordered, meta.start, meta.gap);
    }
    touch(t);
    renderDays(t);
    renderOverview(t);
    scheduleMapRefresh(true);
    if (window.TravelLottie) TravelLottie.playSuccessOverlay();
    toast("全部日路线已优化");
  }

  async function updateRouteStats(t) {
    const legend = $("map-legend");
    const list = $("day-km-list");
    const hint = $("route-km-hint");
    if (!t || !window.TravelMap) return;
    try {
      const stats = await TravelMap.resolveTripPoints(t);
      if (legend) {
        legend.textContent =
          "约 " + (stats.totalKm ? stats.totalKm.toFixed(1) : "—") + " km · OSM";
      }
      if (list) {
        list.innerHTML = (stats.dayKm || [])
          .map(
            (km, i) =>
              `<span class="day-km-pill">D${i + 1} · ${km ? km.toFixed(1) : "—"} km</span>`
          )
          .join("");
      }
      if (hint) {
        hint.textContent =
          "全程约 " +
          (stats.totalKm ? stats.totalKm.toFixed(1) : "—") +
          " km · ⋮⋮ 可跨天拖 · ◎ 优化单日";
      }
    } catch (_) {}
  }

  function payerOptions(t, selected) {
    const names = ["", "我"].concat(t.companions || []);
    const unique = [...new Set(names)];
    return unique
      .map((n) => {
        const label = n || "（未指定）";
        const sel = n === (selected || "") ? " selected" : "";
        return `<option value="${escapeHtml(n)}"${sel}>${escapeHtml(label)}</option>`;
      })
      .join("");
  }

  function dayOptions(t, selected) {
    const n = (t.days && t.days.length) || dayCount(t.startDate, t.endDate) || 0;
    let html = '<option value="">全程</option>';
    for (let i = 0; i < Math.max(n, 0); i++) {
      const v = String(i);
      const sel = String(selected) === v ? " selected" : "";
      html += `<option value="${v}"${sel}>D${i + 1}</option>`;
    }
    return html;
  }

  function renderBudgetCharts(t) {
    const catEl = $("budget-chart-cat");
    const dayEl = $("budget-chart-day");
    if (!catEl || !dayEl) return;

    const byCat = {};
    const byDay = {};
    let total = 0;
    (t.budget || []).forEach((b) => {
      const cny = toCNY(b.amount, b.currency);
      total += cny;
      const cat = b.category || "其他";
      byCat[cat] = (byCat[cat] || 0) + cny;
      const dKey =
        b.dayIndex === 0 || b.dayIndex
          ? "D" + (Number(b.dayIndex) + 1)
          : "全程";
      byDay[dKey] = (byDay[dKey] || 0) + cny;
    });

    const maxCat = Math.max(1, ...Object.values(byCat), 1);
    const maxDay = Math.max(1, ...Object.values(byDay), 1);

    if (!total) {
      catEl.innerHTML = '<span class="hint-text">记几笔账后这里会出现柱状分布</span>';
      dayEl.innerHTML = "";
      return;
    }

    catEl.innerHTML = Object.keys(byCat)
      .sort((a, b) => byCat[b] - byCat[a])
      .map((k) => {
        const pct = Math.round((byCat[k] / maxCat) * 100);
        return `<div class="bar-row">
          <span class="bar-label">${escapeHtml(k)}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
          <span class="bar-val">¥${formatMoney(byCat[k])}</span>
        </div>`;
      })
      .join("");

    // 按 D1..Dn 顺序 + 全程
    const dayKeys = Object.keys(byDay).sort((a, b) => {
      if (a === "全程") return 1;
      if (b === "全程") return -1;
      return Number(a.slice(1)) - Number(b.slice(1));
    });
    dayEl.innerHTML = dayKeys
      .map((k) => {
        const pct = Math.round((byDay[k] / maxDay) * 100);
        return `<div class="bar-row">
          <span class="bar-label">${escapeHtml(k)}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
          <span class="bar-val">¥${formatMoney(byDay[k])}</span>
        </div>`;
      })
      .join("");
  }

  function renderBudget(t) {
    const tbody = $("budget-tbody");
    tbody.innerHTML = "";
    let sum = 0;
    (t.budget || []).forEach((b, i) => {
      sum += toCNY(b.amount, b.currency);
      const tr = document.createElement("tr");

      const tdDay = document.createElement("td");
      const daySel = document.createElement("select");
      daySel.innerHTML = dayOptions(t, b.dayIndex === 0 || b.dayIndex ? b.dayIndex : "");
      daySel.addEventListener("change", () => {
        b.dayIndex = daySel.value === "" ? "" : Number(daySel.value);
        touch(t);
        renderBudgetCharts(t);
      });
      tdDay.appendChild(daySel);

      const tdCat = document.createElement("td");
      const sel = document.createElement("select");
      BUDGET_CATS.forEach((c) => {
        const o = document.createElement("option");
        o.value = c;
        o.textContent = c;
        if (b.category === c) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener("change", () => {
        b.category = sel.value;
        touch(t);
        renderBudgetCharts(t);
      });
      tdCat.appendChild(sel);

      const tdNote = document.createElement("td");
      const note = document.createElement("input");
      note.value = b.note || "";
      note.placeholder = "烧肉 / 地铁…";
      note.addEventListener("input", () => {
        b.note = note.value;
        touch(t);
      });
      tdNote.appendChild(note);

      const tdAmt = document.createElement("td");
      const amt = document.createElement("input");
      amt.type = "number";
      amt.min = "0";
      amt.step = "0.01";
      amt.value = b.amount != null ? b.amount : "";
      amt.addEventListener("input", () => {
        b.amount = Number(amt.value) || 0;
        touch(t);
        renderBudget(t);
        renderOverview(t);
        renderSplit(t);
      });
      tdAmt.appendChild(amt);

      const tdCur = document.createElement("td");
      const cur = document.createElement("select");
      CURRENCIES.forEach((c) => {
        const o = document.createElement("option");
        o.value = c;
        o.textContent = c;
        if ((b.currency || "CNY") === c) o.selected = true;
        cur.appendChild(o);
      });
      cur.addEventListener("change", () => {
        b.currency = cur.value;
        touch(t);
        renderBudget(t);
        renderOverview(t);
        renderSplit(t);
      });
      tdCur.appendChild(cur);

      const tdPayer = document.createElement("td");
      const payer = document.createElement("select");
      payer.innerHTML = payerOptions(t, b.payer || "");
      payer.addEventListener("change", () => {
        b.payer = payer.value;
        touch(t);
        renderSplit(t);
      });
      tdPayer.appendChild(payer);

      const tdPaid = document.createElement("td");
      const paid = document.createElement("input");
      paid.type = "checkbox";
      paid.checked = !!b.paid;
      paid.addEventListener("change", () => {
        b.paid = paid.checked;
        touch(t);
      });
      tdPaid.appendChild(paid);

      const tdDel = document.createElement("td");
      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn-icon";
      del.textContent = "×";
      del.addEventListener("click", () => {
        t.budget.splice(i, 1);
        touch(t);
        renderBudget(t);
        renderOverview(t);
        renderSplit(t);
      });
      tdDel.appendChild(del);

      tr.append(tdDay, tdCat, tdNote, tdAmt, tdCur, tdPayer, tdPaid, tdDel);
      tbody.appendChild(tr);
    });
    $("budget-total").textContent = "¥" + formatMoney(sum);
    renderBudgetCharts(t);
  }

  function seedBudgetByDays(t) {
    withUndo(() => {
      if (!t.budget) t.budget = [];
      const n = Math.max(
        1,
        (t.days && t.days.length) || dayCount(t.startDate, t.endDate) || 3
      );
      const perDayFood = 150;
      const perDayTicket = 80;
      for (let i = 0; i < n; i++) {
        t.budget.push({
          dayIndex: i,
          category: "餐饮",
          note: "D" + (i + 1) + " 餐饮预估",
          amount: perDayFood,
          currency: "CNY",
          paid: false,
          payer: "我",
        });
        t.budget.push({
          dayIndex: i,
          category: "门票",
          note: "D" + (i + 1) + " 门票预估",
          amount: perDayTicket,
          currency: "CNY",
          paid: false,
          payer: "我",
        });
      }
      t.budget.push({
        dayIndex: "",
        category: "交通",
        note: "城际 / 市内交通预估",
        amount: 400,
        currency: "CNY",
        paid: false,
        payer: "我",
      });
      t.budget.push({
        dayIndex: "",
        category: "住宿",
        note: "住宿预估",
        amount: 350 * Math.max(1, n - 1),
        currency: "CNY",
        paid: false,
        payer: "我",
      });
      touch(t);
    });
    renderBudget(t);
    renderOverview(t);
    renderSplit(t);
    toast("已按天数生成预算骨架，可改金额");
  }

  function renderPackSuggestions(t) {
    const box = $("pack-suggest-tags");
    const hint = $("pack-weather-hint");
    if (!box) return;
    const days = lastWeatherDays || t._weatherDays;
    if (!window.TravelPackSmart || !days) {
      box.innerHTML = "";
      if (hint) hint.textContent = "先到概览拉取天气，再点「按天气加建议」";
      return;
    }
    const flags = TravelPackSmart.analyzeWeather(days);
    const list = TravelPackSmart.suggestionsFromWeather(flags, t.style || "balanced");
    const reasons = [];
    if (flags.rain) reasons.push("有雨");
    if (flags.hot) reasons.push("偏热");
    if (flags.cold) reasons.push("偏冷");
    if (flags.snow) reasons.push("有雪");
    const citySet = [];
    days.forEach((d) => {
      if (d.city && !citySet.includes(d.city)) citySet.push(d.city);
    });
    if (hint) {
      const base = reasons.length
        ? "天气信号：" + reasons.join(" · ")
        : "天气平稳，仍可按偏好补充";
      hint.textContent =
        citySet.length > 1 ? base + "（综合 " + citySet.join("、") + "）" : base;
    }
    box.innerHTML = list
      .map((it) => {
        const exists = (t.pack || []).some((p) => p.name === it.name);
        return `<button type="button" class="suggest-tag${exists ? " added" : ""}" data-name="${escapeHtml(
          it.name
        )}" data-cat="${escapeHtml(it.cat)}" title="${escapeHtml(it.reason)}">${escapeHtml(
          it.name
        )} · ${escapeHtml(it.reason)}</button>`;
      })
      .join("");
    box.querySelectorAll(".suggest-tag:not(.added)").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!t.pack) t.pack = [];
        const name = btn.getAttribute("data-name");
        const cat = btn.getAttribute("data-cat");
        if (t.pack.some((p) => p.name === name)) return;
        withUndo(() => {
          t.pack.push({ name, cat, done: false });
          touch(t);
        });
        renderPack(t);
        renderOverview(t);
        renderPackSuggestions(t);
        hapticLight();
        toast("已加入行李：" + name);
      });
    });
  }

  function applyWeatherPack(t) {
    const days = lastWeatherDays || t._weatherDays;
    if (!days || !window.TravelPackSmart) {
      toast("请先在概览刷新天气");
      return;
    }
    const list = TravelPackSmart.suggestionsFromWeather(
      TravelPackSmart.analyzeWeather(days),
      t.style || "balanced"
    );
    if (!t.pack) t.pack = [];
    let added = 0;
    withUndo(() => {
      list.forEach((it) => {
        if (!t.pack.some((p) => p.name === it.name)) {
          t.pack.push({ name: it.name, cat: it.cat, done: false });
          added++;
        }
      });
      touch(t);
    });
    renderPack(t);
    renderOverview(t);
    renderPackSuggestions(t);
    toast(added ? `已按天气加入 ${added} 项` : "建议项都已在清单里");
  }

  function renderBubbles(t) {
    const stage = $("bubble-stage");
    stage.innerHTML = "";
    const members = ["我"].concat(t.companions || []);
    const unique = [...new Set(members.filter(Boolean))];
    if (!unique.length) {
      stage.innerHTML = '<span class="hint-text">泡泡还在睡觉</span>';
      return;
    }
    unique.forEach((name, idx) => {
      const b = document.createElement("div");
      b.className = "bubble";
      b.style.animationDelay = -idx * 0.7 + "s";
      b.textContent = name.length > 3 ? name.slice(0, 3) : name;
      b.title = name;
      if (name !== "我") {
        const x = document.createElement("button");
        x.type = "button";
        x.className = "bubble-x";
        x.textContent = "×";
        x.addEventListener("click", (e) => {
          e.stopPropagation();
          t.companions = (t.companions || []).filter((c) => c !== name);
          touch(t);
          renderBubbles(t);
          renderBudget(t);
          renderSplit(t);
          hapticLight();
        });
        b.appendChild(x);
      }
      stage.appendChild(b);
    });
  }

  function renderSplit(t) {
    renderBubbles(t);
    const box = $("split-result");
    const members = ["我"].concat(t.companions || []);
    const uniqueMembers = [...new Set(members.filter(Boolean))];
    if (uniqueMembers.length < 2) {
      box.innerHTML = '<div class="flow-arrow">至少两个泡泡，钱才知道往哪流。</div>';
      return;
    }
    const paid = {};
    uniqueMembers.forEach((m) => {
      paid[m] = 0;
    });
    let total = 0;
    (t.budget || []).forEach((b) => {
      const cny = toCNY(b.amount, b.currency);
      total += cny;
      const payer = b.payer && paid[b.payer] !== undefined ? b.payer : "我";
      if (paid[payer] === undefined) paid[payer] = 0;
      paid[payer] += cny;
    });
    if (total <= 0) {
      box.innerHTML = '<div class="flow-arrow">先去预算页「啵」一笔账。</div>';
      return;
    }
    const fair = total / uniqueMembers.length;
    const balance = {};
    uniqueMembers.forEach((m) => {
      balance[m] = (paid[m] || 0) - fair;
    });
    const debtors = uniqueMembers
      .filter((m) => balance[m] < -0.01)
      .map((m) => ({ m, v: -balance[m] }))
      .sort((a, b) => b.v - a.v);
    const creditors = uniqueMembers
      .filter((m) => balance[m] > 0.01)
      .map((m) => ({ m, v: balance[m] }))
      .sort((a, b) => b.v - a.v);

    const lines = [];
    lines.push(
      `<div class="flow-arrow">总池 <strong>¥${formatMoney(total)}</strong> · 人均 <strong>¥${formatMoney(
        fair
      )}</strong></div>`
    );
    uniqueMembers.forEach((m) => {
      lines.push(
        `<div class="flow-arrow">${escapeHtml(m)} 垫付 ¥${formatMoney(
          paid[m] || 0
        )} · 差额 ${balance[m] >= 0 ? "+" : ""}¥${formatMoney(balance[m])}</div>`
      );
    });

    let i = 0;
    let j = 0;
    const transfers = [];
    while (i < debtors.length && j < creditors.length) {
      const pay = Math.min(debtors[i].v, creditors[j].v);
      if (pay > 0.01) {
        transfers.push(
          `<div class="flow-arrow"><span>${escapeHtml(debtors[i].m)}</span> <span class="arrow">——→</span> <span>${escapeHtml(
            creditors[j].m
          )}</span>　<strong>¥${formatMoney(pay)}</strong></div>`
        );
      }
      debtors[i].v -= pay;
      creditors[j].v -= pay;
      if (debtors[i].v < 0.01) i++;
      if (creditors[j].v < 0.01) j++;
    }
    if (!transfers.length) {
      lines.push('<div class="flow-arrow">结清啦，啵一声。</div>');
    } else {
      lines.push('<div class="flow-arrow"><strong>流向</strong></div>');
      lines.push(...transfers);
    }
    box.innerHTML = lines.join("");
  }

  function renderPack(t) {
    renderPackSuggestions(t);
    const ul = $("pack-list");
    ul.innerHTML = "";
    (t.pack || []).forEach((p, i) => {
      const li = document.createElement("li");
      li.className = "pack-item" + (p.done ? " done" : "");
      const chk = document.createElement("input");
      chk.type = "checkbox";
      chk.checked = !!p.done;
      chk.addEventListener("change", () => {
        p.done = chk.checked;
        touch(t);
        renderPack(t);
        renderOverview(t);
        hapticLight();
      });
      const name = document.createElement("input");
      name.type = "text";
      name.className = "pack-name";
      name.value = p.name || "";
      name.placeholder = "物品";
      name.addEventListener("input", () => {
        p.name = name.value;
        touch(t);
      });
      const cat = document.createElement("select");
      ["证件", "衣物", "数码", "日用", "健康", "其他"].forEach((c) => {
        const o = document.createElement("option");
        o.value = c;
        o.textContent = c;
        if (p.cat === c) o.selected = true;
        cat.appendChild(o);
      });
      cat.addEventListener("change", () => {
        p.cat = cat.value;
        touch(t);
      });
      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn-icon";
      del.textContent = "×";
      del.addEventListener("click", () => {
        t.pack.splice(i, 1);
        touch(t);
        renderPack(t);
        renderOverview(t);
      });
      li.append(chk, name, cat, del);
      ul.appendChild(li);
    });
  }

  function renderRates() {
    ["USD", "EUR", "JPY", "HKD"].forEach((c) => {
      const el = $("rate-" + c);
      if (el) el.value = state.rates[c];
    });
  }

  function renderAll() {
    renderTripList();
    showView();
    renderRates();
    const t = activeTrip();
    if (!t) return;
    if (!t.companions) t.companions = [];
    renderOverview(t);
    renderDays(t);
    renderBudget(t);
    renderSplit(t);
    renderPack(t);
    // 摄影相关面板数据常驻刷新
    fillLightDaySelect(t);
    renderGear();
    updateLensUI();
  }

  // ---------- 摄影：光影 / 装备 / 镜头 / 搭子 ----------
  function fillLightDaySelect(t) {
    const sel = $("light-day-select");
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = "";
    (t.days || []).forEach((d, i) => {
      const o = document.createElement("option");
      o.value = d.date || t.startDate || "";
      o.textContent = "D" + (i + 1) + (d.date ? " · " + d.date : "");
      o.dataset.dayIndex = String(i);
      sel.appendChild(o);
    });
    if (!sel.options.length && t.startDate) {
      const o = document.createElement("option");
      o.value = t.startDate;
      o.textContent = t.startDate;
      sel.appendChild(o);
    }
    if (prev) sel.value = prev;
  }

  async function refreshLightPanel() {
    const t = activeTrip();
    if (!t || !window.TravelAstro || !window.TravelMap) return;
    fillLightDaySelect(t);
    const dateStr = ($("light-day-select") && $("light-day-select").value) || t.startDate;
    if (!dateStr) {
      toast("请先设置日期");
      return;
    }
    // 光影按选中日的城市，否则首城
    let lightCity = primaryCity(t) || t.destination || "东京";
    const selDay = (t.days || []).find((d) => d.date === dateStr);
    if (selDay && selDay.city) lightCity = selDay.city;
    let latlng = TravelMap.cityCenter(lightCity);
    try {
      const pt = await TravelMap.geocode(lightCity, "");
      if (pt) latlng = pt;
    } catch (_) {}

    const events = TravelAstro.solarEvents(latlng[0], latlng[1], dateStr);
    lastAstro = events;
    renderMagicStrip(events);

    const atm = window.TravelPhotoExtra
      ? await TravelPhotoExtra.fetchPhotoAtmosphere(latlng[0], latlng[1], dateStr)
      : null;
    const box = $("light-atmosphere");
    if (box) {
      const fire = atm
        ? TravelPhotoExtra.fireCloudHint(atm.evening)
        : "云量数据不可用";
      const pol = TravelPhotoExtra
        ? TravelPhotoExtra.lightPollutionHint(lightCity)
        : { text: "" };
      const ev = (atm && atm.evening) || {};
      const month = Number(dateStr.slice(5, 7));
      const gal = TravelAstro.galaxySeasonTip(latlng[0], month);
      box.innerHTML = `
        <div class="atm-row">傍晚窗云量：总 ${ev.cloud != null ? ev.cloud + "%" : "—"} · 高云 ${
          ev.high != null ? ev.high + "%" : "—"
        } · 中 ${ev.mid != null ? ev.mid + "%" : "—"} · 低 ${
          ev.low != null ? ev.low + "%" : "—"
        }</div>
        <div class="atm-row">能见度（傍晚均）：${
          ev.vis != null ? Math.round(ev.vis / 1000) + " km" : "—"
        }</div>
        <div class="atm-row">火烧云判断：${escapeHtml(fire)}</div>
        <div class="atm-row">光污染提示：${escapeHtml(pol.text || "—")}</div>
        <div class="atm-row">银河季（规则提示·${escapeHtml(gal.level)}）：${escapeHtml(
          gal.text
        )}</div>
      `;
    }

    const safety = $("safety-box");
    if (safety && window.TravelPhotoExtra) {
      const hm = events ? TravelAstro.toMinutes(events.sunset) + 60 : 22 * 60;
      const hints = TravelPhotoExtra.safetyHints(lightCity, hm);
      safety.innerHTML = hints
        .map(
          (h) =>
            `<div class="safety-item ${escapeHtml(h.level)}">${escapeHtml(h.text)}</div>`
        )
        .join("");
    }
  }

  function renderMagicStrip(events) {
    const strip = $("magic-strip");
    const labels = $("magic-labels");
    if (!strip || !labels) return;
    strip.innerHTML = "";
    if (!events) {
      labels.innerHTML = '<span class="hint-text">无法计算该日太阳事件（可能极昼/极夜或日期无效）</span>';
      return;
    }
    const marks = [
      { d: events.sunrise, name: "日出 " + TravelAstro.fmtHM(events.sunrise) },
      { d: events.sunset, name: "日落 " + TravelAstro.fmtHM(events.sunset) },
    ];
    events.golden.forEach((g) => {
      marks.push({ d: g.start, name: g.name + " " + TravelAstro.fmtHM(g.start) });
    });
    events.blue.forEach((g) => {
      marks.push({ d: g.start, name: g.name + " " + TravelAstro.fmtHM(g.start) });
    });
    marks.forEach((m) => {
      const min = TravelAstro.toMinutes(m.d);
      const pct = (min / 1440) * 100;
      const tick = document.createElement("div");
      tick.className = "tick";
      tick.style.left = pct + "%";
      const lab = document.createElement("div");
      lab.className = "tick-label";
      lab.style.left = pct + "%";
      lab.textContent = TravelAstro.fmtHM(m.d);
      strip.appendChild(tick);
      strip.appendChild(lab);
    });
    labels.innerHTML = [
      ...events.golden.map(
        (g) =>
          `<span class="magic-chip golden">${escapeHtml(g.name)} ${TravelAstro.fmtHM(
            g.start
          )}–${TravelAstro.fmtHM(g.end)}</span>`
      ),
      ...events.blue.map(
        (g) =>
          `<span class="magic-chip blue">${escapeHtml(g.name)} ${TravelAstro.fmtHM(
            g.start
          )}–${TravelAstro.fmtHM(g.end)}</span>`
      ),
      `<span class="magic-chip">日出 ${TravelAstro.fmtHM(events.sunrise)}</span>`,
      `<span class="magic-chip">日落 ${TravelAstro.fmtHM(events.sunset)}</span>`,
    ].join("");
  }

  function snapAllToMagic() {
    const t = activeTrip();
    if (!t || !lastAstro || !window.TravelAstro) {
      toast("请先刷新光影时刻");
      return;
    }
    let n = 0;
    withUndo(() => {
      (t.days || []).forEach((day) => {
        (day.activities || []).forEach((act) => {
          // 优先吸附「拍摄向」站点；其余站点在一键时仍处理末站黄金窗
          const isShoot = /拍|摄|机位|铁塔|塔|夜景|星|银河|落日|日出/i.test(
            (act.place || "") + (act.note || "")
          );
          if (!isShoot) return;
          const r = TravelAstro.snapToMagicHour(act.time || "18:00", lastAstro, 45);
          if (r.snapped && r.hm !== act.time) {
            act.time = r.hm;
            if (act.note && !act.note.includes(r.label)) {
              act.note = (act.note ? act.note + " · " : "") + r.label;
            } else if (!act.note) {
              act.note = r.label + "机位";
            }
            n++;
          }
        });
      });
      // 更积极：每个 day 的最后一个有地点的活动吸附到傍晚黄金中点
      (t.days || []).forEach((day) => {
        const acts = day.activities || [];
        const last = [...acts].reverse().find((a) => (a.place || "").trim());
        if (!last || !lastAstro.golden[1]) return;
        const mid = Math.round(
          (TravelAstro.toMinutes(lastAstro.golden[1].start) +
            TravelAstro.toMinutes(lastAstro.golden[1].end)) /
            2
        );
        last.time = TravelAstro.minutesToHM(mid);
        n++;
      });
      touch(t);
    });
    shutterClick();
    renderDays(t);
    scheduleMapRefresh(true);
    toast(n ? `已吸附 ${n} 处光影时刻` : "没有可吸附的站点");
  }

  function renderGear() {
    const box = $("gear-list");
    if (!box || !window.TravelGear) return;
    if (!gearList.length) {
      gearList = TravelGear.DEFAULT_GEAR.map((g) => Object.assign({}, g, { on: true }));
    }
    box.innerHTML = "";
    gearList.forEach((g, i) => {
      const row = document.createElement("div");
      row.className = "gear-row";
      const on = document.createElement("input");
      on.type = "checkbox";
      on.checked = !!g.on;
      on.addEventListener("change", () => {
        g.on = on.checked;
        save();
        renderGearSummary();
        shutterClick();
      });
      const name = document.createElement("input");
      name.type = "text";
      name.value = g.name || "";
      name.addEventListener("input", () => {
        g.name = name.value;
        save();
      });
      const w = document.createElement("input");
      w.type = "number";
      w.title = "克";
      w.value = g.weight || 0;
      w.addEventListener("input", () => {
        g.weight = Number(w.value) || 0;
        save();
        renderGearSummary();
      });
      const wh = document.createElement("input");
      wh.type = "number";
      wh.title = "Wh";
      wh.value = g.wh || 0;
      wh.addEventListener("input", () => {
        g.wh = Number(wh.value) || 0;
        save();
        renderGearSummary();
      });
      const qty = document.createElement("input");
      qty.type = "number";
      qty.min = "1";
      qty.value = g.qty || 1;
      qty.addEventListener("input", () => {
        g.qty = Math.max(1, Number(qty.value) || 1);
        save();
        renderGearSummary();
      });
      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn-icon";
      del.textContent = "×";
      del.addEventListener("click", () => {
        gearList.splice(i, 1);
        save();
        renderGear();
      });
      row.append(on, name, w, wh, qty, del);
      box.appendChild(row);
    });
    renderGearSummary();
  }

  function renderGearSummary() {
    if (!window.TravelGear) return;
    const s = TravelGear.summarize(gearList);
    const el = $("gear-summary");
    if (el) {
      el.textContent = `摄影包合计约 ${s.weightKg.toFixed(2)} kg · 电池 ${s.wh.toFixed(
        0
      )} Wh`;
    }
    const t = activeTrip();
    const airline = ($("airline-preset") && $("airline-preset").value) || "generic";
    const notes = TravelGear.complianceNotes(
      s.wh,
      s.hasDrone,
      t && t.destination,
      airline
    );
    const box = $("gear-compliance");
    if (box) {
      box.innerHTML = notes
        .map(
          (n) =>
            `<div class="safety-item ${escapeHtml(n.level)}">${escapeHtml(n.text)}</div>`
        )
        .join("");
    }
  }

  function updateLensUI() {
    if (!window.TravelGear) return;
    const sensor = ($("lens-sensor") && $("lens-sensor").value) || "full";
    const focal = Number($("lens-focal") && $("lens-focal").value) || 50;
    const r = TravelGear.fovHorizontal(focal, sensor);
    const wedge = $("fov-wedge");
    const label = $("fov-label");
    // 用 border 宽度近似 FOV（FOV 越大楔形越宽）
    const half = Math.min(120, Math.max(12, r.fovDeg * 1.1));
    if (wedge) {
      wedge.style.borderLeftWidth = half + "px";
      wedge.style.borderRightWidth = half + "px";
    }
    if (label) {
      label.textContent = `${focal}mm（等效 ${r.effFocal.toFixed(
        0
      )}mm）· 水平 FOV ≈ ${r.fovDeg.toFixed(1)}°`;
    }
    const dial = $("lens-time-dial");
    const read = $("lens-time-readout");
    if (dial && read && window.TravelAstro) {
      const hm = TravelAstro.minutesToHM(Number(dial.value) || 0);
      read.textContent = hm;
      const hint = $("sun-align-hint");
      if (hint && lastAstro) {
        const snap = TravelAstro.snapToMagicHour(hm, lastAstro, 25);
        hint.textContent = snap.snapped
          ? `拨轮 ${hm} 接近「${snap.label}」——适合挂在建筑尖顶的黄金/蓝调窗`
          : `拨轮 ${hm} · 刷新光影后可对照日出日落（非 AR 轨迹）`;
      }
    }
  }

  function renderBuddyBoard() {
    const box = $("buddy-board");
    if (!box || !window.TravelPhotoExtra) return;
    const all = TravelPhotoExtra.loadBuddies();
    if (!all.length) {
      box.innerHTML = '<p class="hint-text">搭子板为空，发布一张行程卡片试试。</p>';
      return;
    }
    box.innerHTML = all
      .slice()
      .reverse()
      .map(
        (b) => `<div class="buddy-card">
        <h4>${escapeHtml(b.name || "匿名")} · ${
          b.role === "model" ? "模特" : "摄影师"
        }</h4>
        <div class="buddy-meta">${escapeHtml(b.city || "")} · ${escapeHtml(
          b.start || ""
        )} ~ ${escapeHtml(b.end || "")}<br/>${escapeHtml(b.style || "")}</div>
      </div>`
      )
      .join("");
  }

  const TFP_TEXT = `【TFP / 互惠约拍协议 · 模板】
甲方（摄影师）：________    乙方（模特）：________
拍摄城市/日期：________
用途：作品集、社交媒体、非商业展览（商业使用需另行书面授权）
肖像权：乙方同意甲方在上述用途内使用肖像；甲方尊重乙方合理修改/下架请求。
费用：双方互惠，无劳务报酬；妆造交通自理（可另约）。
安全：双方有权随时中止不适拍摄；禁止未经同意的隐私内容传播。
签名：甲方______ 乙方______ 日期______
（本模板仅供参考，不构成法律意见。）`;

  function applyGenerated(base, gen) {
    Object.assign(base, {
      title: gen.title,
      destination: gen.destination,
      destinations: gen.destinations || [],
      routeMode: gen.routeMode || base.routeMode || "linear",
      startDate: gen.startDate,
      endDate: gen.endDate,
      style: gen.style,
      summary: gen.summary,
      notes: gen.notes,
      days: gen.days,
      budget: gen.budget,
      pack: gen.pack,
      updatedAt: Date.now(),
    });
    normalizeTrip(base);
  }

  /** 向导里点选的城市（顺序保序） */
  let wizPickList = [];

  function syncWizDestFromPicks() {
    const input = $("wiz-dest");
    const preview = $("wiz-dest-preview");
    const path = wizPickList.join(" → ");
    if (input && document.activeElement !== input) {
      // 不覆盖用户正在手写的内容时：仅当手写为空或与 picks 一致时同步
      const cur = (input.value || "").trim();
      if (!cur || cur === path || wizPickList.some((c) => cur === c)) {
        input.value = path;
      }
    } else if (input && !input.value.trim()) {
      input.value = path;
    }
    if (preview) {
      preview.textContent = wizPickList.length
        ? "已选：" +
          path +
          "（" +
          wizPickList.length +
          " 站，再点可重复途经；右键取消最后一次）"
        : "已选：— · 点城市连加站序，例 上海→金华→义乌→金华";
    }
    const grid = $("wiz-dest-pick");
    if (grid) {
      grid.querySelectorAll(".dest-pick-btn").forEach((btn) => {
        const c = btn.dataset.city;
        const n = wizPickList.filter((x) => x === c).length;
        const on = n > 0;
        btn.classList.toggle("is-on", on);
        btn.setAttribute("aria-pressed", on ? "true" : "false");
        btn.textContent = n > 1 ? c + " ×" + n : c;
      });
    }
  }

  function renderWizDestPick() {
    const grid = $("wiz-dest-pick");
    if (!grid) return;
    grid.innerHTML = "";
    knownCityPicks().forEach((city) => {
      const n = wizPickList.filter((x) => x === city).length;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dest-pick-btn" + (n > 0 ? " is-on" : "");
      btn.dataset.city = city;
      btn.textContent = n > 1 ? city + " ×" + n : city;
      btn.setAttribute("aria-pressed", n > 0 ? "true" : "false");
      btn.title = "左键追加；右键取消最后一次 " + city;
      btn.addEventListener("click", () => {
        // 始终追加，允许金华出现两次
        wizPickList.push(city);
        if ($("wiz-dest")) $("wiz-dest").value = wizPickList.join(" → ");
        syncWizDestFromPicks();
      });
      btn.addEventListener("contextmenu", (e) => {
        // 右键：删掉最后一次该城
        e.preventDefault();
        for (let i = wizPickList.length - 1; i >= 0; i--) {
          if (wizPickList[i] === city) {
            wizPickList.splice(i, 1);
            break;
          }
        }
        if ($("wiz-dest")) $("wiz-dest").value = wizPickList.join(" → ");
        syncWizDestFromPicks();
      });
      grid.appendChild(btn);
    });
    syncWizDestFromPicks();
  }

  function openWizard() {
    $("wizard-mask").classList.remove("hidden");
    $("wiz-start").value = fmtDate(new Date());
    if (state.moodStyle) $("wiz-style").value = state.moodStyle;
    wizPickList = [];
    if ($("wiz-dest")) $("wiz-dest").value = "";
    renderWizDestPick();
  }

  function closeWizard() {
    $("wizard-mask").classList.add("hidden");
  }

  function createFromWizard() {
    let dest = ($("wiz-dest") && $("wiz-dest").value.trim()) || "";
    if (!dest && wizPickList.length) dest = wizPickList.join(" → ");
    const days = Number($("wiz-days").value) || 3;
    const style = $("wiz-style").value;
    const start = $("wiz-start").value;
    const people = Math.max(1, Number($("wiz-people").value) || 1);
    const companionsRaw = $("wiz-companions").value.trim();
    const routeMode =
      ($("wiz-route-mode") && $("wiz-route-mode").value) || "linear";
    if (!dest && !wizPickList.length) {
      toast("请点选至少一个城市，或手写 东京→京都");
      return;
    }
    let destinations = wizPickList.slice();
    if (dest && window.TravelGenerator && TravelGenerator.parseDestinations) {
      const parsed = TravelGenerator.parseDestinations({ destination: dest }).filter(
        Boolean
      );
      if (parsed.length) destinations = parsed;
    } else if (dest && !destinations.length) {
      destinations = dest
        .split(/\s*[,，、\/|→～~]\s*|\s*->\s*|\s*到\s*|\s*至\s*/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (!destinations.length) {
      toast("请点选至少一个城市");
      return;
    }
    dest = destinations.join(" → ");
    const gen = TravelGenerator.generateItinerary({
      destination: dest,
      destinations,
      days,
      style,
      startDate: start || undefined,
      routeMode,
    });
    const t = emptyTrip();
    applyGenerated(t, gen);
    t.people = people;
    t.companions = companionsRaw
      ? companionsRaw
          .split(/[,，、]/)
          .map((s) => s.trim())
          .filter((s) => s && s !== "我")
      : [];
    (t.budget || []).forEach((b) => {
      b.payer = "我";
      b.currency = b.currency || "CNY";
    });
    state.trips.unshift(t);
    state.activeId = t.id;
    state.openDays = { 0: true };
    save();
    closeWizard();
    renderAll();
    switchTab("days");
    hapticOk();
    toast("旅程已生成");
  }

  function createBlank() {
    const t = emptyTrip();
    state.trips.unshift(t);
    state.activeId = t.id;
    state.openDays = { 0: true };
    save();
    renderAll();
    switchTab("overview");
    toast("空白画布");
  }

  function regenActive() {
    const t = activeTrip();
    if (!t) return;
    normalizeTrip(t);
    const dests = getDestinations(t);
    if (!dests.length && !t.destination) {
      toast("先添加至少一个目的地城市");
      return;
    }
    if (t.days && t.days.length && !confirm("重抽会覆盖当前日程模板，继续？")) return;
    const days = dayCount(t.startDate, t.endDate) || 3;
    const gen = TravelGenerator.generateItinerary({
      destination: t.destination,
      destinations: dests.length ? dests : undefined,
      days,
      style: t.style || "balanced",
      startDate: t.startDate,
      routeMode: t.routeMode || "linear",
    });
    const companions = t.companions || [];
    const people = t.people;
    const routeMode = t.routeMode || "linear";
    applyGenerated(t, gen);
    t.routeMode = routeMode;
    t.companions = companions;
    t.people = people;
    (t.budget || []).forEach((b) => {
      b.payer = b.payer || "我";
    });
    state.openDays = { 0: true };
    touch(t);
    if (window.TravelLottie) TravelLottie.playSuccessOverlay();
    renderAll();
    switchTab("days");
    hapticOk();
    toast("已重抽");
    scheduleMapRefresh(true);
  }

  function toggleTheme() {
    const cur = document.documentElement.getAttribute("data-theme") || "light";
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
    hapticLight();
  }

  function isSidebarCollapsed() {
    return document.getElementById("app-shell")
      ? document.getElementById("app-shell").classList.contains("sidebar-collapsed")
      : false;
  }

  function setSidebarCollapsed(collapsed) {
    const shell = $("app-shell") || document.querySelector(".app");
    const fab = $("btn-sidebar-expand");
    const btn = $("btn-sidebar-collapse");
    if (!shell) return;
    shell.classList.toggle("sidebar-collapsed", !!collapsed);
    if (fab) fab.classList.toggle("hidden", !collapsed);
    if (btn) {
      btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      btn.title = collapsed ? "展开侧栏" : "收起侧栏";
    }
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
    } catch (_) {}
    // 布局变宽后刷新地图尺寸
    setTimeout(() => {
      if (window.TravelMap && TravelMap.invalidate) TravelMap.invalidate();
      scheduleMapRefresh(true);
    }, 300);
  }

  function toggleSidebar() {
    setSidebarCollapsed(!isSidebarCollapsed());
    hapticLight();
  }

  function downloadJson(obj, filename) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function bindFields() {
    [
      ["trip-title", "title"],
      ["trip-start", "startDate"],
      ["trip-end", "endDate"],
      ["trip-summary", "summary"],
      ["trip-notes", "notes"],
    ].forEach(([id, key]) => {
      $(id).addEventListener("input", () => {
        const t = activeTrip();
        if (!t) return;
        t[key] = $(id).value;
        touch(t);
        if (["title", "startDate"].includes(key)) renderTripList();
        if (key === "startDate" || key === "endDate") renderOverview(t);
      });
    });
    $("trip-people").addEventListener("input", () => {
      const t = activeTrip();
      if (!t) return;
      t.people = Math.max(1, Number($("trip-people").value) || 1);
      touch(t);
    });
    $("trip-style").addEventListener("change", () => {
      const t = activeTrip();
      if (!t) return;
      t.style = $("trip-style").value;
      touch(t);
      renderTripList();
    });

    // 多目的地：添加城市（可连续多选，不会替换已有城市）
    function commitDestInput(fromAuto) {
      const t = activeTrip();
      const input = $("trip-dest-input");
      if (!t || !input) return;
      const raw = input.value.trim();
      if (!raw) return;
      const before = getDestinations(t).length;
      addDestination(t, raw, { quiet: true });
      const after = getDestinations(t).length;
      if (after > before) {
        input.value = "";
        touch(t);
        renderDestChips(t);
        renderTripList();
        weatherCacheKey = "";
        loadWeather(false);
        scheduleMapRefresh(true);
        toast(
          "已加入 · 当前 " + after + " 城" + (fromAuto ? "" : "（可继续点选/添加）")
        );
      } else if (!raw) {
        /* empty */
      }
    }
    if ($("btn-add-dest")) {
      $("btn-add-dest").addEventListener("click", () => commitDestInput(false));
    }
    if ($("trip-dest-input")) {
      $("trip-dest-input").addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commitDestInput(false);
        }
      });
      // 从 datalist 点选后自动加入（不必再按回车）
      $("trip-dest-input").addEventListener("change", () => {
        const v = $("trip-dest-input").value.trim();
        if (!v) return;
        // 单城或带分隔的多城串都尝试加入
        commitDestInput(true);
      });
    }
    document.querySelectorAll('input[name="route-mode"]').forEach((r) => {
      r.addEventListener("change", () => {
        const t = activeTrip();
        if (!t || !r.checked) return;
        t.routeMode = r.value === "loop" ? "loop" : "linear";
        touch(t);
        toast(
          t.routeMode === "loop"
            ? "环线模式：重抽日程时会回到起点城"
            : "线性模式：按城市顺序走完"
        );
      });
    });

    if ($("trip-mood")) {
      $("trip-mood").addEventListener("change", () => {
        const t = activeTrip();
        if (!t) return;
        t.mood = $("trip-mood").value;
        touch(t);
      });
    }
    document.querySelectorAll("#quick-tips input[data-tip]").forEach((inp) => {
      inp.addEventListener("change", () => {
        const t = activeTrip();
        if (!t) return;
        if (!t.tips) t.tips = {};
        t.tips[inp.getAttribute("data-tip")] = inp.checked;
        touch(t);
      });
    });
    ["USD", "EUR", "JPY", "HKD"].forEach((c) => {
      const el = $("rate-" + c);
      if (!el) return;
      el.addEventListener("input", () => {
        state.rates[c] = Number(el.value) || 0;
        save();
        const t = activeTrip();
        if (t) {
          renderBudget(t);
          renderOverview(t);
          renderSplit(t);
        }
      });
    });
  }

  function init() {
    load();
    bindFields();

    $("btn-new-trip").addEventListener("click", () => {
      if (activeTrip()) {
        state.activeId = null;
        save();
        renderAll();
      }
      $("inspire-prompt").focus();
      toast("在首页输入心情，扭一下");
    });
    $("btn-new-trip-empty"); // may not exist
    $("btn-blank-trip").addEventListener("click", createBlank);
    $("btn-inspire").addEventListener("click", runGacha);
    $("inspire-prompt").addEventListener("keydown", (e) => {
      if (e.key === "Enter") runGacha();
    });

    document.querySelectorAll("#mood-chips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        document.querySelectorAll("#mood-chips .chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        state.moodStyle = chip.dataset.style;
        hapticLight();
      });
    });

    $("wiz-cancel").addEventListener("click", closeWizard);
    $("wiz-ok").addEventListener("click", createFromWizard);
    $("wizard-mask").addEventListener("click", (e) => {
      if (e.target === $("wizard-mask")) closeWizard();
    });
    // long-press style: double-click brand open wizard
    const brand = document.querySelector(".brand");
    if (brand) brand.addEventListener("dblclick", openWizard);

    $("btn-theme").addEventListener("click", toggleTheme);

    // 左侧栏收起 / 展开
    if ($("btn-sidebar-collapse")) {
      $("btn-sidebar-collapse").addEventListener("click", (e) => {
        e.stopPropagation();
        setSidebarCollapsed(true);
        hapticLight();
      });
    }
    if ($("btn-sidebar-expand")) {
      $("btn-sidebar-expand").addEventListener("click", () => {
        setSidebarCollapsed(false);
        hapticLight();
      });
    }
    // 恢复上次侧栏状态
    try {
      if (localStorage.getItem(SIDEBAR_KEY) === "1") {
        setSidebarCollapsed(true);
      }
    } catch (_) {}
    // 快捷键 [ 切换侧栏
    document.addEventListener("keydown", (e) => {
      if (e.key !== "[" || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      toggleSidebar();
    });
    $("btn-regen").addEventListener("click", regenActive);
    $("btn-delete-trip").addEventListener("click", () => {
      const t = activeTrip();
      if (!t) return;
      if (!confirm("删除这段旅程？")) return;
      state.trips = state.trips.filter((x) => x.id !== t.id);
      state.activeId = state.trips[0] ? state.trips[0].id : null;
      save();
      renderAll();
      toast("已删除");
    });
    $("btn-export-all").addEventListener("click", () => {
      downloadJson(
        { version: 1, trips: state.trips, rates: state.rates },
        "travel-all.json"
      );
      toast("已导出");
    });
    $("btn-export-one").addEventListener("click", () => {
      const t = activeTrip();
      if (!t) return;
      downloadJson({ trip: t }, "travel-one.json");
      toast("已导出");
    });
    $("btn-print").addEventListener("click", () => window.print());
    $("btn-import").addEventListener("click", () => $("import-file").click());
    $("import-file").addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          let trips = [];
          if (Array.isArray(data.trips)) trips = data.trips;
          else if (data.trip) trips = [data.trip];
          if (data.rates) state.rates = Object.assign(state.rates, data.rates);
          trips.forEach((tr) => {
            if (!tr.id) tr.id = uid();
            state.trips.unshift(tr);
          });
          if (trips[0]) state.activeId = trips[0].id;
          save();
          renderAll();
          toast("导入成功");
        } catch (err) {
          toast("导入失败");
        }
      };
      reader.readAsText(f, "utf-8");
      e.target.value = "";
    });

    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        switchTab(tab.dataset.tab);
        hapticLight();
      });
    });

    $("btn-add-day").addEventListener("click", () => {
      const t = activeTrip();
      if (!t) return;
      if (!t.days) t.days = [];
      t.days.push({
        date: t.endDate || t.startDate || "",
        city: primaryCity(t) || "",
        title: "新的一天",
        activities: [{ time: "", place: "", note: "" }],
      });
      state.openDays[t.days.length - 1] = true;
      touch(t);
      renderDays(t);
      renderOverview(t);
    });

    $("btn-gen-days").addEventListener("click", () => {
      const t = activeTrip();
      if (!t) return;
      normalizeTrip(t);
      if ((getDestinations(t).length || t.destination) && window.TravelGenerator) {
        regenActive();
        return;
      }
      const n = dayCount(t.startDate, t.endDate);
      if (!n) {
        toast("补全日期");
        return;
      }
      const start = parseDate(t.startDate);
      const city0 = primaryCity(t);
      t.days = [];
      for (let i = 0; i < n; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        t.days.push({
          date: fmtDate(d),
          city: city0 || "",
          title: "D" + (i + 1),
          activities: [{ time: "09:00", place: "", note: "" }],
        });
      }
      state.openDays = { 0: true };
      touch(t);
      renderDays(t);
      renderOverview(t);
    });

    $("btn-add-budget").addEventListener("click", () => {
      const t = activeTrip();
      if (!t) return;
      if (!t.budget) t.budget = [];
      t.budget.push({
        dayIndex: "",
        category: "餐饮",
        note: "",
        amount: 0,
        currency: "CNY",
        paid: false,
        payer: "我",
      });
      touch(t);
      renderBudget(t);
      renderOverview(t);
      renderSplit(t);
      hapticLight();
    });

    const btnSeed = $("btn-seed-budget");
    if (btnSeed) {
      btnSeed.addEventListener("click", () => {
        const t = activeTrip();
        if (!t) return;
        seedBudgetByDays(t);
      });
    }

    const btnPackWx = $("btn-pack-weather");
    if (btnPackWx) {
      btnPackWx.addEventListener("click", () => {
        const t = activeTrip();
        if (!t) return;
        applyWeatherPack(t);
      });
    }

    $("btn-add-companion").addEventListener("click", () => {
      const t = activeTrip();
      if (!t) return;
      const name = $("companion-name").value.trim();
      if (!name) {
        toast("写个名字");
        return;
      }
      if (!t.companions) t.companions = [];
      if (t.companions.includes(name) || name === "我") {
        toast("已在场");
        return;
      }
      t.companions.push(name);
      $("companion-name").value = "";
      touch(t);
      renderSplit(t);
      renderBudget(t);
      hapticOk();
    });

    $("btn-add-pack").addEventListener("click", () => {
      const t = activeTrip();
      if (!t) return;
      if (!t.pack) t.pack = [];
      t.pack.push({ name: "", cat: "其他", done: false });
      touch(t);
      renderPack(t);
      renderOverview(t);
    });

    $("btn-pack-template").addEventListener("click", () => {
      const t = activeTrip();
      if (!t) return;
      if (!t.pack) t.pack = [];
      PACK_TEMPLATE.forEach((item) => {
        if (!t.pack.some((p) => p.name === item.name)) {
          t.pack.push({ name: item.name, cat: item.cat, done: false });
        }
      });
      touch(t);
      renderPack(t);
      renderOverview(t);
      toast("模板已铺上");
    });

    const btnMap = $("btn-refresh-map");
    if (btnMap) {
      btnMap.addEventListener("click", () => {
        scheduleMapRefresh(true);
        toast("正在刷新地图路线…");
      });
    }

    // 地图选点
    if ($("chk-map-pick")) {
      $("chk-map-pick").addEventListener("change", () => {
        const on = $("chk-map-pick").checked;
        if (on) {
          const t = activeTrip();
          fillMapPickDaySelect(t);
          if (!t || !t.days || !t.days.length) {
            toast("请先添加日程天再选点");
            $("chk-map-pick").checked = false;
            syncMapPickMode(false);
            return;
          }
          switchTab("days");
          toast("选点模式：点击地图添加站点");
        }
        syncMapPickMode(on);
        hapticLight();
      });
    }
    if ($("map-pick-day")) {
      $("map-pick-day").addEventListener("change", () => {
        if ($("chk-map-pick") && $("chk-map-pick").checked) {
          toast("选点将加入 " + ($("map-pick-day").selectedOptions[0]
            ? $("map-pick-day").selectedOptions[0].textContent
            : "所选日"));
        }
      });
    }
    window.addEventListener("travel-map-pin-moved", () => {
      const t = activeTrip();
      if (!t) return;
      touch(t);
      updateRouteStats(t);
      toast("钉点已更新");
    });

    const btnOptAll = $("btn-optimize-all");
    if (btnOptAll) {
      btnOptAll.addEventListener("click", () => {
        const t = activeTrip();
        if (!t) return;
        optimizeAllDays(t);
      });
    }

    $("btn-undo").addEventListener("click", undo);

    $("btn-dup-trip").addEventListener("click", () => {
      const t = activeTrip();
      if (!t) return;
      withUndo(() => {
        const copy = JSON.parse(JSON.stringify(t));
        copy.id = uid();
        copy.title = (copy.title || "旅程") + " · 副本";
        copy.updatedAt = Date.now();
        state.trips.unshift(copy);
        state.activeId = copy.id;
        save();
      });
      renderAll();
      scheduleMapRefresh(true);
      loadWeather(true);
      toast("已复制整段行程");
    });

    if ($("btn-export-ics")) {
      $("btn-export-ics").addEventListener("click", () => {
        const t = activeTrip();
        if (!t || !window.TravelExport || !TravelExport.tripToIcs) {
          toast("导出模块未就绪");
          return;
        }
        if (!t.days || !t.days.length) {
          toast("没有可导出的日程天");
          return;
        }
        const safe = (t.title || "trip").replace(/[\\/:*?"<>|]/g, "_");
        TravelExport.downloadText(
          safe + ".ics",
          TravelExport.tripToIcs(t),
          "text/calendar;charset=utf-8"
        );
        toast("已导出日历 ICS");
        hapticOk();
      });
    }

    if ($("btn-config-collapse")) {
      $("btn-config-collapse").addEventListener("click", () => {
        const bar = $("config-rail");
        const next = !(bar && bar.classList.contains("is-collapsed"));
        setConfigCollapsed(next);
        hapticLight();
      });
      try {
        if (localStorage.getItem(CONFIG_COLLAPSE_KEY) === "1") {
          setConfigCollapsed(true);
        }
      } catch (_) {}
    }

    if ($("map-focus-day")) {
      $("map-focus-day").addEventListener("change", () => {
        scheduleMapRefresh(true);
        const v = $("map-focus-day").value;
        toast(v === "all" ? "地图显示全部日" : "地图仅显示 D" + (Number(v) + 1));
      });
    }

    $("btn-export-md").addEventListener("click", () => {
      const t = activeTrip();
      if (!t || !window.TravelExport) return;
      const safe = (t.title || "trip").replace(/[\\/:*?"<>|]/g, "_");
      TravelExport.downloadText(
        safe + ".md",
        TravelExport.tripToMarkdown(t),
        "text/markdown;charset=utf-8"
      );
      toast("已导出 Markdown");
    });

    $("btn-export-html").addEventListener("click", () => {
      const t = activeTrip();
      if (!t || !window.TravelExport) return;
      const safe = (t.title || "trip").replace(/[\\/:*?"<>|]/g, "_");
      TravelExport.downloadText(
        safe + "-share.html",
        TravelExport.tripToShareHtml(t),
        "text/html;charset=utf-8"
      );
      toast("已导出分享页，可发给朋友打开");
    });

    $("btn-export-editorial").addEventListener("click", () => {
      const t = activeTrip();
      if (!t || !window.TravelExport) return;
      let lightHtml = "";
      if (lastAstro && window.TravelAstro) {
        lightHtml = `<div class="light"><h3>Light Notes</h3>
          日出 ${TravelAstro.fmtHM(lastAstro.sunrise)} · 日落 ${TravelAstro.fmtHM(
          lastAstro.sunset
        )}</div>`;
      }
      const safe = (t.title || "trip").replace(/[\\/:*?"<>|]/g, "_");
      TravelExport.downloadText(
        safe + "-editorial.html",
        TravelExport.tripToEditorialHtml(t, { lightHtml }),
        "text/html;charset=utf-8"
      );
      shutterClick();
      toast("摄影志已导出");
    });

    $("btn-copy-share").addEventListener("click", () => {
      const t = activeTrip();
      if (!t) return;
      copyShare(t);
    });

    // 摄影功能已常驻：进入行程时预加载光影
    if (activeTrip()) {
      setTimeout(() => refreshLightPanel(), 400);
    }

    if ($("btn-refresh-light")) {
      $("btn-refresh-light").addEventListener("click", () => refreshLightPanel());
    }
    if ($("light-day-select")) {
      $("light-day-select").addEventListener("change", () => refreshLightPanel());
    }
    if ($("btn-snap-magic")) {
      $("btn-snap-magic").addEventListener("click", () => snapAllToMagic());
    }
    if ($("btn-add-gear")) {
      $("btn-add-gear").addEventListener("click", () => {
        gearList.push({
          id: uid(),
          name: "新装备",
          cat: "其他",
          weight: 100,
          wh: 0,
          qty: 1,
          on: true,
        });
        save();
        renderGear();
        shutterClick();
      });
    }
    if ($("airline-preset")) {
      $("airline-preset").addEventListener("change", () => renderGearSummary());
    }
    if ($("chk-caution")) {
      $("chk-caution").addEventListener("change", () => {
        scheduleMapRefresh(true);
        toast(
          $("chk-caution").checked
            ? "已叠加示意安全圈（非真实热力图）"
            : "已关闭示意安全圈"
        );
      });
    }
    ["lens-sensor", "lens-focal", "lens-time-dial"].forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("input", () => {
        updateLensUI();
        if (id === "lens-time-dial") hapticLight();
      });
    });

    if ($("btn-buddy-post")) {
      $("btn-buddy-post").addEventListener("click", () => {
        if (!window.TravelPhotoExtra) return;
        const card = {
          id: uid(),
          name: $("buddy-name").value.trim() || "匿名",
          role: $("buddy-role").value,
          city: $("buddy-city").value.trim(),
          style: $("buddy-style").value.trim(),
          start: $("buddy-start").value,
          end: $("buddy-end").value,
        };
        const all = TravelPhotoExtra.loadBuddies();
        all.push(card);
        TravelPhotoExtra.saveBuddies(all);
        renderBuddyBoard();
        shutterClick();
        toast("已发布到本地搭子板");
      });
    }
    if ($("btn-buddy-match")) {
      $("btn-buddy-match").addEventListener("click", () => {
        const t = activeTrip();
        if (!t || !window.TravelPhotoExtra) return;
        const hits = TravelPhotoExtra.matchBuddies(
          primaryCity(t) || t.destination,
          t.startDate,
          t.endDate,
          null
        );
        const box = $("buddy-board");
        if (!hits.length) {
          box.innerHTML =
            '<p class="hint-text">没有重合的本地卡片。可先发布或放宽城市名。</p>';
          return;
        }
        box.innerHTML = hits
          .map(
            (b) => `<div class="buddy-card">
            <h4>匹配 · ${escapeHtml(b.name)} · ${
              b.role === "model" ? "模特" : "摄影师"
            }</h4>
            <div class="buddy-meta">${escapeHtml(b.city)} · ${escapeHtml(
              b.start
            )}~${escapeHtml(b.end)}<br/>${escapeHtml(b.style || "")}</div>
          </div>`
          )
          .join("");
        toast("找到 " + hits.length + " 条重合");
      });
    }
    if ($("btn-tfp-copy")) {
      $("btn-tfp-copy").addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(TFP_TEXT);
          toast("TFP 协议模板已复制");
        } catch (_) {
          toast("复制失败");
        }
      });
    }

    $("btn-help").addEventListener("click", () => {
      $("help-mask").classList.remove("hidden");
    });
    $("help-close").addEventListener("click", () => {
      $("help-mask").classList.add("hidden");
    });
    $("help-mask").addEventListener("click", (e) => {
      if (e.target === $("help-mask")) $("help-mask").classList.add("hidden");
    });

    document.querySelectorAll("[data-note-tpl]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const t = activeTrip();
        if (!t) return;
        const key = btn.getAttribute("data-note-tpl");
        const tpl = NOTE_TPL[key];
        if (!tpl) return;
        t.notes = (t.notes ? t.notes + "\n" : "") + tpl;
        $("trip-notes").value = t.notes;
        touch(t);
        toast("已插入模板");
      });
    });

    $("btn-add-remind").addEventListener("click", () => {
      const t = activeTrip();
      if (!t) return;
      const text = $("remind-input").value.trim();
      if (!text) {
        toast("写一句提醒");
        return;
      }
      if (!t.reminds) t.reminds = [];
      withUndo(() => {
        t.reminds.push({ text, done: false });
        touch(t);
      });
      $("remind-input").value = "";
      renderReminds(t);
      hapticLight();
    });
    $("remind-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") $("btn-add-remind").click();
    });

    $("btn-refresh-weather").addEventListener("click", () => {
      weatherCityCache = {};
      weatherCacheKey = "";
      loadWeather(true);
    });

    const search = $("trip-search");
    if (search) {
      search.addEventListener("input", () => {
        state.search = search.value;
        renderTripList();
      });
    }

    // 侧栏「灵感生成」双击打开精修向导
    $("btn-new-trip").addEventListener("dblclick", openWizard);

    // 日期变更后刷新天气
    $("trip-start").addEventListener("change", () => {
      weatherCacheKey = "";
      loadWeather(true);
    });
    $("trip-end").addEventListener("change", () => {
      weatherCacheKey = "";
      loadWeather(true);
    });

    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        const tag = (e.target && e.target.tagName) || "";
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        undo();
      }
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        const tag = (e.target && e.target.tagName) || "";
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        $("help-mask").classList.remove("hidden");
      }
      if (e.key === "Escape") {
        $("help-mask").classList.add("hidden");
        $("wizard-mask").classList.add("hidden");
      }
    });

    // 离线状态指示 + Service Worker
    const pill = $("offline-pill");
    function syncOnlinePill() {
      if (!pill) return;
      if (!navigator.onLine) {
        pill.classList.add("show", "is-offline");
        pill.textContent = "离线 · 本地数据仍可用";
      } else {
        pill.classList.remove("is-offline");
        if (pill.dataset.sw === "1") {
          pill.classList.add("show");
          pill.textContent = "已缓存 · 可离线打开壳";
          setTimeout(() => pill.classList.remove("show"), 3200);
        } else {
          pill.classList.remove("show");
        }
      }
    }
    window.addEventListener("online", syncOnlinePill);
    window.addEventListener("offline", syncOnlinePill);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("./sw.js")
        .then((reg) => {
          if (pill) pill.dataset.sw = "1";
          syncOnlinePill();
          // 有等待中的新壳时立刻激活，避免一直卡在旧「单目的地」缓存
          if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
          reg.update().catch(() => {});
        })
        .catch(() => {});
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        // 新 SW 接管后刷新一次，确保多城 UI 生效
        if (sessionStorage.getItem("fluid_sw_reloaded") === "1") return;
        sessionStorage.setItem("fluid_sw_reloaded", "1");
        location.reload();
      });
    }
    syncOnlinePill();

    renderAll();
    if (activeTrip()) {
      scheduleMapRefresh(true);
      loadWeather(true);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
