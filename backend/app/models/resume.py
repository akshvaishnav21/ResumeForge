from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from sqlmodel import SQLModel, Field
import json
from datetime import datetime

class Contact(BaseModel):
    name: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    linkedin: str = ""
    github: str = ""
    website: str = ""

class AreaGroup(BaseModel):
    area: str = ""
    bullets: List[str] = []

class Experience(BaseModel):
    company: str = ""
    role: str = ""
    start_date: str = ""
    end_date: str = ""
    location: str = ""
    bullets: List[str] = []
    areas: List[AreaGroup] = []

class SkillCategory(BaseModel):
    category: str = ""
    skills: List[str] = []

class Project(BaseModel):
    name: str = ""
    description: str = ""
    technologies: List[str] = []
    bullets: List[str] = []
    url: str = ""

class Education(BaseModel):
    institution: str = ""
    degree: str = ""
    field: str = ""
    graduation_date: str = ""
    gpa: str = ""

class Certification(BaseModel):
    name: str = ""
    issuer: str = ""
    date: str = ""

class MasterResumeData(BaseModel):
    contact: Contact = Contact()
    summary: str = ""
    experience: List[Experience] = []
    skills: List[SkillCategory] = []
    projects: List[Project] = []
    education: List[Education] = []
    certifications: List[Certification] = []

class MasterResume(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    version: int = 1
    data_json: str = Field(default="{}")
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    def get_data(self) -> MasterResumeData:
        return MasterResumeData.model_validate(json.loads(self.data_json))

    def set_data(self, data: MasterResumeData):
        self.data_json = data.model_dump_json()
