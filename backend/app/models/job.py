from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text, JSON, Index
from sqlalchemy.sql import func

from app.database import Base


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)

    # Source information
    source = Column(String(100), nullable=False, index=True)
    external_id = Column(String(255), nullable=False)

    # Core job information
    title = Column(String(300), nullable=False, index=True)
    company = Column(String(300), nullable=True, index=True)
    location = Column(String(300), nullable=True, index=True)

    # Full job information
    description = Column(Text, nullable=True)

    # Structured matching information
    skills = Column(JSON, nullable=False, default=list)
    experience_required = Column(String(150), nullable=True)
    employment_type = Column(String(100), nullable=True)

    # Compensation
    salary = Column(String(200), nullable=True)

    # Original listing
    job_url = Column(Text, nullable=False)

    # Tracking
    posted_at = Column(DateTime(timezone=True), nullable=True)
    fetched_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


Index(
    "uq_jobs_source_external_id",
    Job.source,
    Job.external_id,
    unique=True,
)

Index(
    "ix_jobs_title_company_location",
    Job.title,
    Job.company,
    Job.location,
)