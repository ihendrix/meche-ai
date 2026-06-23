from __future__ import annotations

import io
import math
import re
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

try:
    from scipy.signal import savgol_filter
except Exception:  # pragma: no cover
    savgol_filter = None

from app.models.schemas import (
    AnalysisResponse,
    AnalysisSettings,
    AnalysisSummary,
    CurvePoint,
    FileAnalysis,
    MetricResult,
)


@dataclass
class TestData:
    name: str
    raw: pd.DataFrame
    clean: pd.DataFrame
    strain_col: str | None
    stress_col: str | None
    stress_unit: str
    warnings: list[str]
    status: str
    data_kind: str


def _finite_or_none(value: object) -> float | None:
    if value is None or pd.isna(value):
        return None
    number = float(value)
    return number if math.isfinite(number) else None


def safe_name(filename: str) -> str:
    name = Path(filename).stem.replace("_corrected", "").replace("_", " ")
    return name.strip() or "Uploaded specimen"


def _clean_header_value(value: object, index: int) -> str:
    if pd.isna(value):
        return "Specimen" if index == 0 else f"Column {index + 1}"
    name = str(value).strip()
    if not name or name.lower().startswith("unnamed"):
        return "Specimen" if index == 0 else f"Column {index + 1}"
    return name


def _make_unique_columns(values: list[object]) -> list[str]:
    output: list[str] = []
    counts: dict[str, int] = {}
    for index, value in enumerate(values):
        base = _clean_header_value(value, index)
        counts[base] = counts.get(base, 0) + 1
        output.append(base if counts[base] == 1 else f"{base} ({counts[base]})")
    return output


def _find_header_row(raw: pd.DataFrame, max_rows: int = 30) -> int:
    terms = [
        "strain",
        "stress",
        "load",
        "extension",
        "displacement",
        "time measurement",
        "specimen",
    ]
    best_index = 0
    best_score = -1
    for index in range(min(max_rows, len(raw))):
        row_text = " | ".join(
            str(value).strip().lower()
            for value in raw.iloc[index].tolist()
            if not pd.isna(value)
        )
        score = sum(term in row_text for term in terms)
        if "strain" in row_text and "stress" in row_text:
            score += 10
        if score > best_score:
            best_index = index
            best_score = score
    return best_index if best_score > 0 else 0


def _promote_detected_header(raw: pd.DataFrame) -> pd.DataFrame:
    raw = raw.dropna(axis=0, how="all").dropna(axis=1, how="all").reset_index(drop=True)
    if raw.empty:
        return raw
    header_index = _find_header_row(raw)
    columns = _make_unique_columns(raw.iloc[header_index].tolist())
    frame = raw.iloc[header_index + 1 :].copy().reset_index(drop=True)
    frame.columns = columns
    frame = frame.dropna(axis=0, how="all").dropna(axis=1, how="all")
    return frame.reset_index(drop=True)


def read_file_bytes(filename: str, data: bytes) -> pd.DataFrame:
    suffix = Path(filename).suffix.lower()
    if suffix in {".xlsx", ".xls"}:
        raw = pd.read_excel(io.BytesIO(data), header=None)
    else:
        separator = "\t" if suffix == ".tsv" else None
        raw = pd.read_csv(
            io.BytesIO(data),
            header=None,
            sep=separator,
            engine="python",
            dtype=object,
        )
    return _promote_detected_header(raw)


def extract_unit_row(df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, str]]:
    if df.empty:
        return df, {}
    first = df.iloc[0].astype(str).str.strip()
    numeric_ratio = pd.to_numeric(df.iloc[0], errors="coerce").notna().mean()
    has_units = first.str.contains(
        r"\(|\)|mpa|kpa|pa|mm/mm|%|n$", case=False, regex=True
    ).mean() > 0.35
    if has_units and numeric_ratio < 0.45:
        units = {str(col): str(first.iloc[i]).strip("() ") for i, col in enumerate(df.columns)}
        return df.iloc[1:].reset_index(drop=True), units
    return df, {}


def guess_column(
    columns: list[str], include_terms: list[str], exclude_terms: list[str] | None = None
) -> str | None:
    exclude_terms = exclude_terms or []
    best: str | None = None
    best_score = -999
    for col in columns:
        low = str(col).lower()
        score = sum(term in low for term in include_terms) * 4
        score -= sum(term in low for term in exclude_terms) * 5
        if score > best_score:
            best = col
            best_score = score
    return best if best_score > 0 else None


def unit_from_column_or_row(col: str, units: dict[str, str]) -> str:
    text = f"{col} {units.get(col, '')}".lower()
    if "kpa" in text:
        return "kPa"
    if "mpa" in text:
        return "MPa"
    if re.search(r"\bpa\b", text):
        return "Pa"
    return "MPa"


def convert_to_mpa(series: pd.Series, source_unit: str) -> pd.Series:
    values = pd.to_numeric(series, errors="coerce")
    if source_unit == "kPa":
        return values / 1000.0
    if source_unit == "Pa":
        return values / 1_000_000.0
    return values


def smooth_series(values: pd.Series, method: str, window: int) -> pd.Series:
    y = values.astype(float).copy()
    window = max(3, int(window))
    if window % 2 == 0:
        window += 1
    if method == "none" or len(y) < 5:
        return y
    if method == "moving_average":
        return y.rolling(window=window, center=True, min_periods=1).mean()
    if method == "savgol" and savgol_filter is not None and len(y) >= window:
        return pd.Series(
            savgol_filter(y.to_numpy(), window_length=window, polyorder=2), index=y.index
        )
    return y.rolling(window=window, center=True, min_periods=1).mean()


def clean_curve(
    df: pd.DataFrame,
    strain_col: str,
    stress_col: str,
    units: dict[str, str],
    settings: AnalysisSettings,
) -> tuple[pd.DataFrame, str, list[str]]:
    unit = unit_from_column_or_row(stress_col, units)
    strain = pd.to_numeric(df[strain_col], errors="coerce")
    stress = convert_to_mpa(df[stress_col], unit)
    clean = (
        pd.DataFrame({"Strain": strain, "Stress_Raw_MPa": stress})
        .replace([np.inf, -np.inf], np.nan)
        .dropna()
    )
    clean = clean.sort_values("Strain").drop_duplicates("Strain").reset_index(drop=True)
    clean = clean[clean["Strain"] >= 0].copy()
    notes: list[str] = []
    if clean.empty:
        return clean, unit, ["No numeric stress/strain rows detected."]

    n_base = max(5, int(len(clean) * 0.03))
    baseline = float(clean["Stress_Raw_MPa"].iloc[:n_base].median())
    clean["Stress_Corrected_MPa"] = clean["Stress_Raw_MPa"] - baseline
    notes.append(f"Baseline offset removed: {baseline:.5g} MPa")

    negative_count = int((clean["Stress_Corrected_MPa"] < 0).sum())
    clean["Stress_Corrected_MPa"] = clean["Stress_Corrected_MPa"].clip(lower=0)
    if negative_count:
        notes.append(f"Clipped {negative_count} negative stress points to zero.")

    if settings.remove_outliers and len(clean) >= 15:
        median = clean["Stress_Corrected_MPa"].rolling(11, center=True, min_periods=1).median()
        residual = (clean["Stress_Corrected_MPa"] - median).abs()
        mad = float(np.nanmedian(np.abs(residual - np.nanmedian(residual))))
        threshold = max(0.03, 8 * mad)
        mask = residual <= threshold
        removed = int((~mask).sum())
        clean = clean[mask].reset_index(drop=True)
        if removed:
            notes.append(f"Removed {removed} spike/outlier points.")

    clean["Stress_MPa"] = smooth_series(
        clean["Stress_Corrected_MPa"], settings.smoothing, settings.smooth_window
    ).clip(lower=0)
    if settings.smoothing != "none":
        readable = "Savitzky-Golay" if settings.smoothing == "savgol" else "moving average"
        notes.append(f"Applied {readable} smoothing.")
    return clean, unit, notes


def detect_failure(clean: pd.DataFrame) -> tuple[int | None, str, list[str]]:
    if clean.empty or len(clean) < 12:
        return None, "Insufficient fit region", ["Too few rows for detection."]
    stress = clean["Stress_MPa"].to_numpy()
    strain = clean["Strain"].to_numpy()
    peak_idx = int(np.nanargmax(stress))
    peak_stress = stress[peak_idx]
    peak_strain = strain[peak_idx]
    final_stress = stress[-1]
    max_strain = strain[-1]
    flags: list[str] = []
    status = "Valid"
    failure_idx: int | None = None

    if peak_idx < len(stress) - 3 and peak_stress > 0:
        below = np.where(stress[peak_idx:] <= 0.80 * peak_stress)[0]
        if len(below):
            candidate = peak_idx + int(below[0])
            if candidate > peak_idx:
                failure_idx = candidate

    early_end = max(8, int(len(stress) * 0.25))
    early = stress[:early_end]
    early_peak = float(np.max(early)) if len(early) else 0
    if early_peak > 0 and np.any(np.diff(early) < -0.20 * early_peak):
        status = "Noisy curve"
        flags.append("Large early stress drop detected.")
    if max_strain > 0 and peak_strain < 0.35 * max_strain and peak_stress > 0:
        status = "Noisy curve" if status == "Valid" else status
        flags.append("Peak stress occurred unusually early in the strain range.")
    if failure_idx is not None:
        flags.append("Confirmed post-peak stress drop detected.")
    elif peak_stress > 0 and final_stress < 0.70 * peak_stress:
        flags.append("Post-peak decrease detected, but no stable crop point was found.")
    return failure_idx, status, flags


def validate_modulus(window: pd.DataFrame) -> tuple[float, float, str]:
    if len(window) < 5 or window["Strain"].nunique() < 2:
        return np.nan, np.nan, "Insufficient fit region"
    x = window["Strain"].to_numpy()
    y = window["Stress_MPa"].to_numpy()
    slope, intercept = np.polyfit(x, y, 1)
    prediction = slope * x + intercept
    ss_res = float(np.sum((y - prediction) ** 2))
    ss_tot = float(np.sum((y - y.mean()) ** 2))
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else np.nan
    residual_noise = np.std(y - prediction) / max(np.mean(y), 1e-9)
    if slope <= 0:
        status = "Negative modulus"
    elif np.isnan(r2) or r2 < 0.75:
        status = "Low R²"
    elif residual_noise > 0.35:
        status = "Noisy curve"
    else:
        status = "Valid"
    return float(slope), float(r2), status


def calculate_metrics(
    clean: pd.DataFrame, settings: AnalysisSettings, data_kind: str = "curve"
) -> dict[str, object]:
    if clean.empty:
        return {
            "peak_stress_mpa": None,
            "strain_at_peak": None,
            "youngs_modulus_mpa": None,
            "modulus_r2": None,
            "modulus_fit": "Insufficient fit region",
            "area_under_curve": None,
            "rows": 0,
        }
    peak_idx = int(clean["Stress_MPa"].idxmax())
    if data_kind == "summary":
        return {
            "peak_stress_mpa": float(clean.loc[peak_idx, "Stress_MPa"]),
            "strain_at_peak": float(clean.loc[peak_idx, "Strain"]),
            "youngs_modulus_mpa": None,
            "modulus_r2": None,
            "modulus_fit": "Peak summary points",
            "area_under_curve": None,
            "rows": int(len(clean)),
        }
    window = clean[
        (clean["Strain"] >= settings.modulus_min)
        & (clean["Strain"] <= settings.modulus_max)
    ].copy()
    modulus, r2, fit_status = validate_modulus(window)
    auc = float(np.trapezoid(clean["Stress_MPa"], clean["Strain"])) if len(clean) >= 2 else np.nan
    return {
        "peak_stress_mpa": float(clean.loc[peak_idx, "Stress_MPa"]),
        "strain_at_peak": float(clean.loc[peak_idx, "Strain"]),
        "youngs_modulus_mpa": _finite_or_none(modulus),
        "modulus_r2": _finite_or_none(r2),
        "modulus_fit": fit_status,
        "area_under_curve": _finite_or_none(auc),
        "rows": int(len(clean)),
    }


def _is_peak_summary(strain_col: str, stress_col: str) -> bool:
    combined = f"{strain_col} {stress_col}".lower()
    return "maximum load" in combined or "at maximum" in combined


def _prepare_peak_summary(
    name: str,
    df: pd.DataFrame,
    strain_col: str,
    stress_col: str,
    units: dict[str, str],
) -> tuple[pd.DataFrame, str, list[str]]:
    unit = unit_from_column_or_row(stress_col, units)
    strain = pd.to_numeric(df[strain_col], errors="coerce")
    stress = convert_to_mpa(df[stress_col], unit)
    label_col = next((col for col in df.columns if col not in {strain_col, stress_col}), None)
    labels = (
        df[label_col].astype(str).str.strip()
        if label_col is not None
        else pd.Series([str(i + 1) for i in range(len(df))], index=df.index)
    )
    excluded = labels.str.contains(
        r"mean|standard deviation|std\.?|results table", case=False, regex=True, na=False
    )
    clean = pd.DataFrame(
        {"Strain": strain, "Stress_Raw_MPa": stress, "Point_Label": labels}
    )
    clean = clean[~excluded].replace([np.inf, -np.inf], np.nan).dropna(
        subset=["Strain", "Stress_Raw_MPa"]
    )
    clean = clean[clean["Strain"] >= 0].reset_index(drop=True)
    clean["Stress_Corrected_MPa"] = clean["Stress_Raw_MPa"]
    clean["Stress_MPa"] = clean["Stress_Raw_MPa"]
    clean["Specimen"] = name
    clean["Data_Type"] = "summary"
    return clean, unit, [
        "Parsed as a peak-property results table; plotted as markers rather than a continuous curve.",
        "Mean and standard-deviation rows were excluded from the graph.",
    ]


def prepare_test(name: str, df: pd.DataFrame, settings: AnalysisSettings) -> TestData:
    df, units = extract_unit_row(df)
    df = df.dropna(axis=1, how="all").copy()
    df.columns = [str(column).strip() for column in df.columns]
    columns = list(df.columns)
    strain_col = guess_column(
        columns,
        ["composite strain", "tensile strain", "strain", "mm/mm"],
        ["stress"],
    )
    stress_col = guess_column(
        columns, ["tensile stress", "stress", "mpa", "kpa"], ["strain"]
    )
    numeric_cols = [
        column
        for column in columns
        if pd.to_numeric(df[column], errors="coerce").notna().sum() >= 3
    ]
    if strain_col is None and numeric_cols:
        strain_col = numeric_cols[0]
    if stress_col is None:
        stress_col = next((column for column in numeric_cols if column != strain_col), None)

    warnings: list[str] = []
    unit = "MPa"
    clean = pd.DataFrame()
    status = "Insufficient fit region"
    data_kind = "curve"

    if strain_col and stress_col:
        if _is_peak_summary(strain_col, stress_col):
            clean, unit, warnings = _prepare_peak_summary(
                name, df, strain_col, stress_col, units
            )
            status = "Summary points"
            data_kind = "summary"
        else:
            clean, unit, warnings = clean_curve(
                df, strain_col, stress_col, units, settings
            )
            failure_idx, status, failure_notes = detect_failure(clean)
            warnings.extend(failure_notes)
            if settings.crop_failure and failure_idx is not None and failure_idx > 5:
                clean = clean.iloc[: failure_idx + 1].copy()
                warnings.append("Curve cropped at confirmed failure point.")
            clean["Specimen"] = name
            clean["Point_Label"] = ""
            clean["Data_Type"] = "curve"
    else:
        warnings.append("Could not detect strain and stress columns.")

    return TestData(
        name=name,
        raw=df,
        clean=clean,
        strain_col=strain_col,
        stress_col=stress_col,
        stress_unit=unit,
        warnings=warnings,
        status=status,
        data_kind=data_kind,
    )


def example_frames() -> list[tuple[str, bytes]]:
    rng = np.random.default_rng(11)
    output: list[tuple[str, bytes]] = []
    profiles = [
        (1.50, 1.15, "Example Control"),
        (1.55, 0.72, "Example Trial A"),
        (1.42, 1.05, "Example Trial B"),
        (1.62, 1.18, "Example Trial C"),
    ]
    for modulus, max_strain, name in profiles:
        strain = np.linspace(0, max_strain, 360)
        stress_mpa = modulus * strain + 0.05 * np.sin(strain * 9) + rng.normal(0, 0.018, len(strain))
        stress_mpa = np.maximum(stress_mpa, 0)
        drop_start = int(len(strain) * 0.94)
        stress_mpa[drop_start:] = np.linspace(
            stress_mpa[drop_start], stress_mpa[drop_start] * 0.25, len(stress_mpa[drop_start:])
        )
        frame = pd.DataFrame(
            {"Composite strain": strain, "Tensile stress (kPa)": stress_mpa * 1000}
        )
        output.append((f"{name}.csv", frame.to_csv(index=False).encode("utf-8")))
    return output


def analyze_files(
    uploads: list[tuple[str, bytes]], settings: AnalysisSettings
) -> AnalysisResponse:
    used_names: dict[str, int] = {}
    tests: list[TestData] = []
    for filename, data in uploads:
        base = safe_name(filename)
        used_names[base] = used_names.get(base, 0) + 1
        display_name = base if used_names[base] == 1 else f"{base} ({used_names[base]})"
        frame = read_file_bytes(filename, data)
        tests.append(prepare_test(display_name, frame, settings))

    valid_tests = [test for test in tests if not test.clean.empty]
    file_results: list[FileAnalysis] = []
    metric_results: list[MetricResult] = []

    for test in valid_tests:
        points = [
            CurvePoint(
                strain=float(row["Strain"]),
                stress_mpa=float(row["Stress_MPa"]),
                raw_stress_mpa=_finite_or_none(row.get("Stress_Corrected_MPa")),
                label=(str(row.get("Point_Label", "")).strip() or None),
            )
            for _, row in test.clean.iterrows()
        ]
        file_results.append(
            FileAnalysis(
                name=test.name,
                data_kind=test.data_kind,  # type: ignore[arg-type]
                status=test.status,
                strain_column=test.strain_col,
                stress_column=test.stress_col,
                source_stress_unit=test.stress_unit,
                warnings=test.warnings,
                points=points,
            )
        )
        metric = calculate_metrics(test.clean, settings, test.data_kind)
        metric_results.append(
            MetricResult(
                file=test.name,
                data_type=test.data_kind.title(),
                detected_strain_column=test.strain_col,
                detected_stress_column=test.stress_col,
                **metric,
            )
        )

    max_stress_values = [m.peak_stress_mpa for m in metric_results if m.peak_stress_mpa is not None]
    modulus_values = [m.youngs_modulus_mpa for m in metric_results if m.youngs_modulus_mpa is not None]
    return AnalysisResponse(
        settings=settings,
        files=file_results,
        metrics=metric_results,
        summary=AnalysisSummary(
            files_plotted=len(file_results),
            clean_rows=sum(len(file.points) for file in file_results),
            max_stress_mpa=max(max_stress_values) if max_stress_values else None,
            mean_modulus_mpa=float(np.mean(modulus_values)) if modulus_values else None,
        ),
    )
