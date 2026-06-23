from app.models.schemas import AnalysisSettings
from app.services.mechanics import analyze_files, example_frames


def test_demo_analysis_returns_curves_and_metrics() -> None:
    result = analyze_files(example_frames(), AnalysisSettings())
    assert len(result.files) == 4
    assert len(result.metrics) == 4
    assert result.summary.clean_rows > 0
    assert result.summary.max_stress_mpa is not None
