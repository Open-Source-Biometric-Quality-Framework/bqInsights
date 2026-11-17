import { useState, useEffect, useRef } from "react";

// PptxGenJS loaded via CDN script tag injected on mount
function usePptxGen() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (window.PptxGenJS) { setReady(true); return; }
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/gh/gitbrent/pptxgenjs/dist/pptxgen.bundle.js";
    s.onload = () => setReady(true);
    document.head.appendChild(s);
  }, []);
  return ready;
}

// ── SVG chart helpers (render to base64 PNG via canvas) ──────────────────────

function svgToBase64(svgString, w, h) {
  return new Promise((resolve) => {
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png").split(",")[1]);
    };
    img.src = url;
  });
}

// Line chart SVG generator
function makeLineChartSvg(data, series, thresholds = [], title = "", W = 800, H = 420) {
  const PAD = { top: 50, right: 30, bottom: 60, left: 55 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const weeks = data.map(d => d.week);
  const allVals = series.flatMap(s => data.map(d => d[s.key]));
  const minV = 0, maxV = 1.0;
  const xScale = (i) => PAD.left + (i / (weeks.length - 1)) * cW;
  const yScale = (v) => PAD.top + cH - ((v - minV) / (maxV - minV)) * cH;

  const COLORS = ["#90CDF4", "#4299E1", "#028090", "#E76F51", "#E53E3E"];
  const DASHES = ["", "", "", "", "4,3"];

  let paths = series.map((s, si) => {
    const pts = data.map((d, i) => `${xScale(i)},${yScale(d[s.key])}`).join(" L ");
    return `<path d="M ${pts}" fill="none" stroke="${COLORS[si]}" stroke-width="${s.bold ? 3 : 2}" stroke-dasharray="${DASHES[si]}" />`;
  }).join("\n");

  let dots = series.map((s, si) =>
    data.map((d, i) => `<circle cx="${xScale(i)}" cy="${yScale(d[s.key])}" r="${s.bold ? 5 : 3.5}" fill="${COLORS[si]}" stroke="white" stroke-width="1.5"/>`).join("")
  ).join("\n");

  let refLines = thresholds.map(t => {
    const y = yScale(t.value);
    return `<line x1="${PAD.left}" y1="${y}" x2="${PAD.left + cW}" y2="${y}" stroke="${t.color}" stroke-width="1.5" stroke-dasharray="6,3"/>
    <text x="${PAD.left + 4}" y="${y - 5}" font-size="10" fill="${t.color}" font-family="Calibri">${t.label}: ${t.value}</text>`;
  }).join("\n");

  let xLabels = weeks.map((w, i) => `<text x="${xScale(i)}" y="${PAD.top + cH + 20}" text-anchor="middle" font-size="11" fill="#64748B" font-family="Calibri">${w}</text>`).join("");
  let yLabels = [0, 0.2, 0.4, 0.6, 0.8, 1.0].map(v => {
    const y = yScale(v);
    return `<line x1="${PAD.left - 4}" y1="${y}" x2="${PAD.left + cW}" y2="${y}" stroke="#E2E8F0" stroke-width="0.8"/>
    <text x="${PAD.left - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="#64748B" font-family="Calibri">${v.toFixed(1)}</text>`;
  }).join("");

  let legend = series.map((s, si) => {
    const lx = PAD.left + si * 145;
    return `<rect x="${lx}" y="${H - 18}" width="14" height="3" fill="${COLORS[si]}" rx="2"/>
    <text x="${lx + 18}" y="${H - 12}" font-size="10" fill="#64748B" font-family="Calibri">${s.label}</text>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="white"/>
    <text x="${W / 2}" y="24" text-anchor="middle" font-size="14" font-weight="bold" fill="#1E293B" font-family="Calibri">${title}</text>
    ${yLabels}
    ${refLines}
    ${paths}
    ${dots}
    ${xLabels}
    ${legend}
  </svg>`;
}

// Pie chart SVG
function makePieChartSvg(data, W = 500, H = 380) {
  const cx = 180, cy = 175, r = 140;
  let total = data.reduce((s, d) => s + d.value, 0);
  let angle = -Math.PI / 2;
  let slices = data.map(d => {
    const sweep = (d.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const mx = cx + (r * 0.65) * Math.cos(angle - sweep / 2);
    const my = cy + (r * 0.65) * Math.sin(angle - sweep / 2);
    const lg = sweep > Math.PI ? 1 : 0;
    const pct = Math.round((d.value / total) * 100);
    return { path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${lg} 1 ${x2} ${y2} Z`, mx, my, pct, color: d.color, name: d.name };
  });

  const paths = slices.map(s => `<path d="${s.path}" fill="${s.color}" stroke="white" stroke-width="2"/>`).join("");
  const labels = slices.map(s => `<text x="${s.mx}" y="${s.my}" text-anchor="middle" font-size="11" font-weight="bold" fill="white" font-family="Calibri">${s.pct}%</text>`).join("");
  const legend = data.map((d, i) => {
    const ly = 30 + i * 22;
    return `<rect x="360" y="${ly}" width="14" height="14" fill="${d.color}" rx="2"/>
    <text x="380" y="${ly + 11}" font-size="11" fill="#1E293B" font-family="Calibri">${d.name}</text>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="white"/>
    ${paths}
    ${labels}
    ${legend}
  </svg>`;
}

// Scatter plot SVG
function makeScatterSvg(events, thresholds, W = 800, H = 420) {
  const PAD = { top: 40, right: 30, bottom: 55, left: 60 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const maxX = Math.max(...events.map(e => e.x)) + 1;
  const xScale = (v) => PAD.left + ((v - 1) / (maxX - 1)) * cW;
  const yScale = (v) => PAD.top + cH - (v / 0.5) * cH;
  const RCOL = { CRIT: "#9B2335", HIGH: "#E53E3E", MED: "#E76F51" };

  let refLines = thresholds.map(t => {
    const y = yScale(t.value);
    return `<line x1="${PAD.left}" y1="${y}" x2="${PAD.left + cW}" y2="${y}" stroke="${t.color}" stroke-width="1.5" stroke-dasharray="6,3"/>
    <text x="${PAD.left + cW - 4}" y="${y - 5}" text-anchor="end" font-size="10" fill="${t.color}" font-family="Calibri">${t.label}</text>`;
  }).join("\n");

  let grid = [0, 0.1, 0.2, 0.3, 0.4, 0.5].map(v => {
    const y = yScale(v);
    return `<line x1="${PAD.left}" y1="${y}" x2="${PAD.left + cW}" y2="${y}" stroke="#E2E8F0" stroke-width="0.8"/>
    <text x="${PAD.left - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="#64748B" font-family="Calibri">${v.toFixed(1)}</text>`;
  }).join("");

  let xTicks = Array.from({ length: maxX - 1 }, (_, i) => i + 1).filter(v => v % 2 === 1).map(v =>
    `<text x="${xScale(v)}" y="${PAD.top + cH + 18}" text-anchor="middle" font-size="10" fill="#64748B" font-family="Calibri">${v}</text>`
  ).join("");

  let dots = events.map(e => {
    const cx = xScale(e.x), cy = yScale(e.y);
    const col = RCOL[e.risk] || "#888";
    const r = e.risk === "CRIT" ? 9 : 6;
    const ring = e.risk === "CRIT" ? `<circle cx="${cx}" cy="${cy}" r="14" fill="none" stroke="${col}" stroke-width="1.5" opacity="0.5"/>` : "";
    return `${ring}<circle cx="${cx}" cy="${cy}" r="${r}" fill="${col}" stroke="white" stroke-width="1.5" opacity="0.85"/>`;
  }).join("");

  let legend = Object.entries(RCOL).map(([k, c], i) =>
    `<circle cx="${PAD.left + i * 120 + 10}" cy="${H - 14}" r="6" fill="${c}"/>
    <text x="${PAD.left + i * 120 + 22}" y="${H - 10}" font-size="11" fill="#64748B" font-family="Calibri">${k} Risk</text>`
  ).join("");

  let axisLabels = `
    <text x="${PAD.left + cW / 2}" y="${H - 2}" text-anchor="middle" font-size="11" fill="#64748B" font-family="Calibri">Event Index</text>
    <text x="14" y="${PAD.top + cH / 2}" text-anchor="middle" font-size="11" fill="#64748B" font-family="Calibri" transform="rotate(-90, 14, ${PAD.top + cH / 2})">Auth Score</text>
  `;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="white"/>
    ${grid}
    ${refLines}
    ${dots}
    ${xTicks}
    ${axisLabels}
    ${legend}
  </svg>`;
}

// ── PPTX builder ─────────────────────────────────────────────────────────────

async function buildPptx(cfg) {
  const pres = new window.PptxGenJS();
  pres.layout = "LAYOUT_16x9";
  pres.title = "Performix Insights";

  const NAVY = "1A2B4A";
  const NAVY2 = "243B5A";
  const TEAL = "028090";
  const TEAL_L = "02C39A";
  const ORANGE = "E76F51";
  const WHITE = "FFFFFF";
  const BG = "F0F4F8";
  const MUTED = "64748B";
  const DARK = "1E293B";
  const BORDER = "E2E8F0";
  const RED = "E53E3E";
  const GREEN = "48BB78";
  const BLUE = "4299E1";
  const makeShadow = () => ({ type: "outer", blur: 8, offset: 2, color: "000000", opacity: 0.08, angle: 135 });
  const CONF_Y = 5.38;

  const confBar = (slide) => {
    slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: CONF_Y, w: 10, h: 0.24, fill: { color: NAVY }, line: { color: NAVY, width: 0 } });
    slide.addText(cfg.confidentialText, { x: 0, y: CONF_Y, w: 10, h: 0.24, fontSize: 8, color: MUTED, align: "center", valign: "middle", fontFace: "Calibri", charSpacing: 1, margin: 0 });
  };

  const header = (slide, title, sub) => {
    slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.62, fill: { color: NAVY }, line: { color: NAVY, width: 0 } });
    slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0.62, w: 10, h: 0.04, fill: { color: TEAL }, line: { color: TEAL, width: 0 } });
    slide.addText(title, { x: 0.35, y: 0, w: 6, h: 0.62, fontSize: 13, bold: true, color: WHITE, fontFace: "Calibri", valign: "middle", charSpacing: 1.5, margin: 0 });
    if (sub) slide.addText(sub, { x: 6.5, y: 0, w: 3.2, h: 0.62, fontSize: 10, color: MUTED, fontFace: "Calibri", valign: "middle", align: "right", margin: 0 });
  };

  const cardBox = (slide, x, y, w, h, accentColor = TEAL) => {
    slide.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: WHITE }, line: { color: BORDER, width: 0.5 }, shadow: makeShadow() });
    slide.addShape(pres.shapes.RECTANGLE, { x, y, w, h: 0.05, fill: { color: accentColor }, line: { color: accentColor, width: 0 } });
  };

  // ── Slide 1: Cover ──
  {
    const s = pres.addSlide();
    s.background = { color: NAVY };
    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.15, h: 5.625, fill: { color: TEAL }, line: { color: TEAL, width: 0 } });
    s.addShape(pres.shapes.OVAL, { x: 7.2, y: -0.8, w: 3.5, h: 3.5, fill: { color: TEAL, transparency: 88 }, line: { color: TEAL, width: 0 } });
    s.addShape(pres.shapes.OVAL, { x: 8.0, y: 2.6, w: 2.2, h: 2.2, fill: { color: TEAL_L, transparency: 90 }, line: { color: TEAL_L, width: 0 } });
    s.addText("BIOMETRIC & IDENTITY DATA ANALYSIS", { x: 0.5, y: 0.9, w: 7, h: 0.3, fontSize: 9, color: MUTED, fontFace: "Calibri", charSpacing: 2.5, margin: 0 });
    s.addText("Performix Insights", { x: 0.5, y: 1.22, w: 7.5, h: 0.85, fontSize: 38, bold: true, color: WHITE, fontFace: "Georgia", margin: 0 });
    s.addText(cfg.systemName, { x: 0.5, y: 2.1, w: 6, h: 0.44, fontSize: 18, color: TEAL_L, italic: true, fontFace: "Calibri", margin: 0 });
    s.addText(`${cfg.clientName}  ·  ${cfg.dateRange}`, { x: 0.5, y: 2.62, w: 6, h: 0.35, fontSize: 13, color: MUTED, fontFace: "Calibri", margin: 0 });

    s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 3.25, w: 5.2, h: 1.55, fill: { color: NAVY2 }, line: { color: TEAL, width: 0.75 } });
    const infoCols = [
      ["System", cfg.systemName, WHITE],
      ["Algorithm", cfg.algorithmName, WHITE],
      ["Rejection Threshold", String(cfg.primaryRejectionThreshold), ORANGE],
      ["Investigation Threshold", String(cfg.investigationThreshold), ORANGE],
    ];
    infoCols.forEach(([lbl, val, col], i) => {
      const x = 0.68 + i * 1.26;
      s.addText(lbl, { x, y: 3.4, w: 1.22, h: 0.28, fontSize: 8, color: MUTED, fontFace: "Calibri", margin: 0 });
      s.addText(val, { x, y: 3.72, w: 1.22, h: 0.45, fontSize: lbl.includes("Threshold") ? 18 : 12, bold: true, color: col, fontFace: "Calibri", margin: 0 });
    });
    confBar(s);
  }

  // ── Slide 2: System Summary ──
  {
    const s = pres.addSlide();
    s.background = { color: BG };
    header(s, "SYSTEM SUMMARY", `${cfg.clientName}  ·  ${cfg.dateRange}`);

    const metricCards = [
      { lbl: "System Name", val: cfg.systemName, color: DARK, big: false },
      { lbl: "Algorithm", val: cfg.algorithmName, color: DARK, big: false },
      { lbl: "Primary Rejection Threshold", val: String(cfg.primaryRejectionThreshold), color: ORANGE, big: true },
      { lbl: "Investigation Threshold", val: String(cfg.investigationThreshold), color: ORANGE, big: true },
    ];
    metricCards.forEach(({ lbl, val, color, big }, i) => {
      const x = 0.25 + i * 2.38;
      cardBox(s, x, 0.82, 2.25, 1.42);
      s.addText(lbl, { x: x + 0.14, y: 0.96, w: 2.0, h: 0.32, fontSize: 9, color: MUTED, fontFace: "Calibri", margin: 0 });
      s.addText(val, { x: x + 0.14, y: 1.32, w: 2.0, h: 0.72, fontSize: big ? 24 : 14, bold: true, color, fontFace: "Calibri", margin: 0, valign: "middle" });
    });

    s.addShape(pres.shapes.RECTANGLE, { x: 0.25, y: 2.45, w: 9.5, h: 2.72, fill: { color: "EEF7F9" }, line: { color: TEAL, width: 0.75 } });
    s.addText("✦  AI-Generated Insights", { x: 0.42, y: 2.56, w: 4, h: 0.36, fontSize: 12, bold: true, color: TEAL, fontFace: "Calibri", margin: 0 });

    s.addText("KEY INSIGHTS", { x: 0.42, y: 3.0, w: 4.4, h: 0.24, fontSize: 9, bold: true, color: MUTED, fontFace: "Calibri", charSpacing: 2, margin: 0 });
    s.addText(cfg.insights.map((t, i) => ({
      text: t + (i < cfg.insights.length - 1 ? "\n" : ""),
      options: { bullet: true, color: DARK, fontSize: 10, paraSpaceAfter: 3 }
    })), { x: 0.42, y: 3.27, w: 4.4, h: 1.72, fontFace: "Calibri", margin: 0 });

    s.addText("KEY RECOMMENDATIONS", { x: 5.1, y: 3.0, w: 4.5, h: 0.24, fontSize: 9, bold: true, color: MUTED, fontFace: "Calibri", charSpacing: 2, margin: 0 });
    s.addText(cfg.recommendations.slice(0, 3).map((t, i) => ({
      text: t + (i < 2 ? "\n" : ""),
      options: { bullet: true, color: DARK, fontSize: 10, paraSpaceAfter: 3 }
    })), { x: 5.1, y: 3.27, w: 4.5, h: 1.72, fontFace: "Calibri", margin: 0 });
    confBar(s);
  }

  // ── Slide 3: Auth Scores (line chart) ──
  {
    const s = pres.addSlide();
    s.background = { color: BG };
    header(s, "WEEKLY AUTHENTICATION SCORES", "Line chart — distribution bands per week");
    cardBox(s, 0.25, 0.84, 9.5, 4.32);

    const svg = makeLineChartSvg(
      cfg.weeklyAuthScores,
      [
        { key: "max", label: "Max", bold: false },
        { key: "q3", label: "Q3 (75th pct)", bold: false },
        { key: "median", label: "Median", bold: true },
        { key: "q1", label: "Q1 (25th pct)", bold: false },
        { key: "min", label: "Min", bold: false },
      ],
      [
        { value: cfg.primaryRejectionThreshold, color: "#E53E3E", label: "Rejection" },
        { value: cfg.investigationThreshold, color: "#E76F51", label: "Investigation" },
      ],
      "Weekly Authentication Score Distribution"
    );
    const png = await svgToBase64(svg, 800, 420);
    s.addImage({ data: "image/png;base64," + png, x: 0.3, y: 0.9, w: 9.4, h: 4.2 });
    confBar(s);
  }

  // ── Slide 4: Quality Scores (line chart) ──
  {
    const s = pres.addSlide();
    s.background = { color: BG };
    header(s, "WEEKLY AUDIO QUALITY SCORES", "Line chart — distribution bands per week");
    cardBox(s, 0.25, 0.84, 9.5, 4.32);

    const svg = makeLineChartSvg(
      cfg.weeklyQualityScores,
      [
        { key: "max", label: "Max", bold: false },
        { key: "q3", label: "Q3 (75th pct)", bold: false },
        { key: "median", label: "Median", bold: true },
        { key: "q1", label: "Q1 (25th pct)", bold: false },
        { key: "min", label: "Min", bold: false },
      ],
      [{ value: 0.75, color: "#48BB78", label: "Target" }],
      "Weekly Audio Quality Score Distribution"
    );
    const png = await svgToBase64(svg, 800, 420);
    s.addImage({ data: "image/png;base64," + png, x: 0.3, y: 0.9, w: 9.4, h: 4.2 });
    confBar(s);
  }

  // ── Slide 5: Rejections by Device ──
  {
    const s = pres.addSlide();
    s.background = { color: BG };
    header(s, "REJECTIONS BY DEVICE TYPE", `${cfg.clientName}  ·  ${cfg.dateRange}`);

    cardBox(s, 0.25, 0.84, 5.7, 4.32);
    const svg = makePieChartSvg(cfg.rejectionsByDevice, 500, 380);
    const png = await svgToBase64(svg, 500, 380);
    s.addImage({ data: "image/png;base64," + png, x: 0.3, y: 0.9, w: 5.6, h: 4.1 });

    // Right panel
    cardBox(s, 6.2, 0.84, 3.55, 0.52, NAVY);
    s.addShape(pres.shapes.RECTANGLE, { x: 6.2, y: 0.84, w: 3.55, h: 0.52, fill: { color: NAVY }, line: { color: NAVY, width: 0 } });
    s.addText("Key Findings", { x: 6.35, y: 0.84, w: 3.3, h: 0.52, fontSize: 12, bold: true, color: WHITE, fontFace: "Calibri", valign: "middle", margin: 0 });

    const findings = [
      { grp: "Samsung Galaxy", pct: "41%", share: "28% usage", col: RED },
      { grp: "iPhone 14/15", pct: "33%", share: "35% usage", col: BLUE },
      { grp: "Google Pixel", pct: "26%", share: "37% usage", col: GREEN },
    ];
    findings.forEach(({ grp, pct, share, col }, i) => {
      const y = 1.52 + i * 1.02;
      cardBox(s, 6.2, y, 3.55, 0.88, col);
      s.addText(grp, { x: 6.38, y: y + 0.15, w: 2.0, h: 0.3, fontSize: 11, bold: true, color: DARK, fontFace: "Calibri", margin: 0 });
      s.addText(`${pct} of rejections  ·  ${share}`, { x: 6.38, y: y + 0.48, w: 2.2, h: 0.25, fontSize: 9, color: MUTED, fontFace: "Calibri", margin: 0 });
      s.addText(pct, { x: 8.8, y: y + 0.18, w: 0.8, h: 0.52, fontSize: 22, bold: true, color: col, fontFace: "Calibri", align: "right", margin: 0 });
    });
    s.addText("Samsung Galaxy over-indexes on rejections by 13 percentage points relative to usage share.", {
      x: 6.2, y: 4.65, w: 3.55, h: 0.4, fontSize: 9, color: MUTED, italic: true, fontFace: "Calibri", margin: 0
    });
    confBar(s);
  }

  // ── Slide 6: Critical Events Scatter ──
  {
    const s = pres.addSlide();
    s.background = { color: BG };
    header(s, "CRITICAL EVENTS — SCATTER ANALYSIS", "Auth score per event  ·  sized & coloured by risk level");
    cardBox(s, 0.25, 0.84, 9.5, 4.32);

    const svg = makeScatterSvg(
      cfg.criticalEvents,
      [
        { value: cfg.primaryRejectionThreshold, color: "#E53E3E", label: "Rejection Threshold" },
        { value: cfg.investigationThreshold, color: "#E76F51", label: "Investigation Threshold" },
      ]
    );
    const png = await svgToBase64(svg, 800, 420);
    s.addImage({ data: "image/png;base64," + png, x: 0.3, y: 0.9, w: 9.4, h: 4.2 });
    confBar(s);
  }

  // ── Slide 7: Investigation Queue ──
  {
    const s = pres.addSlide();
    s.background = { color: BG };
    header(s, "OUTLIERS & INVESTIGATION QUEUE", "");
    s.addShape(pres.shapes.OVAL, { x: 8.4, y: 0.1, w: 1.3, h: 0.44, fill: { color: ORANGE }, line: { color: ORANGE, width: 0 } });
    s.addText(`${cfg.outliers.length} Items`, { x: 8.4, y: 0.1, w: 1.3, h: 0.44, fontSize: 10, bold: true, color: WHITE, align: "center", valign: "middle", fontFace: "Calibri", margin: 0 });

    const cols = ["Event ID", "Date & Time", "Customer ID", "Auth Score", "Quality Score", "Device", "Action"];
    const colW = [1.3, 1.55, 1.45, 0.95, 1.0, 1.35, 1.1];
    const colX = colW.reduce((acc, w, i) => { acc.push(i === 0 ? 0.25 : acc[i - 1] + colW[i - 1]); return acc; }, []);

    s.addShape(pres.shapes.RECTANGLE, { x: 0.25, y: 0.82, w: 9.5, h: 0.42, fill: { color: NAVY }, line: { color: NAVY, width: 0 } });
    cols.forEach((h, i) => s.addText(h, { x: colX[i] + 0.08, y: 0.82, w: colW[i], h: 0.42, fontSize: 9, bold: true, color: WHITE, fontFace: "Calibri", valign: "middle", margin: 0 }));

    cfg.outliers.forEach((row, ri) => {
      const y = 1.26 + ri * 0.52;
      s.addShape(pres.shapes.RECTANGLE, { x: 0.25, y, w: 9.5, h: 0.5, fill: { color: ri % 2 === 0 ? WHITE : "F8FAFC" }, line: { color: BORDER, width: 0.4 } });
      const cells = [row.id, row.datetime, row.customerId, String(row.authScore), String(row.qualityScore), row.device, row.action];
      cells.forEach((cell, ci) => {
        const scoreColor = ci === 3 ? (row.authScore < 0.30 ? RED : ORANGE) : DARK;
        const actionColor = ci === 6 ? (row.action === "REVIEW" ? RED : "16A34A") : DARK;
        s.addText(cell, { x: colX[ci] + 0.08, y: y + 0.06, w: colW[ci], h: 0.38, fontSize: 9.5, bold: ci === 3 || ci === 6, color: ci === 3 ? scoreColor : (ci === 6 ? actionColor : DARK), fontFace: "Calibri", valign: "middle", margin: 0 });
      });
    });
    s.addText(`Showing ${cfg.outliers.length} of 17 items  ·  12 occurred during peak hours (10 AM – 2 PM)`, { x: 0.25, y: 5.2, w: 9.5, h: 0.24, fontSize: 9, color: MUTED, fontFace: "Calibri", margin: 0 });
    confBar(s);
  }

  // ── Slide 8: Scorecard ──
  {
    const s = pres.addSlide();
    s.background = { color: BG };
    header(s, "PERFORMANCE SCORECARD", `${cfg.clientName}  ·  ${cfg.dateRange}`);

    const positions = [
      [0.25, 0.84], [3.45, 0.84], [6.65, 0.84],
      [0.25, 2.92], [3.45, 2.92], [6.65, 2.92],
    ];
    cfg.scorecard.forEach((m, i) => {
      const [x, y] = positions[i];
      const col = m.color.replace("#", "");
      cardBox(s, x, y, 3.0, 1.88, col);
      s.addText(m.label, { x: x + 0.15, y: y + 0.2, w: 2.72, h: 0.32, fontSize: 10, color: MUTED, fontFace: "Calibri", margin: 0 });
      s.addText(m.value, { x: x + 0.15, y: y + 0.55, w: 2.72, h: 0.82, fontSize: 30, bold: true, color: col, fontFace: "Calibri", margin: 0 });
      s.addText(m.sub, { x: x + 0.15, y: y + 1.46, w: 2.72, h: 0.3, fontSize: 10, color: MUTED, italic: true, fontFace: "Calibri", margin: 0 });
    });
    confBar(s);
  }

  // ── Slide 9: Recommendations ──
  {
    const s = pres.addSlide();
    s.background = { color: NAVY };
    s.addShape(pres.shapes.OVAL, { x: 7.5, y: 2.8, w: 3.0, h: 3.0, fill: { color: TEAL, transparency: 90 }, line: { color: TEAL, width: 0 } });
    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.12, h: 5.625, fill: { color: TEAL }, line: { color: TEAL, width: 0 } });
    s.addText("Recommendations", { x: 0.4, y: 0.28, w: 8, h: 0.68, fontSize: 28, bold: true, color: WHITE, fontFace: "Georgia", margin: 0 });
    s.addText("& Next Steps", { x: 0.4, y: 0.96, w: 6, h: 0.44, fontSize: 20, color: TEAL_L, italic: true, fontFace: "Calibri", margin: 0 });

    cfg.recommendations.forEach((rec, i) => {
      const y = 1.6 + i * 0.84;
      s.addShape(pres.shapes.RECTANGLE, { x: 0.4, y, w: 9.2, h: 0.72, fill: { color: NAVY2 }, line: { color: TEAL, width: 0.75 } });
      s.addShape(pres.shapes.RECTANGLE, { x: 0.4, y, w: 0.1, h: 0.72, fill: { color: TEAL_L }, line: { color: TEAL_L, width: 0 } });
      s.addText(`0${i + 1}`, { x: 0.58, y: y + 0.14, w: 0.4, h: 0.44, fontSize: 15, bold: true, color: TEAL, fontFace: "Calibri", margin: 0 });
      s.addText(rec, { x: 1.08, y: y + 0.12, w: 8.3, h: 0.5, fontSize: 11, color: "CBD5E1", fontFace: "Calibri", margin: 0, valign: "middle" });
    });
    s.addText(`${cfg.systemName}  ·  ${cfg.algorithmName}  ·  © 2026 ${cfg.company}`, { x: 0.4, y: 5.18, w: 9, h: 0.22, fontSize: 9, color: MUTED, fontFace: "Calibri", margin: 0 });
    confBar(s);
  }

  return pres;
}

// ── DEFAULT CONFIG ────────────────────────────────────────────────────────────

const DEFAULT_CFG = {
  systemName: "VoiceGuard Pro",
  algorithmName: "DeepVoice ML v3.2",
  primaryRejectionThreshold: 0.35,
  investigationThreshold: 0.50,
  clientName: "Bank Sample",
  dateRange: "7th Jan – 14th Jan 2025",
  version: "v0.1.1",
  company: "Biometix",
  confidentialText: "PRIVATE & CONFIDENTIAL — For authorised recipients only. Not for distribution.",
  insights: [
    "Apple devices (iPhone 14/15) demonstrate consistently higher quality scores (avg 0.78) vs Android (avg 0.71)",
    "17 outlier events detected this week — 12 occurred during peak hours (10 AM–2 PM), suggesting system load issues",
    "Samsung Galaxy devices account for 41% of all rejections, disproportionate to their 28% usage share",
  ],
  recommendations: [
    "Raise investigation threshold to 0.55 during peak hours (10 AM–2 PM) to reduce false positives while maintaining security",
    "Review and update voice enrollment prompts to improve initial template quality for users in noisy environments",
    "Initiate deep-dive analysis on Samsung Galaxy S22/S23 rejection patterns — over-represented by 13ppt vs usage share",
    "Assess system load during 10 AM–2 PM window — 70% of outlier events cluster here, suggesting infrastructure constraints",
  ],
  weeklyAuthScores: [
    { week: "Wk 1", min: 0.18, q1: 0.28, median: 0.45, q3: 0.65, max: 0.88 },
    { week: "Wk 2", min: 0.20, q1: 0.30, median: 0.48, q3: 0.68, max: 0.91 },
    { week: "Wk 3", min: 0.15, q1: 0.26, median: 0.43, q3: 0.63, max: 0.85 },
    { week: "Wk 4", min: 0.22, q1: 0.32, median: 0.50, q3: 0.70, max: 0.93 },
  ],
  weeklyQualityScores: [
    { week: "Wk 1", min: 0.22, q1: 0.32, median: 0.50, q3: 0.70, max: 0.90 },
    { week: "Wk 2", min: 0.25, q1: 0.35, median: 0.53, q3: 0.73, max: 0.92 },
    { week: "Wk 3", min: 0.20, q1: 0.30, median: 0.48, q3: 0.68, max: 0.88 },
    { week: "Wk 4", min: 0.28, q1: 0.38, median: 0.56, q3: 0.76, max: 0.95 },
  ],
  rejectionsByDevice: [
    { name: "Samsung S23", value: 22, color: "#E53E3E" },
    { name: "Samsung S22", value: 19, color: "#FC8181" },
    { name: "iPhone 14", value: 15, color: "#4299E1" },
    { name: "Google Pixel 7", value: 14, color: "#48BB78" },
    { name: "Google Pixel 6", value: 12, color: "#38A169" },
    { name: "iPhone 15", value: 18, color: "#2B6CB0" },
  ],
  criticalEvents: [
    { x: 1, y: 0.21, label: "EVT-10042", device: "Samsung S23", risk: "HIGH" },
    { x: 2, y: 0.19, label: "EVT-10085", device: "Samsung S22", risk: "HIGH" },
    { x: 3, y: 0.29, label: "EVT-10121", device: "Pixel 7", risk: "MED" },
    { x: 4, y: 0.16, label: "EVT-10189", device: "Samsung S23", risk: "CRIT" },
    { x: 5, y: 0.31, label: "EVT-10234", device: "iPhone 14", risk: "MED" },
    { x: 6, y: 0.23, label: "EVT-10298", device: "Samsung S22", risk: "HIGH" },
    { x: 7, y: 0.18, label: "EVT-10341", device: "Pixel 6", risk: "HIGH" },
    { x: 8, y: 0.12, label: "EVT-10402", device: "Samsung S23", risk: "CRIT" },
    { x: 9, y: 0.27, label: "EVT-10455", device: "iPhone 15", risk: "MED" },
    { x: 10, y: 0.14, label: "EVT-10498", device: "Samsung S22", risk: "CRIT" },
    { x: 11, y: 0.25, label: "EVT-10531", device: "Pixel 7", risk: "HIGH" },
    { x: 12, y: 0.20, label: "EVT-10589", device: "Samsung S23", risk: "HIGH" },
    { x: 13, y: 0.09, label: "EVT-10612", device: "Samsung S22", risk: "CRIT" },
    { x: 14, y: 0.30, label: "EVT-10634", device: "Pixel 6", risk: "MED" },
    { x: 15, y: 0.22, label: "EVT-10701", device: "Samsung S23", risk: "HIGH" },
    { x: 16, y: 0.17, label: "EVT-10745", device: "Samsung S22", risk: "HIGH" },
    { x: 17, y: 0.28, label: "EVT-10789", device: "iPhone 14", risk: "MED" },
  ],
  outliers: [
    { id: "EVT-10042", datetime: "Jan 8, 09:43 AM", customerId: "CID-50192", authScore: 0.29, qualityScore: 0.71, device: "Samsung S23", action: "REVIEW" },
    { id: "EVT-10085", datetime: "Jan 8, 11:22 AM", customerId: "CID-50387", authScore: 0.31, qualityScore: 0.68, device: "Samsung S22", action: "REVIEW" },
    { id: "EVT-10121", datetime: "Jan 9, 10:05 AM", customerId: "CID-50521", authScore: 0.33, qualityScore: 0.74, device: "Pixel 7", action: "MONITOR" },
    { id: "EVT-10189", datetime: "Jan 9, 01:14 PM", customerId: "CID-50612", authScore: 0.28, qualityScore: 0.62, device: "Samsung S23", action: "REVIEW" },
    { id: "EVT-10234", datetime: "Jan 10, 11:52 AM", customerId: "CID-50891", authScore: 0.34, qualityScore: 0.70, device: "iPhone 14", action: "MONITOR" },
    { id: "EVT-10298", datetime: "Jan 11, 12:33 PM", customerId: "CID-51023", authScore: 0.30, qualityScore: 0.67, device: "Samsung S22", action: "REVIEW" },
    { id: "EVT-10341", datetime: "Jan 13, 10:17 AM", customerId: "CID-51244", authScore: 0.27, qualityScore: 0.73, device: "Pixel 6", action: "REVIEW" },
  ],
  scorecard: [
    { label: "Total Events", value: "3,842", sub: "This week", color: "#028090" },
    { label: "Total Rejections", value: "247", sub: "6.4% rejection rate", color: "#E53E3E" },
    { label: "Outliers Flagged", value: "17", sub: "0.44% of events", color: "#E76F51" },
    { label: "Avg Auth Score", value: "0.463", sub: "Below 0.50 threshold", color: "#E76F51" },
    { label: "Avg Quality Score", value: "0.541", sub: "Within normal range", color: "#48BB78" },
    { label: "Peak Hour Events", value: "1,201", sub: "31% of daily volume", color: "#4299E1" },
  ],
};

// ── UI HELPERS ────────────────────────────────────────────────────────────────

const T = { navy: "#1A2B4A", teal: "#028090", tealL: "#02C39A", orange: "#E76F51", muted: "#64748B", border: "#E2E8F0", bg: "#F0F4F8", text: "#1E293B" };

function Field({ label, value, onChange, type = "text", rows }) {
  const s = { width: "100%", padding: "5px 8px", border: `1px solid ${T.border}`, borderRadius: 4, fontSize: 12, fontFamily: "inherit", background: "#fff", color: T.text, boxSizing: "border-box" };
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: "block", fontSize: 10, color: T.muted, fontWeight: 600, marginBottom: 3, letterSpacing: "0.06em" }}>{label}</label>
      {rows ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} style={{ ...s, resize: "vertical" }} />
             : <input type={type} value={value} onChange={e => onChange(type === "number" ? parseFloat(e.target.value) : e.target.value)} style={s} />}
    </div>
  );
}

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 12, border: `1px solid ${T.teal}33`, borderRadius: 6, overflow: "hidden" }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: "100%", background: T.navy, color: "#fff", border: "none", padding: "7px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: "0.08em", display: "flex", justifyContent: "space-between" }}>
        {title} <span style={{ opacity: 0.5 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && <div style={{ padding: "12px 12px 4px", background: "#0F1923" }}>{children}</div>}
    </div>
  );
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────

export default function PerformixPptxGenerator() {
  const pptxReady = usePptxGen();
  const [cfg, setCfg] = useState(DEFAULT_CFG);
  const [status, setStatus] = useState("idle"); // idle | building | done | error
  const [errorMsg, setErrorMsg] = useState("");

  const set = (key) => (val) => setCfg(c => ({ ...c, [key]: val }));
  const setArr = (key) => (val) => set(key)(val.split("\n").filter(Boolean));

  const handleGenerate = async () => {
    if (!pptxReady) return;
    setStatus("building");
    setErrorMsg("");
    try {
      const pres = await buildPptx(cfg);
      const fileName = `Performix_Insights_${cfg.clientName.replace(/\s+/g, "_")}.pptx`;
      await pres.writeFile({ fileName });
      setStatus("done");
      setTimeout(() => setStatus("idle"), 3500);
    } catch (e) {
      console.error(e);
      setErrorMsg(e.message);
      setStatus("error");
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0A1218", fontFamily: "'Trebuchet MS', Calibri, sans-serif", color: "#fff" }}>

      {/* ── SIDEBAR ── */}
      <div style={{ width: 300, background: "#111B26", borderRight: `1px solid ${T.teal}33`, display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>
        {/* Logo strip */}
        <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid ${T.teal}33` }}>
          <div style={{ color: T.tealL, fontSize: 13, fontWeight: 800, letterSpacing: "0.12em" }}>PERFORMIX</div>
          <div style={{ color: T.muted, fontSize: 10, marginTop: 1 }}>PPTX Report Generator</div>
        </div>

        {/* Scrollable form */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 12px" }}>

          <Section title="SYSTEM CONFIG">
            <Field label="System Name" value={cfg.systemName} onChange={set("systemName")} />
            <Field label="Algorithm" value={cfg.algorithmName} onChange={set("algorithmName")} />
            <Field label="Rejection Threshold" value={cfg.primaryRejectionThreshold} onChange={set("primaryRejectionThreshold")} type="number" />
            <Field label="Investigation Threshold" value={cfg.investigationThreshold} onChange={set("investigationThreshold")} type="number" />
          </Section>

          <Section title="BRANDING">
            <Field label="Client Name" value={cfg.clientName} onChange={set("clientName")} />
            <Field label="Date Range" value={cfg.dateRange} onChange={set("dateRange")} />
            <Field label="Company" value={cfg.company} onChange={set("company")} />
            <Field label="Confidential Footer Text" value={cfg.confidentialText} onChange={set("confidentialText")} rows={2} />
          </Section>

          <Section title="INSIGHTS & RECOMMENDATIONS">
            <Field label="Key Insights (one per line)" value={cfg.insights.join("\n")} onChange={setArr("insights")} rows={5} />
            <Field label="Recommendations (one per line)" value={cfg.recommendations.join("\n")} onChange={setArr("recommendations")} rows={5} />
          </Section>

          <Section title="WEEKLY AUTH SCORES" defaultOpen={false}>
            {cfg.weeklyAuthScores.map((row, i) => (
              <div key={i} style={{ marginBottom: 10, padding: 8, background: "#0A1218", borderRadius: 4, border: `1px solid ${T.teal}22` }}>
                <div style={{ fontSize: 10, color: T.tealL, fontWeight: 700, marginBottom: 6 }}>{row.week}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 4 }}>
                  {["min", "q1", "median", "q3", "max"].map(k => (
                    <div key={k}>
                      <div style={{ fontSize: 9, color: T.muted, marginBottom: 2 }}>{k}</div>
                      <input type="number" step="0.01" value={row[k]} onChange={e => {
                        const next = [...cfg.weeklyAuthScores]; next[i] = { ...next[i], [k]: parseFloat(e.target.value) };
                        setCfg(c => ({ ...c, weeklyAuthScores: next }));
                      }} style={{ width: "100%", padding: "3px 4px", border: `1px solid ${T.border}`, borderRadius: 3, fontSize: 11, boxSizing: "border-box" }} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </Section>

          <Section title="WEEKLY QUALITY SCORES" defaultOpen={false}>
            {cfg.weeklyQualityScores.map((row, i) => (
              <div key={i} style={{ marginBottom: 10, padding: 8, background: "#0A1218", borderRadius: 4, border: `1px solid ${T.teal}22` }}>
                <div style={{ fontSize: 10, color: T.tealL, fontWeight: 700, marginBottom: 6 }}>{row.week}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 4 }}>
                  {["min", "q1", "median", "q3", "max"].map(k => (
                    <div key={k}>
                      <div style={{ fontSize: 9, color: T.muted, marginBottom: 2 }}>{k}</div>
                      <input type="number" step="0.01" value={row[k]} onChange={e => {
                        const next = [...cfg.weeklyQualityScores]; next[i] = { ...next[i], [k]: parseFloat(e.target.value) };
                        setCfg(c => ({ ...c, weeklyQualityScores: next }));
                      }} style={{ width: "100%", padding: "3px 4px", border: `1px solid ${T.border}`, borderRadius: 3, fontSize: 11, boxSizing: "border-box" }} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </Section>

          <Section title="SCORECARD VALUES" defaultOpen={false}>
            {cfg.scorecard.map((m, i) => (
              <div key={i} style={{ marginBottom: 8, padding: 8, background: "#0A1218", borderRadius: 4, border: `1px solid ${T.teal}22` }}>
                <div style={{ fontSize: 10, color: T.tealL, fontWeight: 700, marginBottom: 5 }}>{m.label}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <input value={m.value} onChange={e => { const n = [...cfg.scorecard]; n[i] = { ...n[i], value: e.target.value }; setCfg(c => ({ ...c, scorecard: n })); }}
                    style={{ flex: 1, padding: "4px 6px", border: `1px solid ${T.border}`, borderRadius: 3, fontSize: 11 }} placeholder="Value" />
                  <input value={m.sub} onChange={e => { const n = [...cfg.scorecard]; n[i] = { ...n[i], sub: e.target.value }; setCfg(c => ({ ...c, scorecard: n })); }}
                    style={{ flex: 2, padding: "4px 6px", border: `1px solid ${T.border}`, borderRadius: 3, fontSize: 11 }} placeholder="Sub-label" />
                </div>
              </div>
            ))}
          </Section>

        </div>
      </div>

      {/* ── MAIN PANEL ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40 }}>
        {/* Central card */}
        <div style={{ background: "#111B26", border: `1px solid ${T.teal}44`, borderRadius: 12, padding: "40px 48px", maxWidth: 520, width: "100%", textAlign: "center", boxShadow: "0 8px 40px rgba(0,0,0,0.4)" }}>

          {/* Icon */}
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: `${T.teal}22`, border: `2px solid ${T.teal}66`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 32 }}>
            📊
          </div>

          <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 800, color: "#fff", fontFamily: "Georgia, serif" }}>Performix Insights</h1>
          <p style={{ color: T.muted, fontSize: 13, margin: "0 0 28px" }}>Configure parameters in the sidebar, then generate your branded PPTX report.</p>

          {/* Slide list */}
          <div style={{ background: "#0A1218", borderRadius: 8, padding: "14px 18px", marginBottom: 28, textAlign: "left" }}>
            <div style={{ color: T.tealL, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 10 }}>9 SLIDES INCLUDED</div>
            {[
              ["01", "Cover Page"],
              ["02", "System Summary + AI Insights"],
              ["03", "Weekly Auth Scores (Line)"],
              ["04", "Weekly Quality Scores (Line)"],
              ["05", "Rejections by Device (Pie)"],
              ["06", "Critical Events Scatter Plot"],
              ["07", "Outliers & Investigation Queue"],
              ["08", "Performance Scorecard"],
              ["09", "Recommendations & Next Steps"],
            ].map(([num, label]) => (
              <div key={num} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
                <span style={{ background: T.teal, color: "#fff", fontSize: 9, fontWeight: 700, borderRadius: 3, padding: "1px 6px", minWidth: 22, textAlign: "center" }}>{num}</span>
                <span style={{ color: "#CBD5E1", fontSize: 12 }}>{label}</span>
              </div>
            ))}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.teal}22`, color: T.muted, fontSize: 10, fontStyle: "italic" }}>
              Private & Confidential footer on every slide
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!pptxReady || status === "building"}
            style={{
              width: "100%", padding: "14px", borderRadius: 8, border: "none",
              background: status === "done" ? "#16A34A" : status === "error" ? "#B91C1C" : !pptxReady ? "#374151" : T.teal,
              color: "#fff", fontSize: 15, fontWeight: 700, cursor: !pptxReady || status === "building" ? "not-allowed" : "pointer",
              letterSpacing: "0.05em", transition: "all 0.2s",
              boxShadow: status === "idle" && pptxReady ? `0 0 20px ${T.teal}66` : "none",
            }}>
            {!pptxReady ? "⏳ Loading PptxGenJS..." :
             status === "building" ? "⚙️ Generating PPTX..." :
             status === "done" ? "✅ Downloaded!" :
             status === "error" ? "❌ Error — Try Again" :
             "⬇  Generate & Download PPTX"}
          </button>

          {status === "error" && errorMsg && (
            <div style={{ marginTop: 12, padding: "8px 12px", background: "#450a0a", borderRadius: 6, color: "#FCA5A5", fontSize: 11, textAlign: "left" }}>
              {errorMsg}
            </div>
          )}

          {status === "building" && (
            <div style={{ marginTop: 14, color: T.muted, fontSize: 11 }}>
              Rendering charts to images and building slides…
            </div>
          )}

          <p style={{ color: "#374151", fontSize: 10, marginTop: 20, marginBottom: 0 }}>
            All processing is client-side — no data leaves your browser.
          </p>
        </div>
      </div>
    </div>
  );
}
