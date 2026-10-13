from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.candidate import Candidate
from app.models.user import User
from app.routers.auth import get_current_user
from app.services.top_job_matches import get_top_job_matches


router = APIRouter(
    prefix="/top-matches",
    tags=["AI Job Matching"],
)


@router.get("")
def get_my_top_matches(
    limit: int = Query(10, ge=1, le=20),
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

    try:
        matches = get_top_job_matches(
            db=db,
            candidate=candidate,
            limit=limit,
        )

        return {
            "candidate_id": candidate.id,
            "candidate_name": candidate.name,
            "count": len(matches),
            "matches": matches,
        }

    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"Could not generate job matches: {error}",
        )