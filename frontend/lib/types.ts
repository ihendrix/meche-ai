export type SmoothingMethod = "savgol" | "moving_average" | "none";

export interface AnalysisSettings {
  smoothing: SmoothingMethod;
  smooth_window: number;
  remove_outliers: boolean;
  crop_failure: boolean;
  modulus_min: number;
  modulus_max: number;
}

export interface CurvePoint {
  strain: number;
  stress_mpa: number;
  raw_stress_mpa: number | null;
  label: string | null;
}

export interface FileAnalysis {
  name: string;
  data_kind: "curve" | "summary";
  status: string;
  strain_column: string | null;
  stress_column: string | null;
  source_stress_unit: string;
  warnings: string[];
  points: CurvePoint[];
}

export interface MetricResult {
  file: string;
  data_type: string;
  peak_stress_mpa: number | null;
  strain_at_peak: number | null;
  youngs_modulus_mpa: number | null;
  modulus_r2: number | null;
  modulus_fit: string;
  area_under_curve: number | null;
  rows: number;
  detected_strain_column: string | null;
  detected_stress_column: string | null;
}

export interface AnalysisResponse {
  settings: AnalysisSettings;
  files: FileAnalysis[];
  metrics: MetricResult[];
  summary: {
    files_plotted: number;
    clean_rows: number;
    max_stress_mpa: number | null;
    mean_modulus_mpa: number | null;
  };
}
