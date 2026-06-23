"use client";

import { useMemo, useState } from "react";
import { MetricCard } from "@/components/metric-card";
import { ResultsTable } from "@/components/results-table";
import { SettingsPanel } from "@/components/settings-panel";
import { StressStrainChart } from "@/components/stress-strain-chart";
import { SupabasePanel } from "@/components/supabase-panel";
import { analyzeFiles, loadDemo } from "@/lib/api";
import type { AnalysisResponse, AnalysisSettings } from "@/lib/types";

const DEFAULT_SETTINGS: AnalysisSettings = {
  smoothing: "savgol",
  smooth_window: 17,
  remove_outliers: true,
  crop_failure: true,
  modulus_min: 0.005,
  modulus_max: 0.08,
};

function download(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function Dashboard() {
  const [uploads, setUploads] = useState<File[]>([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function execute(mode: "files" | "demo") {
    setBusy(true);
    setError("");
    try {
      const result = mode === "files" ? await analyzeFiles(uploads, settings) : await loadDemo();
      setAnalysis(result);
      setSettings(result.settings);
      setSelectedNames(result.files.map((file) => file.name));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  }

  const selectedFiles = useMemo(
    () => analysis?.files.filter((file) => selectedNames.includes(file.name)) ?? [],
    [analysis, selectedNames],
  );
  const selectedMetrics = useMemo(
    () => analysis?.metrics.filter((metric) => selectedNames.includes(metric.file)) ?? [],
    [analysis, selectedNames],
  );
  const cleanRows = selectedFiles.reduce((sum, file) => sum + file.points.length, 0);
  const maxStress = selectedMetrics.reduce<number | null>(
    (current, metric) => metric.peak_stress_mpa == null ? current : current == null ? metric.peak_stress_mpa : Math.max(current, metric.peak_stress_mpa),
    null,
  );
  const moduli = selectedMetrics.flatMap((metric) => metric.youngs_modulus_mpa == null ? [] : [metric.youngs_modulus_mpa]);
  const meanModulus = moduli.length ? moduli.reduce((a, b) => a + b, 0) / moduli.length : null;

  function downloadCleaned() {
    const header = ["File", "Data Type", "Strain", "Stress_MPa", "Raw_Stress_MPa", "Point_Label"];
    const rows = selectedFiles.flatMap((file) => file.points.map((point) => [
      file.name, file.data_kind, point.strain, point.stress_mpa, point.raw_stress_mpa, point.label,
    ]));
    download("cleaned_stress_strain_data.csv", [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n"), "text/csv");
  }

  function downloadSummary() {
    const keys = [
      "file", "data_type", "peak_stress_mpa", "strain_at_peak", "youngs_modulus_mpa",
      "modulus_r2", "modulus_fit", "area_under_curve", "rows",
    ] as const;
    const rows = selectedMetrics.map((metric) => keys.map((key) => metric[key]));
    download("mechanical_summary.csv", [keys, ...rows].map((row) => row.map(csvCell).join(",")).join("\n"), "text/csv");
  }

  return (
    <main className="app-shell">
      <SettingsPanel
        files={uploads}
        settings={settings}
        selectedNames={selectedNames}
        availableNames={analysis?.files.map((file) => file.name) ?? []}
        busy={busy}
        onFiles={setUploads}
        onSettings={setSettings}
        onSelectedNames={setSelectedNames}
        onAnalyze={() => execute("files")}
        onDemo={() => execute("demo")}
      />

      <div className="content">
        <header className="hero">
          <h1>Hendrix Mechanical Analytics</h1>
          <p>Interactive platform for analyzing stress-strain experiments, extracting material properties, and generating research-ready outputs.</p>
        </header>

        {error && <div className="error">{error}</div>}
        {!analysis && !error && <div className="info">Upload files or load the demo dataset to begin.</div>}

        {analysis && (
          <>
            <section className="metric-grid">
              <MetricCard label="Files Plotted" value={selectedFiles.length} sub="Selected for analysis" />
              <MetricCard label="Clean Rows" value={cleanRows} sub="After parsing and cleaning" />
              <MetricCard label="Max Stress" value={maxStress == null ? "—" : maxStress.toFixed(3)} sub="MPa" />
              <MetricCard label="Mean Modulus" value={meanModulus == null ? "—" : meanModulus.toFixed(3)} sub="MPa" />
            </section>
            <p className="muted">Displayed values depend on uploaded units and the selected modulus-fit region. Validate units before interpreting material properties.</p>

            <section className="section-card">
              <h2>Stress–Strain Analysis</h2>
              <StressStrainChart files={selectedFiles} />
            </section>

            <section className="section-card">
              <h2>Material Property Summary</h2>
              <p className="muted">Review flags indicate weak fit confidence, negative or near-zero modulus, excessive noise, or insufficient linear-region quality.</p>
              <ResultsTable metrics={selectedMetrics} />
            </section>

            <section className="section-card">
              <h2>Cleaning Notes</h2>
              <div className="notes-grid">
                {selectedFiles.map((file) => (
                  <article className="note-card" key={file.name}>
                    <h3>{file.name}</h3>
                    <p className="muted">Detected: {file.strain_column ?? "—"} / {file.stress_column ?? "—"}</p>
                    <ul>{file.warnings.slice(0, 8).map((warning) => <li key={warning}>{warning}</li>)}</ul>
                  </article>
                ))}
              </div>
            </section>

            <section className="section-card">
              <h2>Downloads</h2>
              <div className="button-row">
                <button onClick={downloadCleaned}>Download cleaned CSV</button>
                <button onClick={downloadSummary}>Download summary CSV</button>
              </div>
            </section>

            <section className="section-card">
              <h2>Supabase Workspace</h2>
              <SupabasePanel analysis={analysis} sourceFiles={uploads} />
            </section>

          </>
        )}
      </div>
    </main>
  );
}
