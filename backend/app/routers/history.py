from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from typing import Optional

from ..database import get_session
from ..models.history import TailoredResume

router = APIRouter(prefix="/api", tags=["history"])

@router.get("/history")
async def list_history(
    company: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_session)
):
    query = select(TailoredResume).order_by(TailoredResume.created_at.desc()).limit(limit)
    result = await session.execute(query)
    items = result.scalars().all()

    if company:
        items = [i for i in items if company.lower() in i.company.lower()]
    if role:
        items = [i for i in items if role.lower() in i.role.lower()]

    return [
        {
            "id": item.id,
            "company": item.company,
            "role": item.role,
            "intensity": item.intensity,
            "model_used": item.model_used,
            "ats_score": item.ats_score,
            "created_at": item.created_at.isoformat(),
        }
        for item in items
    ]

@router.get("/history/{item_id}")
async def get_history_item(item_id: int, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(TailoredResume).where(TailoredResume.id == item_id))
    item = result.scalars().first()

    if not item:
        raise HTTPException(status_code=404, detail="History item not found")

    return {
        "id": item.id,
        "company": item.company,
        "role": item.role,
        "job_description": item.job_description,
        "intensity": item.intensity,
        "model_used": item.model_used,
        "tailored_markdown": item.tailored_markdown,
        "ats_score": item.ats_score,
        "ats_feedback": item.ats_feedback,
        "created_at": item.created_at.isoformat(),
    }

@router.patch("/history/{item_id}")
async def update_history_item(item_id: int, body: dict, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(TailoredResume).where(TailoredResume.id == item_id))
    item = result.scalars().first()

    if not item:
        raise HTTPException(status_code=404, detail="History item not found")

    if "tailored_markdown" in body:
        item.tailored_markdown = body["tailored_markdown"]

    session.add(item)
    await session.commit()
    return {"message": "Updated"}
