from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.core.errors import AnalyzeError
from app.schemas.analysis import AnalysisResult
from app.services import analysis_service
from app.services.audio_service import MAX_UPLOAD_BYTES

router = APIRouter()


@router.post("/analyze", response_model=AnalysisResult)
async def analyze(
    file: UploadFile = File(...),
    exercise_id: str = Form(...),
) -> AnalysisResult:
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")
    if len(audio_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"Audio file is too large (max {MAX_UPLOAD_BYTES // (1024 * 1024)} MB)",
        )

    try:
        return analysis_service.analyze(
            audio_bytes=audio_bytes,
            content_type=file.content_type or "application/octet-stream",
            exercise_id=exercise_id,
        )
    except AnalyzeError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
