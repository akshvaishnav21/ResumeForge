from fastapi import APIRouter
from ..services import router as model_router

router = APIRouter(prefix="/api", tags=["models"])

@router.get("/models/status")
async def get_models_status():
    status = await model_router.get_model_status()
    return {"models": status}
