from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from datetime import datetime

from ..database import get_session
from ..models.resume import MasterResume, MasterResumeData

router = APIRouter(prefix="/api", tags=["resume"])

@router.get("/resume")
async def get_resume(session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(MasterResume).order_by(MasterResume.version.desc()))
    master = result.scalars().first()

    if not master:
        return {"data": MasterResumeData().model_dump(), "version": 0}

    return {"data": master.get_data().model_dump(), "version": master.version}

@router.put("/resume")
async def update_resume(data: MasterResumeData, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(MasterResume).order_by(MasterResume.version.desc()))
    existing = result.scalars().first()

    new_version = (existing.version + 1) if existing else 1

    master = MasterResume(version=new_version, updated_at=datetime.utcnow())
    master.set_data(data)
    session.add(master)
    await session.commit()
    await session.refresh(master)

    return {"message": "Resume saved", "version": master.version}
