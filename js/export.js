/**
 * 导出 Markdown / 独立分享 HTML
 */
(function (global) {
  "use strict";

  function tripToMarkdown(t) {
    if (!t) return "";
    const lines = [];
    lines.push("# " + (t.title || "旅程"));
    lines.push("");
    const destLabel =
      (Array.isArray(t.destinations) && t.destinations.length
        ? t.destinations.join(" → ")
        : null) ||
      t.destination ||
      "—";
    lines.push("- 目的地：" + destLabel);
    if (t.routeMode === "loop" && Array.isArray(t.destinations) && t.destinations.length >= 2) {
      lines.push("- 路线模式：环线（回起点）");
    } else if (Array.isArray(t.destinations) && t.destinations.length >= 2) {
      lines.push("- 路线模式：线性多城");
    }
    lines.push("- 日期：" + (t.startDate || "—") + " ~ " + (t.endDate || "—"));
    lines.push("- 人数：" + (t.people || 1));
    lines.push("- 偏好：" + (t.style || "—"));
    if (t.companions && t.companions.length) {
      lines.push("- 旅伴：" + ["我"].concat(t.companions).join("、"));
    }
    lines.push("");
    if (t.summary) {
      lines.push("## 叙事");
      lines.push("");
      lines.push(t.summary);
      lines.push("");
    }
    lines.push("## 日程");
    lines.push("");
    (t.days || []).forEach((d, di) => {
      const cityBit = d.city ? " · " + d.city : "";
      lines.push(
        "### D" +
          (di + 1) +
          " " +
          (d.title || "") +
          (d.date ? "（" + d.date + cityBit + "）" : cityBit ? "（" + d.city + "）" : "")
      );
      lines.push("");
      (d.activities || []).forEach((a) => {
        lines.push(
          "- **" +
            (a.time || "—") +
            "** " +
            (a.place || "") +
            (a.note ? " — " + a.note : "")
        );
      });
      if (d.note) {
        lines.push("");
        lines.push("> " + d.note.replace(/\n/g, " "));
      }
      lines.push("");
    });
    if (t.reminds && t.reminds.length) {
      lines.push("## 提醒");
      lines.push("");
      t.reminds.forEach((r) => {
        lines.push("- [" + (r.done ? "x" : " ") + "] " + (r.text || ""));
      });
      lines.push("");
    }
    if (t.budget && t.budget.length) {
      lines.push("## 预算");
      lines.push("");
      t.budget.forEach((b) => {
        lines.push(
          "- [" +
            (b.category || "") +
            "] " +
            (b.note || "") +
            " · " +
            (b.amount || 0) +
            " " +
            (b.currency || "CNY") +
            (b.payer ? " · 付款：" + b.payer : "")
        );
      });
      lines.push("");
    }
    if (t.pack && t.pack.length) {
      lines.push("## 行李");
      lines.push("");
      t.pack.forEach((p) => {
        lines.push("- [" + (p.done ? "x" : " ") + "] " + (p.name || "") + (p.cat ? " (" + p.cat + ")" : ""));
      });
      lines.push("");
    }
    if (t.notes) {
      lines.push("## 备忘");
      lines.push("");
      lines.push(t.notes);
      lines.push("");
    }
    lines.push("---");
    lines.push("*由 旅途 Fluid Travel 导出*");
    return lines.join("\n");
  }

  function tripToShareHtml(t) {
    const md = tripToMarkdown(t);
    const body = md
      .split("\n")
      .map((line) => {
        if (line.startsWith("# ")) return "<h1>" + esc(line.slice(2)) + "</h1>";
        if (line.startsWith("## ")) return "<h2>" + esc(line.slice(3)) + "</h2>";
        if (line.startsWith("### ")) return "<h3>" + esc(line.slice(4)) + "</h3>";
        if (line.startsWith("- ")) return "<li>" + inline(line.slice(2)) + "</li>";
        if (line.trim() === "---") return "<hr/>";
        if (line.startsWith("*") && line.endsWith("*"))
          return "<p class='muted'>" + esc(line.replace(/^\*|\*$/g, "")) + "</p>";
        if (!line.trim()) return "";
        return "<p>" + esc(line) + "</p>";
      })
      .join("\n");

    // wrap consecutive li
    const wrapped = body.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, (m) => "<ul>" + m + "</ul>");

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(t.title || "旅程")}</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: "Noto Sans SC", system-ui, sans-serif; max-width: 720px; margin: 0 auto; padding: 32px 20px 64px;
    background: #f3f2f0; color: #1a1a1e; line-height: 1.65; }
  @media (prefers-color-scheme: dark) {
    body { background: #121214; color: #f4f4f6; }
    h1,h2,h3 { color: #fff; }
    .card { background: #1c1c20; border-color: #333; }
  }
  h1 { font-size: 1.75rem; letter-spacing: -0.02em; }
  h2 { margin-top: 2rem; font-size: 1.15rem; border-left: 3px solid #00e8f0; padding-left: 10px; }
  h3 { margin-top: 1.25rem; color: #6b6b76; font-size: 1rem; }
  ul { padding-left: 1.2rem; }
  li { margin: 0.35rem 0; }
  .card { background: #fff; border: 1px solid #e5e5ea; border-radius: 16px; padding: 20px 22px; margin-top: 12px;
    box-shadow: 0 8px 30px rgba(0,0,0,.06); }
  .muted { color: #8b8b98; font-size: 0.85rem; }
  .badge { display:inline-block; background: linear-gradient(135deg,#00e8f0,#ff2e93); color:#0a0a0c;
    font-weight:700; font-size:0.7rem; padding:4px 10px; border-radius:999px; }
</style>
</head>
<body>
<span class="badge">Fluid Travel</span>
<div class="card">
${wrapped}
</div>
</body>
</html>`;
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function inline(s) {
    return esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  }

  function downloadText(filename, text, mime) {
    const blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function tripToEditorialHtml(t, extra) {
    extra = extra || {};
    const mood = t.mood || "📷";
    const daysHtml = (t.days || [])
      .map((d, di) => {
        const acts = (d.activities || [])
          .filter((a) => (a.place || "").trim())
          .map(
            (a) =>
              `<li><time>${esc(a.time || "")}</time><div><strong>${esc(
                a.place || ""
              )}</strong><em>${esc(a.note || "")}</em></div></li>`
          )
          .join("");
        return `<section class="day">
          <header><span class="d">D${di + 1}</span><h2>${esc(d.title || "")}</h2>
          <span class="date">${esc(d.date || "")}${d.city ? " · " + esc(d.city) : ""}</span></header>
          <ul>${acts}</ul>
          ${d.note ? `<blockquote>${esc(d.note)}</blockquote>` : ""}
        </section>`;
      })
      .join("");

    const light = extra.lightHtml || "";

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(t.title || "摄影志")} · Editorial</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Noto+Sans+SC:wght@400;500;700&display=swap');
  :root { --ink:#141416; --paper:#f4f1ea; --accent:#8a7355; }
  * { box-sizing:border-box; }
  body { margin:0; background:#1a1a1c; color:var(--ink); font-family:"Noto Sans SC",system-ui,sans-serif; }
  .page { max-width:800px; margin:24px auto 64px; background:var(--paper); box-shadow:0 30px 80px rgba(0,0,0,.45);
    padding:48px 40px 56px; }
  .mast { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:1px solid #d8d2c6; padding-bottom:16px; margin-bottom:28px; }
  .mast .brand { font-size:11px; letter-spacing:.28em; text-transform:uppercase; color:var(--accent); font-weight:700; }
  .mast .mood { font-size:28px; }
  h1 { font-family:"Cormorant Garamond",serif; font-size:42px; font-weight:600; margin:12px 0 8px; letter-spacing:-.02em; line-height:1.15; }
  .lede { color:#5c584f; font-size:15px; line-height:1.7; max-width:36em; }
  .meta { display:flex; flex-wrap:wrap; gap:10px 18px; margin:20px 0 32px; font-size:12px; letter-spacing:.06em; text-transform:uppercase; color:#6e685c; }
  .day { margin:28px 0; padding-top:18px; border-top:1px solid #e0d9cc; }
  .day header { display:flex; align-items:baseline; gap:12px; margin-bottom:12px; }
  .day .d { font-weight:800; color:var(--accent); font-size:13px; letter-spacing:.12em; }
  .day h2 { font-family:"Cormorant Garamond",serif; font-size:24px; margin:0; font-weight:600; flex:1; }
  .day .date { font-size:12px; color:#888; }
  .day ul { list-style:none; margin:0; padding:0; }
  .day li { display:grid; grid-template-columns:56px 1fr; gap:12px; padding:8px 0; border-bottom:1px dotted #ddd6c8; }
  .day time { font-variant-numeric:tabular-nums; color:var(--accent); font-weight:700; font-size:13px; }
  .day strong { display:block; font-size:15px; }
  .day em { display:block; font-style:normal; color:#7a7468; font-size:12px; margin-top:2px; }
  blockquote { margin:12px 0 0; padding:10px 14px; background:#ebe6dc; border-left:3px solid var(--accent); color:#4a463e; font-size:13px; }
  .light { margin:24px 0; padding:16px; background:#141416; color:#e8e6e0; border-radius:4px; font-size:13px; line-height:1.6; }
  .light h3 { margin:0 0 8px; font-size:11px; letter-spacing:.2em; text-transform:uppercase; color:#a89880; }
  footer { margin-top:40px; padding-top:16px; border-top:1px solid #d8d2c6; font-size:11px; color:#8a8478; letter-spacing:.08em; }
  @media print { body { background:#fff; } .page { box-shadow:none; margin:0; max-width:none; } }
</style>
</head>
<body>
<article class="page">
  <div class="mast"><span class="brand">Fluid Field Notes</span><span class="mood">${esc(mood)}</span></div>
  <h1>${esc(t.title || "Untitled Journey")}</h1>
  <p class="lede">${esc(t.summary || "一段为光影准备的旅程。")}</p>
  <div class="meta">
    <span>${esc(
      (Array.isArray(t.destinations) && t.destinations.length
        ? t.destinations.join(" → ")
        : null) ||
        t.destination ||
        "—"
    )}${
      t.routeMode === "loop" &&
      Array.isArray(t.destinations) &&
      t.destinations.length >= 2
        ? " · 环线"
        : ""
    }</span>
    <span>${esc(t.startDate || "")} — ${esc(t.endDate || "")}</span>
    <span>${esc(t.style || "")}</span>
  </div>
  ${light}
  ${daysHtml}
  <footer>EXPORTED FROM FLUID TRAVEL · FOR PERSONAL PORTFOLIO USE</footer>
</article>
</body>
</html>`;
  }

  /** 导出 ICS 日历（每日程一天事件，含站点摘要） */
  function tripToIcs(t) {
    if (!t) return "";
    const lines = [];
    const stamp = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
    lines.push("BEGIN:VCALENDAR");
    lines.push("VERSION:2.0");
    lines.push("PRODID:-//Fluid Travel//travel-planner//CN");
    lines.push("CALSCALE:GREGORIAN");
    lines.push("METHOD:PUBLISH");
    lines.push("X-WR-CALNAME:" + icsEscape(t.title || "旅程"));

    (t.days || []).forEach((d, di) => {
      const date = (d.date || t.startDate || "").replace(/-/g, "");
      if (!date || date.length !== 8) return;
      const places = (d.activities || [])
        .map((a) => (a.place || "").trim())
        .filter(Boolean)
        .slice(0, 12);
      const desc = places
        .map((p, i) => i + 1 + ". " + p)
        .join("\\n");
      const city = d.city || t.destination || "";
      const summary =
        "D" +
        (di + 1) +
        (city ? " · " + city : "") +
        " · " +
        (t.title || "旅程");
      const uid =
        (t.id || "trip") +
        "-d" +
        di +
        "-" +
        date +
        "@fluid-travel.local";
      lines.push("BEGIN:VEVENT");
      lines.push("UID:" + icsEscape(uid));
      lines.push("DTSTAMP:" + stamp);
      lines.push("DTSTART;VALUE=DATE:" + date);
      lines.push("DTEND;VALUE=DATE:" + nextDayYmd(date));
      lines.push("SUMMARY:" + icsEscape(summary));
      if (desc) lines.push("DESCRIPTION:" + icsEscape(desc));
      if (city) lines.push("LOCATION:" + icsEscape(city));
      lines.push("END:VEVENT");
    });

    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  }

  function icsEscape(s) {
    return String(s || "")
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "");
  }

  /** YYYYMMDD → 次日 YYYYMMDD */
  function nextDayYmd(ymd) {
    const y = Number(ymd.slice(0, 4));
    const m = Number(ymd.slice(4, 6)) - 1;
    const d = Number(ymd.slice(6, 8));
    const dt = new Date(y, m, d);
    dt.setDate(dt.getDate() + 1);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return "" + yy + mm + dd;
  }

  global.TravelExport = {
    tripToMarkdown,
    tripToShareHtml,
    tripToEditorialHtml,
    tripToIcs,
    downloadText,
  };
})(typeof window !== "undefined" ? window : globalThis);
