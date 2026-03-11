from typing import Optional
from sqlmodel import SQLModel, Field
from datetime import datetime

class UserSettings(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    key: str = Field(index=True, unique=True)
    value: str = ""
    updated_at: datetime = Field(default_factory=datetime.utcnow)
