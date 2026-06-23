from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator


SmoothingMethod = Literal["savgol", "moving_average", "none"]


class AnalysisSettings(BaseModel):
    smoothing: SmoothingMethod = "savgol"
    smooth_window: int = Field(default=17, ge=3, le=101)
    remove_outliers: bool = True
    crop_failure: bool = True
    modulus_min: float = Field(default=0.005, ge=0)
    modulus_max: float = Field(default=0.080, gt=0)

    @model_validator(mode="after")
    def validate_window(self) -> "AnalysisSettings":
        if self.modulus_max <= self.modulus_min:
            raise ValueError("modulus_max must be greater than modulus_min")
        if self.smooth_window % 2 == 0:
            self.smooth_window += 1
        return self


class CurvePoint(BaseModel):
    strain: float
    stress_mpa: float
    raw_stress_mpa: float | None = None
    label: str | None = None


class FileAnalysis(BaseModel):
    name: str
    data_kind: Literal["curve", "summary"]
    status: str
    strain_column: str | None
    stress_column: str | None
    source_stress_unit: str
    warnings: list[str]
    points: list[CurvePoint]


class MetricResult(BaseModel):
    file: str
    data_type: str
    peak_stress_mpa: float | None
    strain_at_peak: float | None
    youngs_modulus_mpa: float | None
    modulus_r2: float | None
    modulus_fit: str
    area_under_curve: float | None
    rows: int
    detected_strain_column: str | None
    detected_stress_column: str | None


class AnalysisSummary(BaseModel):
    files_plotted: int
    clean_rows: int
    max_stress_mpa: float | None
    mean_modulus_mpa: float | None


class AnalysisResponse(BaseModel):
    settings: AnalysisSettings
    files: list[FileAnalysis]
    metrics: list[MetricResult]
    summary: AnalysisSummary
