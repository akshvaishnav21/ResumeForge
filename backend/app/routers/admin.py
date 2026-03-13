from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import delete

from ..database import get_session
from ..models.history import TailoredResume
from ..models.resume import MasterResume

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.delete("/reset")
async def reset_all_data(session: AsyncSession = Depends(get_session)):
    await session.exec(delete(TailoredResume))
    await session.exec(delete(MasterResume))
    await session.commit()
    return {"status": "ok", "message": "All data cleared"}
