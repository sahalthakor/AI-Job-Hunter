from typing import List
from pydantic import BaseModel, Field


class JobMatchResult(BaseModel):
    match_score: int = Field(default=0, ge=0, le=100)
    match_level: str = ""
    reasons: List[str] = Field(default_factory=list)
    matching_skills: List[str] = Field(default_factory=list)
    missing_skills: List[str] = Field(default_factory=list)
    recommendation: str = ""