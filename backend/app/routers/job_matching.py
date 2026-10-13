from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.user import User
from app.routers.auth import get_current_user
from app.services.job_matcher import match_job_to_candidate



router = APIRouter(
    prefix="/job-matching",
    tags=["AI Job Matching"],
)


@router.get("/{job_id}")
def match_job(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    candidate = (
        db.query(Candidate)
        .filter(
            Candidate.user_id == current_user.id
        )
        .order_by(Candidate.id.desc())
        .first()
    )

    if not candidate:
        raise HTTPException(
            status_code=404,
            detail="No candidate profile found.",
        )

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

    try:
        result = match_job_to_candidate(
            candidate=candidate,
            job=job,
        )

        return {
            "job": {
                "id": job.id,
                "title": job.title,
                "company": job.company,
                "location": job.location,
                "job_url": job.job_url,
            },
            "match": result.model_dump(),
        }

    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"AI job matching failed: {error}",
        )