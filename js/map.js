/**
 * 左侧行程地图 · Leaflet + OSM（无需商业 Key）
 * 地理编码：Open-Meteo（CORS 友好）+ 城市中心约束 + localStorage 缓存
 * 多城：按 day.city 编码；切换城市会重算，拒绝跨城离谱结果
 */
(function (global) {
  "use strict";

  // v3：省·市 地理缓存
  const GEO_CACHE_KEY = "travel_geo_cache_v3";
  /** 兜底中心（目录优先；此处仅兼容旧短名） */
  const CITY_CENTER = {
    东京: [35.6812, 139.7671],
    京都: [35.0116, 135.7681],
    大阪: [34.6937, 135.5023],
    上海: [31.2304, 121.4737],
    北京: [39.9042, 116.4074],
    成都: [30.5728, 104.0668],
    重庆: [29.563, 106.5516],
    杭州: [30.2741, 120.1551],
    金华: [29.0789, 119.6474],
    义乌: [29.3068, 120.075],
    宁波: [29.8683, 121.544],
    苏州: [31.2989, 120.5853],
    南京: [32.0603, 118.7969],
    西安: [34.3416, 108.9398],
    厦门: [24.4798, 118.0894],
    香港: [22.3193, 114.1694],
    台北: [25.033, 121.5654],
    丽江: [26.855, 100.227],
    大理: [25.6065, 100.2676],
    武汉: [30.5928, 114.3055],
    广州: [23.1291, 113.2644],
    深圳: [22.5431, 114.0579],
    青岛: [36.0671, 120.3826],
    三亚: [18.2528, 109.5119],
  };

  /** 结果距城市中心超过此距离（km）视为跨城误匹配，丢弃 */
  const MAX_CITY_RADIUS_KM = 180;

  const DAY_COLORS = [
    "#00e8f0",
    "#ff2e93",
    "#6c8cff",
    "#f5a524",
    "#0d9f6e",
    "#b14cff",
    "#ff6b4a",
  ];

  let map = null;
  let layerGroup = null;
  let cautionGroup = null;
  let mapElId = "trip-map";
  let lastSignature = "";
  /** @type {null | ((e: any) => void)} */
  let pickClickHandler = null;
  let pickModeOn = false;

  /** 示意安全提示圈（非真实犯罪热力） */
  const CAUTION_ZONES = {
    巴黎: [{ lat: 48.853, lng: 2.349, r: 900, note: "部分景区入口扒窃高发报道区（示意）" }],
    巴塞罗那: [{ lat: 41.3809, lng: 2.173, r: 800, note: "兰布拉等游客区注意随身物（示意）" }],
    罗马: [{ lat: 41.8902, lng: 12.4922, r: 700, note: "景点周边注意飞车党传闻（示意）" }],
    东京: [{ lat: 35.6938, lng: 139.7034, r: 500, note: "歌舞伎町深夜人杂，器材勿炫耀（示意）" }],
    上海: [{ lat: 31.2304, lng: 121.4737, r: 600, note: "外滩大客流，防挤踏与遗忘（示意）" }],
  };

  function loadCache() {
    try {
      return JSON.parse(localStorage.getItem(GEO_CACHE_KEY) || "{}");
    } catch (_) {
      return {};
    }
  }

  function saveCache(cache) {
    try {
      localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cache));
    } catch (_) {}
  }

  /** 规范化单站标签：浙江·金华 / 上海 / 日本·东京 */
  function primaryCityName(dest) {
    const d = String(dest || "").trim();
    if (!d) return "";
    const first = d
      .split(/\s*[,，、\/|→～~]\s*|\s*->\s*|\s*到\s*|\s*至\s*/)[0]
      .trim();
    if (global.TravelCityCatalog && global.TravelCityCatalog.resolvePlace) {
      const r = global.TravelCityCatalog.resolvePlace(first);
      if (r && r.label) return r.label;
    }
    if (CITY_CENTER[first]) return first;
    for (const k of Object.keys(CITY_CENTER)) {
      if (first === k || first.includes(k) || k.includes(first)) return k;
    }
    for (const k of Object.keys(CITY_CENTER)) {
      if (d.includes(k)) return k;
    }
    return first || d;
  }

  function cityCenter(dest) {
    const name = primaryCityName(dest);
    if (global.TravelCityCatalog && global.TravelCityCatalog.centerOf) {
      const c =
        global.TravelCityCatalog.centerOf(name) ||
        global.TravelCityCatalog.centerOf(dest);
      if (c) return c.slice();
    }
    // 短名兜底
    const short =
      (global.TravelCityCatalog && global.TravelCityCatalog.cityKey
        ? global.TravelCityCatalog.cityKey(name)
        : name) || name;
    if (CITY_CENTER[short]) return CITY_CENTER[short].slice();
    if (CITY_CENTER[name]) return CITY_CENTER[name].slice();
    for (const k of Object.keys(CITY_CENTER)) {
      if (name.includes(k) || short.includes(k)) return CITY_CENTER[k].slice();
    }
    return [30.6, 114.3];
  }

  function haversineKm(a, b) {
    if (!a || !b) return 1e9;
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

  function ensureMap() {
    if (typeof L === "undefined") return null;
    const el = document.getElementById(mapElId);
    if (!el) return null;
    if (map) {
      setTimeout(() => map.invalidateSize(), 80);
      return map;
    }
    map = L.map(mapElId, {
      zoomControl: true,
      attributionControl: true,
    }).setView(cityCenter(""), 12);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CARTO',
    }).addTo(map);

    layerGroup = L.layerGroup().addTo(map);
    cautionGroup = L.layerGroup().addTo(map);
    setTimeout(() => map.invalidateSize(), 100);
    return map;
  }

  function renderCautionZones(dest, enabled) {
    if (!map || !cautionGroup) return;
    cautionGroup.clearLayers();
    if (!enabled) return;
    const d = primaryCityName(dest) || dest || "";
    let zones = [];
    Object.keys(CAUTION_ZONES).forEach((k) => {
      if (d.includes(k) || k.includes(d)) zones = zones.concat(CAUTION_ZONES[k]);
    });
    zones.forEach((z) => {
      const c = L.circle([z.lat, z.lng], {
        radius: z.r,
        color: "#e5484d",
        weight: 1,
        fillColor: "#e5484d",
        fillOpacity: 0.12,
      }).bindPopup("⚠️ " + (z.note || "注意安全（示意区域，非官方热力图）"));
      cautionGroup.addLayer(c);
    });
  }

  function cleanPlaceName(place) {
    return String(place || "")
      .split(/[·•|／/]/)[0]
      .replace(/特色餐厅|小吃街|酒店出发|地铁|休息|回酒店|正餐.*/g, "")
      .replace(/^城际移动[：:].*$/g, "")
      .replace(/^环线收官.*$/g, "")
      .replace(/^返程.*$/g, "")
      .trim();
  }

  function isNonPoiPlace(place) {
    const p = String(place || "");
    return (
      !p ||
      p.length < 2 ||
      /城际移动|环线收官|返程准备|酒店出发|休息\s*\/|回酒店|正餐|集合/.test(p)
    );
  }

  function jitterNear(base, seedStr) {
    let hash = 0;
    const s = seedStr || "";
    for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
    const lat = base[0] + ((hash % 100) - 50) * 0.0018;
    const lng = base[1] + (((hash >> 8) % 100) - 50) * 0.0018;
    return [lat, lng];
  }

  function nearCity(pt, city) {
    if (!pt || !city) return true;
    const base = cityCenter(city);
    // 未知城市没有精确中心时放宽
    if (!CITY_CENTER[primaryCityName(city)] && !Object.keys(CITY_CENTER).some((k) => city.includes(k))) {
      return true;
    }
    return haversineKm(pt, base) <= MAX_CITY_RADIUS_KM;
  }

  async function fetchOpenMeteo(name) {
    const url =
      "https://geocoding-api.open-meteo.com/v1/search?count=5&language=zh&name=" +
      encodeURIComponent(name);
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return (data && data.results) || null;
  }

  /**
   * 地理编码：强制绑定 day 城市，避免换城后仍用旧城/东京坐标
   * @param {string} query 景点名
   * @param {string} dest 当日城市
   */
  async function geocode(query, dest) {
    const q = (query || "").trim();
    const city = primaryCityName(dest);
    if (!q && !city) return null;

    if (isNonPoiPlace(q) || !q) {
      return city ? cityCenter(city) : null;
    }

    const base = cityCenter(city);
    const hint =
      global.TravelCityCatalog && global.TravelCityCatalog.geocodeHint
        ? global.TravelCityCatalog.geocodeHint(city || dest)
        : city;
    const shortCity =
      global.TravelCityCatalog && global.TravelCityCatalog.cityKey
        ? global.TravelCityCatalog.cityKey(city || dest)
        : city;

    // 缓存键必须含省·市，换城后不会命中旧城结果
    const cacheKey = (city || "") + "||" + q;
    const cache = loadCache();
    if (cache[cacheKey] && Array.isArray(cache[cacheKey])) {
      const cached = cache[cacheKey];
      if (nearCity(cached, city)) return cached;
      delete cache[cacheKey];
    }

    // 优先带省名的查询，降低同名城误匹配
    const tryNames = [];
    if (hint) {
      tryNames.push(q + " " + hint, hint + " " + q, q + "," + hint);
    }
    if (shortCity && shortCity !== hint) {
      tryNames.push(q + " " + shortCity, shortCity + " " + q);
    }
    if (city && city !== hint) tryNames.push(q + " " + city);
    tryNames.push(q);

    try {
      for (const name of tryNames) {
        const results = await fetchOpenMeteo(name);
        if (!results || !results.length) continue;
        let best = null;
        for (const r of results) {
          const pt = [r.latitude, r.longitude];
          if (nearCity(pt, city)) {
            best = pt;
            break;
          }
        }
        if (!best && !city && results[0]) {
          best = [results[0].latitude, results[0].longitude];
        }
        if (best) {
          cache[cacheKey] = best;
          saveCache(cache);
          return best;
        }
      }
    } catch (_) {}

    const pt = jitterNear(base, q + "|" + city);
    cache[cacheKey] = pt;
    saveCache(cache);
    return pt;
  }

  function markerIcon(color, label) {
    const html =
      `<div style="
        width:28px;height:28px;border-radius:50%;
        background:${color};color:#0a0a0c;font-weight:800;font-size:11px;
        display:flex;align-items:center;justify-content:center;
        border:2px solid rgba(255,255,255,.85);
        box-shadow:0 4px 14px rgba(0,0,0,.25);
      ">${label}</div>`;
    return L.divIcon({
      className: "trip-marker",
      html,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  }

  function dayCityOfTrip(trip, day, fallback) {
    if (day && day.city) return primaryCityName(day.city) || day.city;
    if (Array.isArray(trip.destinations) && trip.destinations.length) {
      return primaryCityName(trip.destinations[0]) || trip.destinations[0];
    }
    return primaryCityName(fallback || trip.destination || "") || "";
  }

  function mapSignature(trip, opts) {
    opts = opts || {};
    // 含地图钉点坐标，选点后会刷新
    return (
      (trip && trip.id) +
      "|" +
      (trip && trip.destination) +
      "|" +
      JSON.stringify(
        (trip && trip.days ? trip.days : []).map((d) => ({
          city: d.city || "",
          date: d.date || "",
          acts: (d.activities || []).map((a) => [
            a.place || "",
            a.time || "",
            a._geoCity || "",
            a._mapPinned ? 1 : 0,
            a.lat != null ? Number(a.lat).toFixed(5) : "",
            a.lng != null ? Number(a.lng).toFixed(5) : "",
          ]),
        }))
      ) +
      "|f" +
      (opts.focusDay != null ? opts.focusDay : "") +
      "|c" +
      (opts.showCaution ? 1 : 0)
    );
  }

  /** 逆地理：坐标 → 地名 */
  async function reverseGeocode(lat, lng) {
    if (lat == null || lng == null) return "";
    try {
      const url =
        "https://geocoding-api.open-meteo.com/v1/reverse?language=zh&count=1&latitude=" +
        encodeURIComponent(lat) +
        "&longitude=" +
        encodeURIComponent(lng);
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const r = data && data.results && data.results[0];
        if (r) {
          const parts = [r.name, r.admin2, r.admin1, r.country]
            .filter(Boolean)
            .filter((v, i, a) => a.indexOf(v) === i);
          if (parts.length) return parts.slice(0, 3).join(" · ");
        }
      }
    } catch (_) {}
    try {
      const url =
        "https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=zh&lat=" +
        encodeURIComponent(lat) +
        "&lon=" +
        encodeURIComponent(lng);
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.display_name) {
          return String(data.display_name).split(",").slice(0, 3).join(" · ").trim();
        }
        if (data && data.name) return data.name;
      }
    } catch (_) {}
    return (
      "地图点 " + Number(lat).toFixed(4) + ", " + Number(lng).toFixed(4)
    );
  }

  /**
   * 地图选点模式
   * @param {boolean} enabled
   * @param {(lat: number, lng: number) => void} [onPick]
   */
  function setPickMode(enabled, onPick) {
    const m = ensureMap();
    if (!m) return;
    pickModeOn = !!enabled;
    if (pickClickHandler) {
      m.off("click", pickClickHandler);
      pickClickHandler = null;
    }
    const el = m.getContainer();
    if (el) el.style.cursor = enabled ? "crosshair" : "";
    const pane = document.getElementById("map-pane");
    if (pane) pane.classList.toggle("is-pick-mode", !!enabled);
    if (enabled && typeof onPick === "function") {
      pickClickHandler = function (e) {
        if (!e || !e.latlng) return;
        onPick(e.latlng.lat, e.latlng.lng);
      };
      m.on("click", pickClickHandler);
    }
  }

  function isPickMode() {
    return pickModeOn;
  }

  /**
   * @param {{ destination: string, destinations?: string[], days: Array }} trip
   * @param {{ focusDay?: number, force?: boolean, showCaution?: boolean }} opts
   */
  async function renderTripMap(trip, opts) {
    opts = opts || {};
    const m = ensureMap();
    if (!m || !layerGroup) return;

    // 签名必须包含 day.city，否则换城不重绘
    const sig = mapSignature(trip, opts);
    if (sig === lastSignature && !opts.force) {
      m.invalidateSize();
      return;
    }
    lastSignature = sig;

    layerGroup.clearLayers();
    if (!trip) {
      m.setView(cityCenter(""), 11);
      renderCautionZones("", false);
      return;
    }

    const dests = Array.isArray(trip.destinations)
      ? trip.destinations.filter(Boolean)
      : [];
    const dest =
      dests[0] ||
      (trip.days && trip.days[0] && trip.days[0].city) ||
      trip.destination ||
      "";

    const allLatLngs = [];
    const days = trip.days || [];
    /** @type {Array<[number,number]>} 焦点日点，用于 fitBounds 优先 */
    let focusPts = [];

    for (let di = 0; di < days.length; di++) {
      const day = days[di];
      const color = DAY_COLORS[di % DAY_COLORS.length];
      const acts = day.activities || [];
      const dayPts = [];
      const dayCity = dayCityOfTrip(trip, day, dest);

      for (let ai = 0; ai < acts.length; ai++) {
        let usePt = null;
        const placeRaw = acts[ai].place || "";
        const place = cleanPlaceName(placeRaw);

        // 地图选点 / 用户钉死坐标：优先使用
        if (
          acts[ai].lat != null &&
          acts[ai].lng != null &&
          acts[ai].lat !== "" &&
          acts[ai].lng !== ""
        ) {
          const pinned = [Number(acts[ai].lat), Number(acts[ai].lng)];
          if (!Number.isNaN(pinned[0]) && !Number.isNaN(pinned[1])) {
            if (acts[ai]._mapPinned || !dayCity || nearCity(pinned, dayCity)) {
              usePt = pinned;
            }
          }
        }

        // 非景点（城际移动等）钉在当日城市中心
        if (!usePt && (isNonPoiPlace(placeRaw) || !place)) {
          if (dayCity) {
            usePt = jitterNear(cityCenter(dayCity), "nonpoi|" + di + "|" + ai);
          } else {
            continue;
          }
        }

        if (!usePt && place) {
          usePt = await geocode(place || placeRaw, dayCity || dest);
          // 写回活动点（非地图钉点时）
          if (usePt && acts[ai] && !acts[ai]._mapPinned) {
            acts[ai].lat = usePt[0];
            acts[ai].lng = usePt[1];
            acts[ai]._geoCity = dayCity || "";
          }
        }

        if (!usePt || Number.isNaN(usePt[0])) continue;
        dayPts.push(usePt);
        allLatLngs.push(usePt);
        if (opts.focusDay === di) focusPts.push(usePt);

        const cityTag = dayCity
          ? `<br/><span style="opacity:.65">📍 ${escapeHtml(dayCity)}</span>`
          : "";
        const pinTag = acts[ai]._mapPinned
          ? `<br/><span style="opacity:.8;color:#00b8c0">📌 地图选点</span>`
          : "";
        const coordTag =
          acts[ai].lat != null
            ? `<br/><code style="font-size:11px;opacity:.7">${Number(
                acts[ai].lat
              ).toFixed(5)}, ${Number(acts[ai].lng).toFixed(5)}</code>`
            : "";
        const mk = L.marker(usePt, {
          icon: markerIcon(color, String(ai + 1)),
          draggable: !!acts[ai]._mapPinned,
        }).bindPopup(
          `<strong>D${di + 1} · ${escapeHtml(acts[ai].time || "")}</strong><br/>${escapeHtml(
            acts[ai].place || ""
          )}${cityTag}${pinTag}${coordTag}<br/><span style="opacity:.7">${escapeHtml(
            acts[ai].note || ""
          )}</span>`
        );
        if (acts[ai]._mapPinned) {
          const actRef = acts[ai];
          mk.on("dragend", function () {
            const ll = mk.getLatLng();
            actRef.lat = ll.lat;
            actRef.lng = ll.lng;
            actRef._mapPinned = true;
            if (typeof global.dispatchEvent === "function") {
              try {
                global.dispatchEvent(
                  new CustomEvent("travel-map-pin-moved", {
                    detail: { dayIndex: di, actIndex: ai, lat: ll.lat, lng: ll.lng },
                  })
                );
              } catch (_) {}
            }
          });
        }
        layerGroup.addLayer(mk);
      }

      if (dayPts.length >= 2) {
        const line = L.polyline(dayPts, {
          color,
          weight: 4,
          opacity: 0.85,
          lineJoin: "round",
          dashArray: di % 2 === 0 ? null : "8 8",
        });
        layerGroup.addLayer(line);
      } else if (dayPts.length === 1 && dayCity) {
        // 单点也画小圈标城市
      }
    }

    // 初始视角：优先焦点日 / 全部点 / 首城
    const fitPts = focusPts.length ? focusPts : allLatLngs;
    if (fitPts.length) {
      try {
        m.fitBounds(L.latLngBounds(fitPts).pad(0.25));
      } catch (_) {
        m.setView(fitPts[0], 12);
      }
    } else {
      m.setView(cityCenter(dest), 11);
    }

    // 警戒圈用首城或焦点日城市
    let cautionCity = dest;
    if (opts.focusDay != null && days[opts.focusDay]) {
      cautionCity = dayCityOfTrip(trip, days[opts.focusDay], dest);
    }
    renderCautionZones(cautionCity, !!opts.showCaution);

    setTimeout(() => m.invalidateSize(), 120);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function invalidate() {
    if (map) setTimeout(() => map.invalidateSize(), 50);
  }

  function destroy() {
    if (map) {
      if (pickClickHandler) {
        map.off("click", pickClickHandler);
        pickClickHandler = null;
      }
      map.remove();
      map = null;
      layerGroup = null;
      lastSignature = "";
      pickModeOn = false;
    }
  }

  /**
   * 解析行程各站坐标（按日城市），用于优化与里程
   */
  async function resolveTripPoints(trip) {
    const fallback = (trip && trip.destination) || "";
    const dayPoints = [];
    const dayKm = [];
    let totalKm = 0;
    const days = (trip && trip.days) || [];
    for (let di = 0; di < days.length; di++) {
      const day = days[di];
      const city = dayCityOfTrip(trip, day, fallback);
      const acts = day.activities || [];
      const pts = [];
      for (let ai = 0; ai < acts.length; ai++) {
        const placeRaw = acts[ai].place || "";
        if (isNonPoiPlace(placeRaw)) {
          pts.push(city ? cityCenter(city) : null);
          continue;
        }
        const place = cleanPlaceName(placeRaw);
        if (!place || place.length < 2) {
          pts.push(null);
          continue;
        }
        if (
          acts[ai].lat != null &&
          acts[ai].lng != null &&
          acts[ai]._geoCity === city
        ) {
          const pinned = [Number(acts[ai].lat), Number(acts[ai].lng)];
          if (nearCity(pinned, city)) {
            pts.push(pinned);
            continue;
          }
        }
        const pt = await geocode(place, city || fallback);
        if (pt && acts[ai]) {
          acts[ai].lat = pt[0];
          acts[ai].lng = pt[1];
          acts[ai]._geoCity = city || "";
        }
        pts.push(pt);
      }
      dayPoints.push(pts);
      const valid = pts.filter(Boolean);
      let km = 0;
      for (let i = 1; i < valid.length; i++) {
        km += haversineKm(valid[i - 1], valid[i]);
      }
      dayKm.push(km);
      totalKm += km;
    }
    return { dayPoints, totalKm, dayKm };
  }

  /** 清除活动上绑定的错误坐标（换城时调用） */
  function clearDayGeoPins(day) {
    if (!day || !day.activities) return;
    day.activities.forEach((a) => {
      delete a.lat;
      delete a.lng;
      delete a._geoCity;
    });
  }

  global.TravelMap = {
    ensureMap,
    renderTripMap,
    invalidate,
    destroy,
    cityCenter,
    geocode,
    reverseGeocode,
    cleanPlaceName,
    resolveTripPoints,
    renderCautionZones,
    clearDayGeoPins,
    primaryCityName,
    setPickMode,
    isPickMode,
  };
})(typeof window !== "undefined" ? window : globalThis);
