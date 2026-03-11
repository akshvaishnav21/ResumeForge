from fastapi import APIRouter, Header
from typing import Optional
from ..services import router as model_router

router = APIRouter(prefix="/api", tags=["models"])

@router.get("/models/status")
async def get_models_status(x_gemini_api_key: Optional[str] = Header(None)):
    status = await model_router.get_model_status(gemini_api_key=x_gemini_api_key)
    return {"models": status}
