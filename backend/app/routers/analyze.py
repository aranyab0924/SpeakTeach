from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.schemas.analysis import AnalysisResult
from app.services import analysis_service

router = APIRouter()


@router.post("/analyze", response_model=AnalysisResult)
async def analyze(
    file: UploadFile = File(...),
    exercise_id: str = Form(...),
) -> AnalysisResult:
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")

    return analysis_service.analyze(
        audio_bytes=audio_bytes,
        content_type=file.content_type or "application/octet-stream",
        exercise_id=exercise_id,
    )
