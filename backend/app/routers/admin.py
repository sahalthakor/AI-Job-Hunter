from pathlib import Path
from fastapi import (
    APIRouter,
    Depends,
    HTTPException
)

from sqlalchemy.orm import Session

from app.database import get_db
from app.models.candidate import Candidate
from app.models.user import User

from app.routers.auth import require_admin


router = APIRouter(
    prefix="/admin",
    tags=["Admin"]
)


# =========================================================
# ADMIN DASHBOARD
# =========================================================

@router.get("/dashboard")
def admin_dashboard(

    current_admin: User = Depends(
        require_admin
    ),

    db: Session = Depends(
        get_db
    )
):

    total_users = (
        db.query(User)
        .filter(
            User.role == "candidate"
        )
        .count()
    )

    total_resumes = (
        db.query(Candidate)
        .count()
    )

    return {

        "total_candidates":
            total_users,

        "total_resumes":
            total_resumes
    }


# =========================================================
# ALL CANDIDATES
# =========================================================

@router.get("/candidates")
def get_all_candidates(

    current_admin: User = Depends(
        require_admin
    ),

    db: Session = Depends(
        get_db
    )
):

    candidates = (
        db.query(User)
        .filter(
            User.role == "candidate"
        )
        .order_by(
            User.id.desc()
        )
        .all()
    )

    result = []

    for user in candidates:

        resume_count = (
            db.query(Candidate)
            .filter(
                Candidate.user_id ==
                user.id
            )
            .count()
        )

        result.append({

            "id":
                user.id,

            "name":
                user.name,

            "email":
                user.email,

            "role":
                user.role,

            "created_at":
                user.created_at,

            "resume_count":
                resume_count
        })

    return result


# =========================================================
# ALL RESUMES
# =========================================================

@router.get("/resumes")
def get_all_resumes(

    current_admin: User = Depends(
        require_admin
    ),

    db: Session = Depends(
        get_db
    )
):

    resumes = (
        db.query(Candidate)
        .order_by(
            Candidate.id.desc()
        )
        .all()
    )

    result = []

    for resume in resumes:

        user = (
            db.query(User)
            .filter(
                User.id ==
                resume.user_id
            )
            .first()
        )

        result.append({

            "id":
                resume.id,

            "user_id":
                resume.user_id,

            "candidate_name":
                (
                    user.name
                    if user
                    else resume.name
                ),

            "candidate_email":
                (
                    user.email
                    if user
                    else resume.email
                ),

            "resume_filename":
                resume.resume_filename,

            "name":
                resume.name,

            "email":
                resume.email,

            "phone":
                resume.phone,

            "headline":
                resume.headline,

            "skills":
                resume.skills or [],

            "education":
                resume.education or [],

            "experience":
                resume.experience or [],

            "projects":
                resume.projects or [],

            "certifications":
                resume.certifications or [],

            "preferred_roles":
                resume.preferred_roles or [],

            "preferred_locations":
                resume.preferred_locations or []
        })

    return result


# =========================================================
# SINGLE CANDIDATE
# =========================================================

@router.get("/candidates/{user_id}")
def get_candidate_details(

    user_id: int,

    current_admin: User = Depends(
        require_admin
    ),

    db: Session = Depends(
        get_db
    )
):

    user = (
        db.query(User)
        .filter(
            User.id == user_id,

            User.role == "candidate"
        )
        .first()
    )

    if not user:

        raise HTTPException(
            status_code=404,
            detail="Candidate not found."
        )

    resumes = (
        db.query(Candidate)
        .filter(
            Candidate.user_id ==
            user.id
        )
        .order_by(
            Candidate.id.desc()
        )
        .all()
    )

    return {

        "id":
            user.id,

        "name":
            user.name,

        "email":
            user.email,

        "role":
            user.role,

        "created_at":
            user.created_at,

        "resumes": [

            candidate_to_admin_dict(
                resume
            )

            for resume in resumes
        ]
    }


# =========================================================
# ADMIN DELETE RESUME
# =========================================================

@router.delete("/resumes/{resume_id}")
def delete_resume(

    resume_id: int,

    current_admin: User = Depends(
        require_admin
    ),

    db: Session = Depends(
        get_db
    )
):

    resume = (
        db.query(Candidate)
        .filter(
            Candidate.id == resume_id
        )
        .first()
    )


    if not resume:

        raise HTTPException(
            status_code=404,
            detail="Resume not found."
        )


    storage_name = (
        resume.resume_storage_name
    )


    db.delete(resume)

    db.commit()


    # -----------------------------------------------------
    # DELETE PHYSICAL FILE
    # -----------------------------------------------------

    if storage_name:

        base_dir = (
            Path(__file__)
            .resolve()
            .parents[2]
        )

        upload_dir = (
            base_dir /
            "uploads"
        )

        safe_filename = (
            Path(storage_name).name
        )

        file_path = (
            upload_dir /
            safe_filename
        )

        try:

            file_path.unlink(
                missing_ok=True
            )

        except Exception as error:

            print(
                "Warning: could not delete "
                f"physical resume file: {error}"
            )


    return {

        "message":
            "Resume deleted successfully",

        "resume_id":
            resume_id
    }


# =========================================================
# HELPER
# =========================================================

def candidate_to_admin_dict(
    candidate: Candidate
):

    return {

        "id":
            candidate.id,

        "user_id":
            candidate.user_id,

        "resume_filename":
            candidate.resume_filename,

        "name":
            candidate.name,

        "email":
            candidate.email,

        "phone":
            candidate.phone,

        "headline":
            candidate.headline,

        "skills":
            candidate.skills or [],

        "education":
            candidate.education or [],

        "experience":
            candidate.experience or [],

        "projects":
            candidate.projects or [],

        "certifications":
            candidate.certifications or [],

        "preferred_roles":
            candidate.preferred_roles or [],

        "preferred_locations":
            candidate.preferred_locations or []
    }