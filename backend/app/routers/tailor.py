from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from ..database import get_session
from ..models.resume import MasterResume
from ..models.history import TailoredResume, TailorRequest, TailorResponse
from ..services import jd_analyzer, tailoring_engine
from ..config import settings

router = APIRouter(prefix="/api", tags=["tailor"])

@router.post("/tailor", response_model=TailorResponse)
async def tailor_resume(request: TailorRequest, session: AsyncSession = Depends(get_session)):
    import json

    # Get master resume
    result = await session.execute(select(MasterResume).order_by(MasterResume.version.desc()))
    master_db = result.scalars().first()

    if not master_db:
        raise HTTPException(status_code=404, detail="No master resume found. Please add your resume first.")

    master_data = master_db.get_data()

    # Step 1: Analyze JD
    try:
        requirements, model_used = await jd_analyzer.analyze_jd(
            request.job_description,
            preferred_model=request.preferred_model
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM call failed during JD analysis: {e}")

    requirements_json = json.dumps(requirements)

    # Steps 2-4: Tailor
    try:
        tailored_md, ats_score, ats_feedback, model_used = await tailoring_engine.tailor(
            job_description=request.job_description,
            requirements=requirements,
            master_resume=master_data,
            intensity=request.intensity,
            preferred_model=request.preferred_model,
            enable_validation=settings.enable_validation,
            company=request.company,
            role=request.role,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM call failed during tailoring: {e}")

    # Save to history
    company = request.company or requirements.get("company", "")
    role = request.role or requirements.get("job_title", "")

    history_item = TailoredResume(
        company=company,
        role=role,
        job_description=request.job_description,
        intensity=request.intensity,
        model_used=model_used,
        tailored_markdown=tailored_md,
        ats_score=ats_score,
        ats_feedback=ats_feedback,
        requirements_json=requirements_json,
    )
    session.add(history_item)
    await session.commit()
    await session.refresh(history_item)

    return TailorResponse(
        id=history_item.id,
        tailored_markdown=tailored_md,
        ats_score=ats_score,
        ats_feedback=ats_feedback,
        model_used=model_used,
        company=company,
        role=role,
        created_at=history_item.created_at.isoformat(),
    )

@router.post("/analyze-jd")
async def analyze_jd(request: dict):
    jd_text = request.get("job_description", "")
    if not jd_text:
        raise HTTPException(status_code=400, detail="job_description is required")

    result, model_used = await jd_analyzer.analyze_jd(jd_text, preferred_model=request.get("preferred_model"))
    return {"requirements": result, "model_used": model_used}
