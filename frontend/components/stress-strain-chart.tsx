"use client";

import dynamic from "next/dynamic";
import type { Data, Layout } from "plotly.js";
import type { FileAnalysis } from "@/lib/types";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

export function StressStrainChart({ files }: { files: FileAnalysis[] }) {
  const traces: Data[] = files.map((file) => ({
    x: file.points.map((point) => point.strain),
    y: file.points.map((point) => point.stress_mpa),
    text: file.points.map((point) => point.label ?? ""),
    type: "scatter",
    mode: file.data_kind === "summary" ? "markers" : "lines",
    name: file.data_kind === "summary" ? `${file.name} peak points` : file.name,
    line: file.data_kind === "curve" ? { width: 3 } : undefined,
    marker: file.data_kind === "summary" ? { size: 11, line: { width: 1 } } : undefined,
    hovertemplate:
      file.data_kind === "summary"
        ? "<b>%{fullData.name}</b><br>Specimen: %{text}<br>Strain: %{x:.5f}<br>Stress: %{y:.5f} MPa<extra></extra>"
        : "<b>%{fullData.name}</b><br>Strain: %{x:.5f}<br>Stress: %{y:.5f} MPa<extra></extra>",
  }));

  const layout: Partial<Layout> = {
    title: { text: "Stress–Strain Curves and Peak Summary Points" },
    autosize: true,
    height: 610,
    paper_bgcolor: "#080a0f",
    plot_bgcolor: "#080a0f",
    font: { color: "#f5f3ee" },
    xaxis: { title: { text: "Strain (mm/mm)" }, gridcolor: "rgba(255,255,255,.07)", zeroline: false },
    yaxis: { title: { text: "Stress (MPa)" }, gridcolor: "rgba(255,255,255,.07)", zeroline: false, rangemode: "tozero" },
    legend: { title: { text: "Uploaded File" } },
    margin: { l: 55, r: 20, t: 70, b: 55 },
  };

  if (files.length === 0) {
    return <div className="empty-state">Select at least one file.</div>;
  }

  return (
    <Plot
      data={traces}
      layout={layout}
      config={{ responsive: true, displaylogo: false }}
      style={{ width: "100%" }}
      useResizeHandler
    />
  );
}
