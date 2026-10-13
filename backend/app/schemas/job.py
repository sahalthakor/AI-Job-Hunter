from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class JobCreate(BaseModel):
    source: str
    external_id: str

    title: str
    company: str = ""
    location: str = ""

    description: str = ""

    skills: List[str] = Field(default_factory=list)

    experience_required: str = ""
    employment_type: str = ""

    salary: str = ""

    job_url: str

    posted_at: Optional[datetime] = None


class JobResponse(JobCreate):
    id: int
    fetched_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True