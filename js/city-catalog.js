/**
 * 省 · 市 · 县/县级市 目录
 * 规范标签：
 *   - 直辖市：上海
 *   - 地级市：浙江·金华
 *   - 县/县级市：浙江·金华·义乌
 */
(function (global) {
  "use strict";

  /**
   * @typedef {{
   *   province: string,
   *   city: string,
   *   county?: string,
   *   lat: number,
   *   lng: number,
   *   region?: string,
   *   aliases?: string[]
   * }} CityEntry
   */

  /** 快捷：地级市 */
  function pref(province, city, lat, lng, aliases, region) {
    return {
      province: province,
      city: city,
      county: "",
      lat: lat,
      lng: lng,
      region: region || "cn",
      aliases: aliases || [],
    };
  }

  /** 快捷：县 / 县级市 / 市辖区（挂在地级市下） */
  function county(province, city, countyName, lat, lng, aliases) {
    return {
      province: province,
      city: city,
      county: countyName,
      lat: lat,
      lng: lng,
      region: "cn",
      aliases: aliases || [],
    };
  }

  /** @type {CityEntry[]} */
  const CITIES = [
    // —— 直辖市 ——
    pref("上海", "上海", 31.2304, 121.4737, ["上海市"]),
    pref("北京", "北京", 39.9042, 116.4074, ["北京市"]),
    pref("天津", "天津", 39.3434, 117.3616, ["天津市"]),
    pref("重庆", "重庆", 29.563, 106.5516, ["重庆市"]),
    pref("香港", "香港", 22.3193, 114.1694, ["香港特别行政区", "HK"], "hk"),
    pref("澳门", "澳门", 22.1987, 113.5439, ["澳門"], "mo"),

    // —— 浙江地级市 ——
    pref("浙江", "杭州", 30.2741, 120.1551, ["杭州市"]),
    pref("浙江", "宁波", 29.8683, 121.544, ["宁波市"]),
    pref("浙江", "温州", 27.9939, 120.6994, ["温州市"]),
    pref("浙江", "金华", 29.0789, 119.6474, ["金华市"]),
    pref("浙江", "绍兴", 30.0023, 120.581, ["绍兴市"]),
    pref("浙江", "嘉兴", 30.7461, 120.7555, ["嘉兴市"]),
    pref("浙江", "台州", 28.6561, 121.4208, ["台州市"]),
    pref("浙江", "湖州", 30.894, 120.0868, ["湖州市"]),
    pref("浙江", "衢州", 28.9701, 118.8595, ["衢州市"]),
    pref("浙江", "丽水", 28.4517, 119.9219, ["丽水市"]),
    pref("浙江", "舟山", 29.9853, 122.2068, ["舟山市"]),

    // 浙江 · 金华 下辖（用户场景：金华→义乌→金华）
    county("浙江", "金华", "义乌", 29.3068, 120.075, ["义乌", "义乌市", "浙江·义乌"]),
    county("浙江", "金华", "东阳", 29.2625, 120.2419, ["东阳", "东阳市"]),
    county("浙江", "金华", "永康", 28.8884, 120.0473, ["永康", "永康市"]),
    county("浙江", "金华", "兰溪", 29.2084, 119.4605, ["兰溪", "兰溪市"]),
    county("浙江", "金华", "浦江", 29.4513, 119.8918, ["浦江", "浦江县"]),
    county("浙江", "金华", "武义", 28.8927, 119.8165, ["武义", "武义县"]),
    county("浙江", "金华", "磐安", 29.054, 120.4501, ["磐安", "磐安县"]),
    county("浙江", "金华", "婺城", 29.0866, 119.652, ["婺城区"]),
    county("浙江", "金华", "金东", 29.0998, 119.693, ["金东区"]),

    // 浙江 · 杭州 下辖
    county("浙江", "杭州", "西湖", 30.259, 120.13, ["西湖区"]),
    county("浙江", "杭州", "临安", 30.2338, 119.7247, ["临安", "临安区"]),
    county("浙江", "杭州", "淳安", 29.6097, 119.042, ["淳安", "淳安县", "千岛湖"]),
    county("浙江", "杭州", "桐庐", 29.7978, 119.685, ["桐庐", "桐庐县"]),
    county("浙江", "杭州", "建德", 29.476, 119.281, ["建德", "建德市"]),
    county("浙江", "杭州", "富阳", 30.0487, 119.9601, ["富阳", "富阳区"]),

    // 浙江 · 宁波 下辖
    county("浙江", "宁波", "鄞州", 29.8173, 121.5466, ["鄞州区"]),
    county("浙江", "宁波", "余姚", 30.0371, 121.1546, ["余姚", "余姚市"]),
    county("浙江", "宁波", "慈溪", 30.1697, 121.2665, ["慈溪", "慈溪市"]),
    county("浙江", "宁波", "宁海", 29.2881, 121.4297, ["宁海", "宁海县"]),
    county("浙江", "宁波", "象山", 29.4767, 121.8693, ["象山", "象山县"]),

    // 浙江 · 温州 / 台州 / 丽水 常见
    county("浙江", "温州", "瑞安", 27.778, 120.655, ["瑞安", "瑞安市"]),
    county("浙江", "温州", "乐清", 28.1128, 120.983, ["乐清", "乐清市"]),
    county("浙江", "台州", "温岭", 28.3728, 121.385, ["温岭", "温岭市"]),
    county("浙江", "台州", "玉环", 28.136, 121.232, ["玉环", "玉环市"]),
    county("浙江", "丽水", "青田", 28.1398, 120.2895, ["青田", "青田县"]),
    county("浙江", "丽水", "缙云", 28.6593, 120.0915, ["缙云", "缙云县"]),
    county("浙江", "舟山", "普陀", 29.949, 122.302, ["普陀", "普陀区", "朱家尖"]),

    // —— 江苏 ——
    pref("江苏", "南京", 32.0603, 118.7969, ["南京市"]),
    pref("江苏", "苏州", 31.2989, 120.5853, ["苏州市"]),
    pref("江苏", "无锡", 31.4912, 120.3119),
    pref("江苏", "常州", 31.8107, 119.9741),
    pref("江苏", "扬州", 32.3932, 119.4215),
    pref("江苏", "南通", 31.9802, 120.8943),
    pref("江苏", "徐州", 34.2058, 117.2841),
    county("江苏", "苏州", "昆山", 31.3856, 120.9807, ["昆山", "昆山市"]),
    county("江苏", "苏州", "常熟", 31.654, 120.752, ["常熟", "常熟市"]),
    county("江苏", "苏州", "张家港", 31.8755, 120.556, ["张家港", "张家港市"]),
    county("江苏", "苏州", "太仓", 31.458, 121.13, ["太仓", "太仓市"]),
    county("江苏", "苏州", "吴江", 31.16, 120.645, ["吴江", "吴江区"]),
    county("江苏", "无锡", "江阴", 31.92, 120.285, ["江阴", "江阴市"]),
    county("江苏", "无锡", "宜兴", 31.34, 119.823, ["宜兴", "宜兴市"]),
    county("江苏", "南京", "高淳", 31.327, 118.892, ["高淳", "高淳区"]),
    county("江苏", "南京", "溧水", 31.651, 119.028, ["溧水", "溧水区"]),

    // —— 其他省会/热门 ——
    pref("四川", "成都", 30.5728, 104.0668, ["成都市"]),
    county("四川", "成都", "都江堰", 30.988, 103.647, ["都江堰", "都江堰市"]),
    county("四川", "成都", "大邑", 30.587, 103.521, ["大邑", "大邑县", "西岭雪山"]),
    pref("广东", "广州", 23.1291, 113.2644, ["广州市"]),
    pref("广东", "深圳", 22.5431, 114.0579, ["深圳市"]),
    pref("广东", "珠海", 22.271, 113.5767),
    county("广东", "深圳", "罗湖", 22.547, 114.131, ["罗湖区"]),
    county("广东", "深圳", "南山", 22.531, 113.93, ["南山区"]),
    pref("福建", "厦门", 24.4798, 118.0894, ["厦门市"]),
    pref("福建", "福州", 26.0745, 119.2965),
    county("福建", "厦门", "思明", 24.445, 118.082, ["思明区"]),
    county("福建", "厦门", "鼓浪屿", 24.447, 118.066, ["鼓浪屿"]),
    pref("陕西", "西安", 34.3416, 108.9398, ["西安市"]),
    pref("湖北", "武汉", 30.5928, 114.3055),
    pref("湖南", "长沙", 28.2282, 112.9388),
    pref("山东", "青岛", 36.0671, 120.3826),
    pref("山东", "济南", 36.6512, 117.1201),
    pref("云南", "昆明", 25.0389, 102.7183),
    pref("云南", "丽江", 26.855, 100.227),
    pref("云南", "大理", 25.6065, 100.2676),
    county("云南", "丽江", "古城", 26.877, 100.233, ["古城区", "大研古城"]),
    county("云南", "丽江", "玉龙", 26.821, 100.237, ["玉龙", "玉龙纳西族自治县"]),
    county("云南", "大理", "大理市", 25.692, 100.156, ["大理古城", "下关"]),
    county("云南", "大理", "洱源", 26.111, 99.951, ["洱源县"]),
    pref("海南", "海口", 20.044, 110.1999),
    pref("海南", "三亚", 18.2528, 109.5119),
    county("海南", "三亚", "天涯", 18.3, 109.35, ["天涯区", "亚龙湾"]),
    pref("广西", "桂林", 25.2742, 110.2992),
    pref("广西", "南宁", 22.817, 108.3665),
    county("广西", "桂林", "阳朔", 24.778, 110.496, ["阳朔", "阳朔县"]),
    county("广西", "桂林", "龙胜", 25.798, 110.011, ["龙胜", "龙胜各族自治县"]),
    pref("安徽", "黄山", 29.7147, 118.3376),
    pref("安徽", "合肥", 31.8206, 117.2272),
    county("安徽", "黄山", "屯溪", 29.709, 118.315, ["屯溪区"]),
    county("安徽", "黄山", "歙县", 29.861, 118.428, ["歙县"]),
    pref("江西", "南昌", 28.682, 115.8579),
    pref("河南", "郑州", 34.7466, 113.6254),
    pref("河北", "石家庄", 38.0428, 114.5149),
    pref("山西", "太原", 37.8706, 112.5489),
    pref("辽宁", "大连", 38.914, 121.6147),
    pref("辽宁", "沈阳", 41.8057, 123.4315),
    pref("吉林", "长春", 43.8171, 125.3235),
    pref("黑龙江", "哈尔滨", 45.8038, 126.534),
    pref("贵州", "贵阳", 26.647, 106.6302),
    pref("甘肃", "兰州", 36.0611, 103.8343),
    pref("新疆", "乌鲁木齐", 43.8256, 87.6168),
    pref("西藏", "拉萨", 29.652, 91.1721),
    pref("内蒙古", "呼和浩特", 40.8426, 111.7492),
    pref("宁夏", "银川", 38.4872, 106.2309),
    pref("青海", "西宁", 36.6171, 101.7782),

    // —— 台湾 / 日本 ——
    pref("台湾", "台北", 25.033, 121.5654, ["臺北", "台北市"], "tw"),
    pref("台湾", "高雄", 22.6273, 120.3014, [], "tw"),
    pref("台湾", "台中", 24.1477, 120.6736, [], "tw"),
    pref("日本", "东京", 35.6812, 139.7671, ["東京", "Tokyo", "东京都"], "jp"),
    pref("日本", "京都", 35.0116, 135.7681, ["京都府"], "jp"),
    pref("日本", "大阪", 34.6937, 135.5023, ["大阪府"], "jp"),
    pref("日本", "奈良", 34.6851, 135.8048, [], "jp"),
    pref("日本", "横滨", 35.4437, 139.638, [], "jp"),
    pref("日本", "札幌", 43.0618, 141.3545, [], "jp"),
    pref("日本", "福冈", 33.5904, 130.4017, [], "jp"),
    pref("日本", "名古屋", 35.1815, 136.9066, [], "jp"),
  ];

  function sameName(a, b) {
    if (!a || !b) return false;
    return a === b || a.includes(b) || b.includes(a);
  }

  /** 规范展示标签 */
  function labelOf(entry) {
    if (!entry) return "";
    const co = entry.county || "";
    if (entry.province === entry.city && !co) return entry.city;
    if (co) return entry.province + "·" + entry.city + "·" + co;
    return entry.province + "·" + entry.city;
  }

  function stripAdminSuffix(s) {
    return String(s || "")
      .replace(/(特别行政区|自治区|维吾尔|壮族|回族|纳西族|各族)/g, "")
      .replace(/(自治县|自治州)$/g, "")
      .replace(/(省|市|地区|州|盟|县|区)$/g, "")
      .trim();
  }

  /**
   * 拆分 省·市·县 / 省·市 / 市·县 / 单名
   * @returns {{ province: string, city: string, county: string, raw: string } | null}
   */
  function parsePlace(raw) {
    let s = String(raw || "").trim();
    if (!s) return null;
    s = s.replace(/\s+/g, " ");

    // 省·市·县
    let m = s.match(/^(.+?)[·•・\-/／](.+?)[·•・\-/／](.+)$/);
    if (m) {
      return {
        province: stripAdminSuffix(m[1]),
        city: stripAdminSuffix(m[2]),
        county: stripAdminSuffix(m[3]),
        raw: s,
      };
    }

    // 省·市 或 市·县
    m = s.match(/^(.+?)[·•・\-/／](.+)$/);
    if (m) {
      return {
        province: stripAdminSuffix(m[1]),
        city: stripAdminSuffix(m[2]),
        county: "",
        raw: s,
        _twoPart: true,
      };
    }

    // 三词空格：浙江 金华 义乌
    m = s.match(/^(\S{2,8})\s+(\S{2,8})\s+(\S{2,8})$/);
    if (m) {
      return {
        province: stripAdminSuffix(m[1]),
        city: stripAdminSuffix(m[2]),
        county: stripAdminSuffix(m[3]),
        raw: s,
      };
    }

    // 两词空格
    m = s.match(/^(\S{2,8})\s+(\S{2,8})$/);
    if (m) {
      return {
        province: stripAdminSuffix(m[1]),
        city: stripAdminSuffix(m[2]),
        county: "",
        raw: s,
        _twoPart: true,
      };
    }

    // 浙江省金华市义乌市
    m = s.match(/^(.+?省)(.+?市)(.+?)(市|县|区)?$/);
    if (m) {
      return {
        province: stripAdminSuffix(m[1]),
        city: stripAdminSuffix(m[2]),
        county: stripAdminSuffix(m[3]),
        raw: s,
      };
    }

    m = s.match(/^(.+?省)(.+?)(市)?$/);
    if (m) {
      return {
        province: stripAdminSuffix(m[1]),
        city: stripAdminSuffix(m[2]),
        county: "",
        raw: s,
      };
    }

    return {
      province: "",
      city: stripAdminSuffix(s),
      county: "",
      raw: s,
    };
  }

  function entryKey(e) {
    return (e.province || "") + "|" + (e.city || "") + "|" + (e.county || "");
  }

  function matchEntry(e, p, c, co) {
    if (p && !sameName(e.province, p) && e.province !== p) return false;
    if (c && !sameName(e.city, c) && e.city !== c) {
      // 两段式「金华·义乌」：city 可能是上级市，county 是县
      return false;
    }
    if (co) {
      return sameName(e.county || "", co) || e.county === co;
    }
    // 无县：匹配地级市条目（county 为空）
    return !e.county;
  }

  /**
   * @returns {object}
   */
  function resolvePlace(raw) {
    const parsed = parsePlace(raw);
    if (!parsed) {
      return { province: "", city: "", county: "", label: "", known: false };
    }

    let p = parsed.province;
    let c = parsed.city;
    let co = parsed.county || "";

    // 两段式：可能是 省·市 或 市·县
    if (parsed._twoPart && p && c && !co) {
      // 先当 省·市
      let hit = findExact(p, c, "");
      if (hit) return pack(hit, true);
      // 再当 市·县（省未知）
      hit = findByCityCounty(p, c);
      if (hit) return pack(hit, true);
      // 省·县 误写：浙江·义乌 → 浙江·金华·义乌
      hit = findByProvinceCounty(p, c);
      if (hit) return pack(hit, true);
      // 合成 省·市
      return {
        province: p,
        city: c,
        county: "",
        label: p === c ? c : p + "·" + c,
        known: false,
      };
    }

    // 三段
    if (p && c && co) {
      let hit = findExact(p, c, co);
      if (hit) return pack(hit, true);
      return {
        province: p,
        city: c,
        county: co,
        label: p + "·" + c + "·" + co,
        known: false,
      };
    }

    // 仅一段：县名或市名
    if (!p && c && !co) {
      const byCounty = [];
      const byCity = [];
      CITIES.forEach((e) => {
        if (e.county && (e.county === c || sameName(e.county, c))) byCounty.push(e);
        if (!e.county && (e.city === c || sameName(e.city, c))) byCity.push(e);
        if ((e.aliases || []).some((a) => stripAdminSuffix(a) === c || a === raw)) {
          if (e.county) byCounty.push(e);
          else byCity.push(e);
        }
      });
      const uniq = dedupeEntries(byCounty.length ? byCounty : byCity);
      if (uniq.length === 1) return pack(uniq[0], true);
      if (uniq.length > 1) {
        return {
          province: "",
          city: c,
          county: "",
          label: c,
          known: false,
          ambiguous: uniq.map(labelOf),
        };
      }
    }

    // 省 + 市 无县
    if (p && c && !co) {
      const hit = findExact(p, c, "");
      if (hit) return pack(hit, true);
      return {
        province: p,
        city: c,
        county: "",
        label: p === c ? c : p + "·" + c,
        known: false,
      };
    }

    // label / alias 整串
    for (const e of CITIES) {
      if (labelOf(e) === raw) return pack(e, true);
      if ((e.aliases || []).includes(raw)) return pack(e, true);
    }

    return {
      province: p,
      city: c,
      county: co,
      label: co ? p + "·" + c + "·" + co : c || raw,
      known: false,
    };
  }

  function findExact(p, c, co) {
    for (const e of CITIES) {
      if (!sameName(e.province, p) && e.province !== p) continue;
      if (!sameName(e.city, c) && e.city !== c) continue;
      const ec = e.county || "";
      if (co) {
        if (ec === co || sameName(ec, co)) return e;
      } else if (!ec) {
        return e;
      }
    }
    return null;
  }

  function findByCityCounty(city, countyName) {
    const hits = CITIES.filter(
      (e) =>
        e.county &&
        (sameName(e.city, city) || e.city === city) &&
        (e.county === countyName || sameName(e.county, countyName))
    );
    return hits.length === 1 ? hits[0] : hits[0] || null;
  }

  function findByProvinceCounty(province, countyName) {
    const hits = CITIES.filter(
      (e) =>
        e.county &&
        (sameName(e.province, province) || e.province === province) &&
        (e.county === countyName || sameName(e.county, countyName))
    );
    return hits.length === 1 ? hits[0] : null;
  }

  function dedupeEntries(arr) {
    const u = [];
    arr.forEach((e) => {
      if (!u.some((x) => entryKey(x) === entryKey(e))) u.push(e);
    });
    return u;
  }

  function pack(e, known) {
    return Object.assign({}, e, {
      county: e.county || "",
      label: labelOf(e),
      known: !!known,
    });
  }

  function normalizeLabel(raw) {
    const r = resolvePlace(raw);
    return r.label || String(raw || "").trim();
  }

  /** POI 库键：优先用地级市名（义乌 → 金华 无 POI 时用金华/GENERIC） */
  function cityKey(raw) {
    const r = resolvePlace(raw);
    return r.city || String(raw || "").trim();
  }

  /** 最细地名：县或市 */
  function placeKey(raw) {
    const r = resolvePlace(raw);
    return r.county || r.city || String(raw || "").trim();
  }

  function geocodeHint(raw) {
    const r = resolvePlace(raw);
    if (!r.city && !r.county) return String(raw || "").trim();
    if (r.region === "jp") return "日本 " + (r.county || r.city);
    if (r.region === "tw") return "台湾 " + (r.county || r.city);
    if (r.region === "hk") return "香港";
    if (r.county) {
      // 浙江省金华市义乌市
      return (
        (r.province && r.province !== r.city ? r.province + "省 " : "") +
        r.city +
        "市 " +
        r.county
      );
    }
    if (r.province && r.province !== r.city) {
      return r.province + "省 " + r.city + "市";
    }
    if (r.province === r.city) return r.city + "市";
    return r.city || raw;
  }

  function centerOf(raw) {
    const r = resolvePlace(raw);
    if (r.lat != null && r.lng != null) return [r.lat, r.lng];
    return null;
  }

  function listLabels() {
    return CITIES.map(labelOf);
  }

  /** 仅地级/直辖市（不含县） */
  function listPrefectureLabels() {
    return CITIES.filter((e) => !e.county).map(labelOf);
  }

  /** 某地级市下的县/县级市标签 */
  function listCountiesOf(prefLabelOrRaw) {
    const r = resolvePlace(prefLabelOrRaw);
    if (!r.city) return [];
    return CITIES.filter(
      (e) =>
        e.county &&
        sameName(e.province, r.province || e.province) &&
        sameName(e.city, r.city)
    ).map((e) => ({
      label: labelOf(e),
      county: e.county,
      entry: e,
    }));
  }

  function hasCounties(prefLabelOrRaw) {
    return listCountiesOf(prefLabelOrRaw).length > 0;
  }

  function listByProvince() {
    const map = {};
    CITIES.forEach((e) => {
      const lab = labelOf(e);
      if (!map[e.province]) map[e.province] = [];
      map[e.province].push({
        label: lab,
        city: e.city,
        county: e.county || "",
        entry: e,
      });
    });
    return map;
  }

  function displayShort(raw, withProvince) {
    const r = resolvePlace(raw);
    if (withProvince === false) return r.county || r.city || raw;
    return r.label || raw;
  }

  global.TravelCityCatalog = {
    CITIES,
    labelOf,
    parsePlace,
    resolvePlace,
    normalizeLabel,
    cityKey,
    placeKey,
    geocodeHint,
    centerOf,
    listLabels,
    listPrefectureLabels,
    listCountiesOf,
    hasCounties,
    listByProvince,
    displayShort,
    stripAdminSuffix,
  };
})(typeof window !== "undefined" ? window : globalThis);
