// reports/charts.ts

import Plotly from "plotly.js-dist-min";
import type { WeeklyScoreRow, DeviceRejection, CriticalEvent, OutlierRow, ScorecardMetric, ReportConfig, HistogramBin, HistogramThresholds } from "./types.ts";
import { PIE_PALETTE, RISK_COLORS } from "./theme";
import { Scale } from "lucide-react";


/* ─────────────────────────────────────────────────────────────────────────────
   PLOTLY → PNG
   Renders a Plotly figure into an offscreen <div>, extracts the SVG that
   Plotly writes into the DOM, then rasterises it to a PNG via <canvas>.
   Returns a base64 string (no data-URI prefix) suitable for PptxGenJS.
───────────────────────────────────────────────────────────────────────────── */
const FONT = {
    title: 40,
    axisTitle: 30,
    ticks: 24,
    legend: 24,
};

async function plotlyToPng(
    traces: Plotly.Data[],
    layout: Partial<Plotly.Layout>,
    W = 800,
    H = 630,
): Promise<string> {
    const div = document.createElement("div");
    div.style.cssText = `position:fixed;left:-9999px;top:-9999px;width:${W}px;height:${H}px;`;
    document.body.appendChild(div);

    // ✅ Caller's layout spreads FIRST, so defaults only fill gaps
    const fullLayout: Partial<Plotly.Layout> = {
        width: W,
        height: H,
        paper_bgcolor: "#FFFFFF",
        plot_bgcolor: "#FFFFFF",
        font: { family: "Calibri, sans-serif", size: 13, color: "#1E293B" },
        margin: { t: 60, r: 40, b: 80, l: 70 },  // fallback default
        ...layout,                                  // caller overrides everything above
    };

    await Plotly.newPlot(div, traces, fullLayout, { staticPlot: true, displayModeBar: false });

    // ✅ Use Plotly's own toImage instead of manually serializing SVG layers
    const dataUrl = await Plotly.toImage(div, {
        format: "png",
        width: W,
        height: H,
        scale: 2  // increase resolution for better quality in PPTX
    });

    Plotly.purge(div);
    document.body.removeChild(div);

    // toImage returns a full data URL — strip the prefix
    return dataUrl.split(",")[1];
}

/* ─────────────────────────────────────────────────────────────────────────────
   CHART FUNCTIONS  (all return base64 PNG, no data-URI prefix)
───────────────────────────────────────────────────────────────────────────── */

/** Line chart showing five distribution bands per week + threshold lines. */
export async function weeklyDistributionChart(
    data: WeeklyScoreRow[],
    rejectionThreshold: number,
    investigationThreshold: number,
    title: string,
): Promise<string> {
    const weeks = data.map(d => d.week);

    const SERIES: Array<{
        key: keyof WeeklyScoreRow;
        name: string;
        color: string;
        width: number;
        dash: Plotly.Dash;
    }> = [
            { key: "max", name: "Max", color: "#90CDF4", width: 2, dash: "dot" },
            { key: "q3", name: "Q3 (75th)", color: "#4299E1", width: 2.5, dash: "solid" },
            { key: "median", name: "Median", color: "#028090", width: 3.5, dash: "solid" },
            { key: "q1", name: "Q1 (25th)", color: "#E76F51", width: 2.5, dash: "solid" },
            { key: "min", name: "Min", color: "#E53E3E", width: 2, dash: "dash" },
        ];

    const seriesTraces: Plotly.Data[] = SERIES.map(s => ({
        type: "scatter" as const,
        mode: "lines+markers" as const,
        name: s.name,
        x: weeks,
        y: data.map(d => d[s.key] as number),
        line: { color: s.color, width: s.width, dash: s.dash },
        marker: {
            color: s.color,
            size: s.key === "median" ? 10 : 7,
            line: { color: "#fff", width: 2 },
        },
    }));

    const thresholdTraces: Plotly.Data[] = [
        {
            type: "scatter",
            mode: "lines+text",
            name: `Rejection: ${rejectionThreshold}`,
            x: [weeks[0], weeks[weeks.length - 1]],
            y: [rejectionThreshold, rejectionThreshold],
            line: { color: "#E53E3E", width: 1.5, dash: "dash" },
            text: [`  Rejection: ${rejectionThreshold}`, ""],
            textposition: "top right",
            textfont: { color: "#E53E3E", size: 11 },
            hoverinfo: "skip",
            showlegend: true,
        },
        {
            type: "scatter",
            mode: "lines+text",
            name: `Investigation: ${investigationThreshold}`,
            x: [weeks[0], weeks[weeks.length - 1]],
            y: [investigationThreshold, investigationThreshold],
            line: { color: "#E76F51", width: 1.5, dash: "dash" },
            text: [`  Investigation: ${investigationThreshold}`, ""],
            textposition: "top right",
            textfont: { color: "#E76F51", size: 11 },
            hoverinfo: "skip",
            showlegend: true,
        },
    ];

    const allTraces: Plotly.Data[] = [...seriesTraces, ...thresholdTraces];

    const layout: Partial<Plotly.Layout> = {
        title: { text: title, font: { size: 16, color: "#1E293B" } },
        xaxis: {
            title: { text: "Week", standoff: 10 },
            tickfont: { color: "#64748B" },
            gridcolor: "#E2E8F0",
            linecolor: "#E2E8F0",
        },
        yaxis: {
            title: { text: "Score", standoff: 10 },
            range: [0, 1],
            tickfont: { color: "#64748B" },
            gridcolor: "#E2E8F0",
            linecolor: "#E2E8F0",
        },
        legend: {
            orientation: "h",
            y: -0.18,
            x: 0.5,
            xanchor: "center",
            font: { size: 12 },
        },
        annotations: [
            {
                xref: "paper", yref: "paper",
                x: 1.08, y: -0.08,              // position above the chart
                xanchor: "center", yanchor: "bottom",
                text: "Your comment here",
                showarrow: false,
                font: { size: 12, color: "#1E293B" },
                bgcolor: "#F1F5F9",
                bordercolor: "#CBD5E1",
                borderwidth: 1,
                borderpad: 6,
            },
        ],
        showlegend: true

    };

    return plotlyToPng(allTraces, layout);
}

/** Pie chart of rejections by device. */
export async function devicePieChart(data: DeviceRejection[]): Promise<string> {
    const traces: Plotly.Data[] = [{
        type: "pie" as const,
        labels: data.map(d => d.name),
        values: data.map(d => d.value),
        marker: { colors: data.map((d, i) => d.color ?? PIE_PALETTE[i % PIE_PALETTE.length]) },
        textinfo: "percent",
        textfont: { size: 13, color: "#FFFFFF" },
        hoverinfo: "label+percent+value",
        hole: 0,
        outsidetextfont: { size: 12, color: "#1E293B" },
    }];

    const layout: Partial<Plotly.Layout> = {
        title: { text: "Rejection Share by Device", font: { size: 16, color: "#1E293B" } },
        showlegend: true,
        legend: { orientation: "v", x: 1.02, y: 0.5, xanchor: "left", font: { size: 12 } },
        margin: { t: 60, r: 180, b: 40, l: 40 },
    };

    return plotlyToPng(traces, layout, 700, 540);
}

/** Scatter plot of critical events coloured by risk level. */
export async function criticalScatter(
    events: CriticalEvent[],
    rejectionThreshold: number,
    investigationThreshold: number,
): Promise<string> {
    // Split events by risk level so we get separate legend entries
    const byRisk: Record<string, CriticalEvent[]> = { CRIT: [], HIGH: [], MED: [] };
    events.forEach(e => { (byRisk[e.risk] ??= []).push(e); });

    const SIZE: Record<string, number> = { CRIT: 18, HIGH: 12, MED: 9 };

    const traces: Plotly.Data[] = Object.entries(byRisk)
        .filter(([, evts]) => evts.length > 0)
        .map(([risk, evts]) => ({
            type: "scatter" as const,
            mode: "markers" as const,
            name: `${risk} Risk`,
            x: evts.map(e => e.x),
            y: evts.map(e => e.y),
            text: evts.map(e => `${e.label ?? ""}${e.device ? ` · ${e.device}` : ""}`),
            hovertemplate: "<b>%{text}</b><br>Score: %{y}<br>Event: %{x}<extra></extra>",
            marker: {
                color: RISK_COLORS[risk] ?? "#888",
                size: SIZE[risk] ?? 10,
                opacity: 0.88,
                line: { color: "#FFFFFF", width: 2 },
                symbol: risk === "CRIT" ? "circle-open-dot" : "circle",
            },
        }));

    const layout: Partial<Plotly.Layout> = {
        title: { text: "Critical Events — Auth Score by Event Index", font: { size: 16, color: "#1E293B" } },
        xaxis: {
            title: { text: "Event Index", standoff: 10 },
            tickfont: { color: "#64748B" },
            gridcolor: "#E2E8F0",
            linecolor: "#E2E8F0",
            dtick: 1,
        },
        yaxis: {
            title: { text: "Authentication Score", standoff: 10 },
            range: [0, 0.55],
            tickfont: { color: "#64748B" },
            gridcolor: "#E2E8F0",
            linecolor: "#E2E8F0",
        },
        shapes: [
            {
                type: "line", xref: "paper", x0: 0, x1: 1,
                yref: "y", y0: rejectionThreshold, y1: rejectionThreshold,
                line: { color: "#E53E3E", width: 1.5, dash: "dash" },
            },
            {
                type: "line", xref: "paper", x0: 0, x1: 1,
                yref: "y", y0: investigationThreshold, y1: investigationThreshold,
                line: { color: "#E76F51", width: 1.5, dash: "dash" },
            },
        ],
        annotations: [
            {
                xref: "paper", x: 0.99, yref: "y", y: rejectionThreshold,
                text: `Rejection: ${rejectionThreshold}`, showarrow: false,
                font: { color: "#E53E3E", size: 11 }, xanchor: "right", yanchor: "bottom",
            },
            {
                xref: "paper", x: 0.99, yref: "y", y: investigationThreshold,
                text: `Investigation: ${investigationThreshold}`, showarrow: false,
                font: { color: "#E76F51", size: 11 }, xanchor: "right", yanchor: "bottom",
            },
        ],
        legend: { orientation: "h", y: -0.18, x: 0.5, xanchor: "center", font: { size: 12 } },
        showlegend: true,
    };

    return plotlyToPng(traces, layout);
}

/** 
 * Histogram comparison chart showing:
 *  - Match distribution
 *  - Non-match distribution
 *  - Threshold decision lines
 */
export async function matchHistogramChart(
    data: MatchDistribution,
    thresholds: HistogramThresholds,
    title: string,
): Promise<string> {



    console.log("Generating match histogram with data:", data, "and thresholds:", thresholds);
    if (!data?.match || !Array.isArray(data.match) || data.match.length === 0) {
        throw new Error("Invalid or missing match distribution data");
    }
    if (!data?.nonMatch || !Array.isArray(data.nonMatch) || data.nonMatch.length === 0) {
        throw new Error("Invalid or missing non-match distribution data");
    }

    const binCenters = (bins: HistogramBin[]) =>
        bins.map(b => (b.binStart + b.binEnd) / 2);

    const xs = binCenters(data.match);
    const ys = data.match.map(b => Number(b.count));
    const ws = data.match.map(b => Number(b.binEnd) - Number(b.binStart));

    /* ───────────────── MATCH DISTRIBUTION ───────────────── */

    const matchTrace: Plotly.Data = {
        type: "bar",
        name: "Match",
        x: binCenters(data.match),
        y: data.match.map(b => Number(b.count)),
        //width: data.match.map(b => b.binEnd - b.binStart),
        marker: {
            color: "#028090",
            opacity: 0.75,
        },
        bargap: 0,
        bargroupgap: 0,
    };

    /* ─────────────── NON MATCH DISTRIBUTION ─────────────── */

    const nonMatchTrace: Plotly.Data = {
        type: "bar",
        name: "Non-Match",
        x: binCenters(data.nonMatch),
        y: data.nonMatch.map(b => Number(b.count)),
        //width: data.match.map(b => b.binEnd - b.binStart),
        marker: {
            color: "#E76F51",
            opacity: 0.75,
        },
         bargap: 0,
        bargroupgap: 0,
    };

    /* ───────────────── THRESHOLD LINES ───────────────── */

    const xMin = Math.min(
        ...data.match.map(b => b.binStart),
        ...data.nonMatch.map(b => b.binStart),
    );

    const xMax = Math.max(
        ...data.match.map(b => b.binEnd),
        ...data.nonMatch.map(b => b.binEnd),
    );

    const rejectionTrace: Plotly.Data = {
        type: "scatter",
        mode: "lines+text",
        name: `Rejection: ${thresholds.rejectionThreshold}`,
        x: [thresholds.rejectionThreshold, thresholds.rejectionThreshold],
        y: [0, Math.max(
            ...data.match.map(b => b.count),
            ...data.nonMatch.map(b => b.count)
        )],
        line: { color: "#E53E3E", width: 2, dash: "dash" },
        text: [` Rejection ${thresholds.rejectionThreshold}`],
        textposition: "top right",
        hoverinfo: "skip",
    };

    const investigationTrace: Plotly.Data = {
        type: "scatter",
        mode: "lines+text",
        name: `Investigation: ${thresholds.investigationThreshold}`,
        x: [thresholds.investigationThreshold, thresholds.investigationThreshold],
        y: [0, Math.max(
            ...data.match.map(b => b.count),
            ...data.nonMatch.map(b => b.count)
        )],
        line: { color: "#F59E0B", width: 2, dash: "dash" },
        text: [` Investigation ${thresholds.investigationThreshold}`],
        textposition: "top right",
        hoverinfo: "skip",
    };

    /* ───────────────── LAYOUT ───────────────── */

    const layout: Partial<Plotly.Layout> = {
        title: {
            text: title,
            font: { size: 16, color: "#1E293B" },
        },

        barmode: "overlay",

        xaxis: {
            title: { text: "Similarity Score" },
            range: [xMin, xMax],
            gridcolor: "#E2E8F0",
            linecolor: "#E2E8F0",
            tickfont: { color: "#64748B" },
        },

        yaxis: {
            title: { text: "Count" },
            gridcolor: "#E2E8F0",
            linecolor: "#E2E8F0",
            tickfont: { color: "#64748B" },
        },

        legend: {
            orientation: "h",
            x: 0.5,
            y: -0.18,
            xanchor: "center",
            font: { size: 12 },
        },

        showlegend: true,
        bargap: 0
    };

    const traces: Plotly.Data[] = [
        matchTrace,
        nonMatchTrace,
        rejectionTrace,
        investigationTrace,
    ];

    return plotlyToPng(traces, layout);
}