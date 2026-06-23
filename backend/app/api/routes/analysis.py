from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.core.config import get_settings
from app.models.schemas import AnalysisResponse, AnalysisSettings
from app.services.mechanics import analyze_files, example_frames

router = APIRouter(prefix="/analysis", tags=["analysis"])
ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".txt", ".dat", ".tsv"}


@router.post("", response_model=AnalysisResponse)
async def analyze(
    files: list[UploadFile] = File(...),
    smoothing: str = Form("savgol"),
    smooth_window: int = Form(17),
    remove_outliers: bool = Form(True),
    crop_failure: bool = Form(True),
    modulus_min: float = Form(0.005),
    modulus_max: float = Form(0.080),
) -> AnalysisResponse:
    config = get_settings()
    try:
        settings = AnalysisSettings(
            smoothing=smoothing,
            smooth_window=smooth_window,
            remove_outliers=remove_outliers,
            crop_failure=crop_failure,
            modulus_min=modulus_min,
            modulus_max=modulus_max,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    uploads: list[tuple[str, bytes]] = []
    total_bytes = 0
    for uploaded in files:
        filename = uploaded.filename or "upload.csv"
        if Path(filename).suffix.lower() not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=415, detail=f"Unsupported file: {filename}")
        content = await uploaded.read()
        total_bytes += len(content)
        uploads.append((filename, content))

    if total_bytes > config.max_upload_mb * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail=f"Upload exceeds the {config.max_upload_mb} MB request limit.",
        )
    try:
        result = analyze_files(uploads, settings)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not analyze uploaded files: {exc}") from exc
    if not result.files:
        raise HTTPException(
            status_code=422,
            detail="No usable stress-strain data detected. Check column names and numeric values.",
        )
    return result


@router.get("/demo", response_model=AnalysisResponse)
def demo() -> AnalysisResponse:
    return analyze_files(example_frames(), AnalysisSettings())
