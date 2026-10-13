from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.routers.auth import get_current_user
from app.services.candidate_job_search import search_jobs_for_candidate


router = APIRouter(
    prefix="/candidate-jobs",
    tags=["Candidate Jobs"],
)


@router.post("/search")
def search_candidate_jobs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        from app.models.candidate import Candidate

        candidate = (
            db.query(Candidate)
            .filter(Candidate.user_id == current_user.id)
            .order_by(Candidate.id.desc())
            .first()
        )

        if not candidate:
            raise HTTPException(
                status_code=404,
                detail="No candidate profile found.",
            )

        return search_jobs_for_candidate(
            db=db,
            candidate_id=candidate.id,
        )

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Candidate job search failed: {error}",
        )