from typing import List

from pydantic import BaseModel, Field


class Education(BaseModel):
    degree: str = ""
    institution: str = ""
    year: str = ""
    details: str = ""


class Experience(BaseModel):
    company: str = ""
    role: str = ""
    duration: str = ""
    description: str = ""


class Project(BaseModel):
    name: str = ""
    technologies: List[str] = Field(default_factory=list)
    description: str = ""


class CandidateProfile(BaseModel):
    name: str = ""
    email: str = ""
    phone: str = ""
    headline: str = ""
    skills: List[str] = Field(default_factory=list)
    education: List[Education] = Field(default_factory=list)
    experience: List[Experience] = Field(default_factory=list)
    projects: List[Project] = Field(default_factory=list)
    certifications: List[str] = Field(default_factory=list)
    preferred_roles: List[str] = Field(default_factory=list)
    preferred_locations: List[str] = Field(default_factory=list)