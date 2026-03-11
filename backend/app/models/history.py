from typing import Optional, List
from pydantic import BaseModel
from sqlmodel import SQLModel, Field
from datetime import datetime

class TailoredResume(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    company: str = ""
    role: str = ""
    job_description: str = ""
    intensity: str = "moderate"
    model_used: str = ""
    tailored_markdown: str = ""
    ats_score: Optional[int] = None
    ats_feedback: Optional[str] = None
    requirements_json: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class TailorRequest(BaseModel):
    job_description: str
    intensity: str = "moderate"  # light, moderate, heavy
    preferred_model: Optional[str] = None
    company: str = ""
    role: str = ""

class TailorResponse(BaseModel):
    id: int
    tailored_markdown: str
    ats_score: Optional[int]
    ats_feedback: Optional[str]
    model_used: str
    company: str
    role: str
    created_at: str
