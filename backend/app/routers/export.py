from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from typing import Optional

from ..database import get_session
from ..models.history import TailoredResume
from ..services import exporter

router = APIRouter(prefix="/api", tags=["export"])


class ExportRequest(BaseModel):
    markdown: str
    filename: Optional[str] = "resume"
    format: str = "pdf"


def _export(md: str, fmt: str, filename: str) -> Response:
    filename = filename.replace(" ", "_").lower()

    if fmt == "md":
        return Response(content=exporter.to_markdown(md), media_type="text/markdown",
                        headers={"Content-Disposition": f"attachment; filename={filename}.md"})
    elif fmt == "txt":
        return Response(content=exporter.to_txt(md), media_type="text/plain",
                        headers={"Content-Disposition": f"attachment; filename={filename}.txt"})
    elif fmt == "pdf":
        return Response(content=exporter.to_pdf(md), media_type="application/pdf",
                        headers={"Content-Disposition": f"attachment; filename={filename}.pdf"})
    elif fmt == "docx":
        return Response(content=exporter.to_docx(md),
                        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        headers={"Content-Disposition": f"attachment; filename={filename}.docx"})
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {fmt}. Use md, txt, pdf, or docx")


@router.post("/export-custom")
async def export_markdown(body: ExportRequest):
    """Export arbitrary markdown content — used for exporting filtered/selected resume."""
    try:
        return _export(body.markdown, body.format, body.filename or "resume")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export/{item_id}/{fmt}")
async def export_resume(item_id: int, fmt: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(TailoredResume).where(TailoredResume.id == item_id))
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Resume not found")

    filename = f"resume_{item.company}_{item.role}"
    try:
        return _export(item.tailored_markdown, fmt, filename)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
