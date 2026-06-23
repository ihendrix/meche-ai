import type { AnalysisSettings } from "@/lib/types";

interface SettingsPanelProps {
  files: File[];
  settings: AnalysisSettings;
  selectedNames: string[];
  availableNames: string[];
  busy: boolean;
  onFiles: (files: File[]) => void;
  onSettings: (settings: AnalysisSettings) => void;
  onSelectedNames: (names: string[]) => void;
  onAnalyze: () => void;
  onDemo: () => void;
}

export function SettingsPanel({
  files,
  settings,
  selectedNames,
  availableNames,
  busy,
  onFiles,
  onSettings,
  onSelectedNames,
  onAnalyze,
  onDemo,
}: SettingsPanelProps) {
  function update<K extends keyof AnalysisSettings>(key: K, value: AnalysisSettings[K]) {
    onSettings({ ...settings, [key]: value });
  }

  return (
    <aside className="sidebar">
      <h2>Controls</h2>
      <label className="upload-box">
        <span>Upload mechanical test files</span>
        <small>CSV, Excel, TXT, DAT, or TSV</small>
        <input
          type="file"
          multiple
          accept=".csv,.xlsx,.xls,.txt,.dat,.tsv"
          onChange={(event) => onFiles(Array.from(event.target.files ?? []))}
        />
      </label>

      {files.length > 0 && (
        <div className="file-list">
          {files.map((file, index) => (
            <div className="file-row" key={`${file.name}-${index}`}>
              ✓ Specimen {index + 1}
            </div>
          ))}
        </div>
      )}

      <div className="control-group">
        <label>
          Smoothing
          <select
            value={settings.smoothing}
            onChange={(event) => update("smoothing", event.target.value as AnalysisSettings["smoothing"])}
          >
            <option value="savgol">Savitzky-Golay</option>
            <option value="moving_average">Moving average</option>
            <option value="none">None</option>
          </select>
        </label>
        <label>
          Smoothing window
          <input
            type="range"
            min="5"
            max="51"
            step="2"
            value={settings.smooth_window}
            onChange={(event) => update("smooth_window", Number(event.target.value))}
          />
          <span className="range-value">{settings.smooth_window}</span>
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.remove_outliers}
            onChange={(event) => update("remove_outliers", event.target.checked)}
          />
          Remove spike outliers
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.crop_failure}
            onChange={(event) => update("crop_failure", event.target.checked)}
          />
          Crop after confirmed failure
        </label>
      </div>

      <div className="control-group">
        <span className="caption">Modulus fit region</span>
        <div className="two-col">
          <label>
            Start strain
            <input
              type="number"
              min="0"
              step="0.005"
              value={settings.modulus_min}
              onChange={(event) => update("modulus_min", Number(event.target.value))}
            />
          </label>
          <label>
            End strain
            <input
              type="number"
              min="0.001"
              step="0.005"
              value={settings.modulus_max}
              onChange={(event) => update("modulus_max", Number(event.target.value))}
            />
          </label>
        </div>
      </div>

      <div className="button-stack">
        <button className="primary" disabled={busy || files.length === 0} onClick={onAnalyze}>
          {busy ? "Analyzing…" : "Analyze files"}
        </button>
        <button disabled={busy} onClick={onDemo}>Load demo data</button>
      </div>

      {availableNames.length > 0 && (
        <div className="control-group">
          <div className="select-actions">
            <span className="caption">Files to plot</span>
            <button className="text-button" onClick={() => onSelectedNames(availableNames)}>All</button>
            <button className="text-button" onClick={() => onSelectedNames([])}>Clear</button>
          </div>
          {availableNames.map((name) => (
            <label className="check-row file-choice" key={name}>
              <input
                type="checkbox"
                checked={selectedNames.includes(name)}
                onChange={(event) => {
                  onSelectedNames(
                    event.target.checked
                      ? [...selectedNames, name]
                      : selectedNames.filter((item) => item !== name),
                  );
                }}
              />
              {name}
            </label>
          ))}
        </div>
      )}
    </aside>
  );
}
