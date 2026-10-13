from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.job import Job
from app.schemas.job import JobCreate, JobResponse


router = APIRouter(
    prefix="/jobs",
    tags=["Jobs"],
)


def job_to_dict(job: Job):
    return {
        "id": job.id,
        "source": job.source,
        "external_id": job.external_id,
        "title": job.title,
        "company": job.company or "",
        "location": job.location or "",
        "description": job.description or "",
        "skills": job.skills or [],
        "experience_required": job.experience_required or "",
        "employment_type": job.employment_type or "",
        "salary": job.salary or "",
        "job_url": job.job_url,
        "posted_at": job.posted_at,
        "fetched_at": job.fetched_at,
        "updated_at": job.updated_at,
    }


@router.post("", response_model=JobResponse)
def create_job(
    data: JobCreate,
    db: Session = Depends(get_db),
):
    existing_job = (
        db.query(Job)
        .filter(
            Job.source == data.source,
            Job.external_id == data.external_id,
        )
        .first()
    )

    if existing_job:
        raise HTTPException(
            status_code=409,
            detail="This job already exists.",
        )

    job = Job(
        source=data.source,
        external_id=data.external_id,
        title=data.title,
        company=data.company,
        location=data.location,
        description=data.description,
        skills=data.skills,
        experience_required=data.experience_required,
        employment_type=data.employment_type,
        salary=data.salary,
        job_url=data.job_url,
        posted_at=data.posted_at,
    )

    db.add(job)
    db.commit()
    db.refresh(job)

    return job


@router.post("/bulk", response_model=list[JobResponse])
def create_jobs_bulk(
    jobs: list[JobCreate],
    db: Session = Depends(get_db),
):
    saved_jobs = []

    for data in jobs:
        existing_job = (
            db.query(Job)
            .filter(
                Job.source == data.source,
                Job.external_id == data.external_id,
            )
            .first()
        )

        if existing_job:
            continue

        job = Job(
            source=data.source,
            external_id=data.external_id,
            title=data.title,
            company=data.company,
            location=data.location,
            description=data.description,
            skills=data.skills,
            experience_required=data.experience_required,
            employment_type=data.employment_type,
            salary=data.salary,
            job_url=data.job_url,
            posted_at=data.posted_at,
        )

        db.add(job)
        saved_jobs.append(job)

    if saved_jobs:
        db.commit()

        for job in saved_jobs:
            db.refresh(job)

    return saved_jobs


@router.get("", response_model=list[JobResponse])
def get_jobs(
    search: Optional[str] = Query(
        default=None,
        description="Search job title, company, description or skills",
    ),
    location: Optional[str] = Query(
        default=None,
        description="Filter by job location",
    ),
    source: Optional[str] = Query(
        default=None,
        description="Filter by source",
    ),
    employment_type: Optional[str] = Query(
        default=None,
        description="Filter by employment type",
    ),
    limit: int = Query(
        default=50,
        ge=1,
        le=200,
    ),
    offset: int = Query(
        default=0,
        ge=0,
    ),
    db: Session = Depends(get_db),
):
    query = db.query(Job)

    if search:
        search_term = f"%{search.strip()}%"

        query = query.filter(
            or_(
                Job.title.ilike(search_term),
                Job.company.ilike(search_term),
                Job.description.ilike(search_term),
                Job.location.ilike(search_term),
            )
        )

    if location:
        query = query.filter(
            Job.location.ilike(f"%{location.strip()}%")
        )

    if source:
        query = query.filter(
            Job.source.ilike(f"%{source.strip()}%")
        )

    if employment_type:
        query = query.filter(
            Job.employment_type.ilike(
                f"%{employment_type.strip()}%"
            )
        )

    jobs = (
        query
        .order_by(
            Job.posted_at.desc().nullslast(),
            Job.fetched_at.desc(),
            Job.id.desc(),
        )
        .offset(offset)
        .limit(limit)
        .all()
    )

    return jobs


@router.get("/{job_id}", response_model=JobResponse)
def get_job(
    job_id: int,
    db: Session = Depends(get_db),
):
    job = (
        db.query(Job)
        .filter(Job.id == job_id)
        .first()
    )

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Job not found.",
        )

    return job


@router.delete("/{job_id}")
def delete_job(
    job_id: int,
    db: Session = Depends(get_db),
):
    job = (
        db.query(Job)
        .filter(Job.id == job_id)
        .first()
    )

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Job not found.",
        )

    db.delete(job)
    db.commit()

    return {
        "message": "Job deleted successfully",
        "job_id": job_id,
    }


@router.get("/stats/summary")
def job_stats(
    db: Session = Depends(get_db),
):
    total_jobs = db.query(Job).count()

    sources = (
        db.query(Job.source)
        .distinct()
        .all()
    )

    source_names = [
        source[0]
        for source in sources
        if source[0]
    ]

    return {
        "total_jobs": total_jobs,
        "sources": source_names,
        "source_count": len(source_names),
    }