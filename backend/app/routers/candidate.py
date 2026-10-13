from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    HTTPException
)

from pydantic import BaseModel, Field

from sqlalchemy.orm import Session

from app.database import get_db
from app.models.candidate import Candidate
from app.models.user import User

from app.routers.auth import get_current_user


router = APIRouter(
    prefix="/candidate",
    tags=["Candidate"]
)


# =========================================================
# UPLOAD DIRECTORY
# =========================================================

BASE_DIR = Path(__file__).resolve().parents[2]

UPLOAD_DIR = BASE_DIR / "uploads"


# =========================================================
# CREATE SCHEMA
# =========================================================

class CandidateCreate(BaseModel):

    resume_filename: str = ""

    resume_storage_name: str = ""

    name: str = ""

    email: str = ""

    phone: str = ""

    headline: str = ""

    skills: list[str] = Field(
        default_factory=list
    )

    education: list[dict] = Field(
        default_factory=list
    )

    experience: list[dict] = Field(
        default_factory=list
    )

    projects: list[dict] = Field(
        default_factory=list
    )

    certifications: list[str] = Field(
        default_factory=list
    )

    preferred_roles: list[str] = Field(
        default_factory=list
    )

    preferred_locations: list[str] = Field(
        default_factory=list
    )


# =========================================================
# UPDATE SCHEMA
# =========================================================

class CandidateUpdate(BaseModel):

    resume_filename: str = ""

    resume_storage_name: str = ""

    name: str = ""

    email: str = ""

    phone: str = ""

    headline: str = ""

    skills: list[str] = Field(
        default_factory=list
    )

    education: list[dict] = Field(
        default_factory=list
    )

    experience: list[dict] = Field(
        default_factory=list
    )

    projects: list[dict] = Field(
        default_factory=list
    )

    certifications: list[str] = Field(
        default_factory=list
    )

    preferred_roles: list[str] = Field(
        default_factory=list
    )

    preferred_locations: list[str] = Field(
        default_factory=list
    )


# =========================================================
# HELPER
# =========================================================

def candidate_to_dict(
    candidate: Candidate
):

    return {

        "id":
            candidate.id,

        "user_id":
            candidate.user_id,

        "resume_filename":
            candidate.resume_filename,

        # Do not expose the storage filename
        # to normal candidate UI
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


# =========================================================
# CREATE PROFILE
# =========================================================

@router.post("")
def create_candidate(

    data: CandidateCreate,

    current_user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    )
):

    candidate = Candidate(

        user_id=
            current_user.id,

        resume_filename=
            data.resume_filename,

        resume_storage_name=
            data.resume_storage_name,

        name=
            data.name,

        email=
            data.email,

        phone=
            data.phone,

        headline=
            data.headline,

        skills=
            data.skills,

        education=
            data.education,

        experience=
            data.experience,

        projects=
            data.projects,

        certifications=
            data.certifications,

        preferred_roles=
            data.preferred_roles,

        preferred_locations=
            data.preferred_locations
    )


    db.add(candidate)

    db.commit()

    db.refresh(candidate)


    return {

        "message":
            "Candidate profile created successfully",

        "candidate":
            candidate_to_dict(
                candidate
            )
    }


# =========================================================
# MY LATEST PROFILE
# =========================================================

@router.get("/me")
def get_my_candidate(

    current_user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    )
):

    candidate = (
        db.query(Candidate)
        .filter(
            Candidate.user_id ==
            current_user.id
        )
        .order_by(
            Candidate.id.desc()
        )
        .first()
    )


    if not candidate:

        raise HTTPException(
            status_code=404,
            detail=
                "No candidate profile found."
        )


    return candidate_to_dict(
        candidate
    )


# =========================================================
# MY RESUME HISTORY
# =========================================================

@router.get("/history")
def get_my_candidate_history(

    current_user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    )
):

    candidates = (
        db.query(Candidate)
        .filter(
            Candidate.user_id ==
            current_user.id
        )
        .order_by(
            Candidate.id.desc()
        )
        .all()
    )


    return [

        candidate_to_dict(
            candidate
        )

        for candidate in candidates
    ]


# =========================================================
# UPDATE MY PROFILE
# =========================================================

@router.put("/{candidate_id}")
def update_candidate(

    candidate_id: int,

    data: CandidateUpdate,

    current_user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    )
):

    candidate = (
        db.query(Candidate)
        .filter(

            Candidate.id ==
            candidate_id,

            Candidate.user_id ==
            current_user.id

        )
        .first()
    )


    if not candidate:

        raise HTTPException(
            status_code=404,
            detail=
                "Candidate profile not found."
        )


    old_storage_name = (
        candidate.resume_storage_name
    )


    candidate.resume_filename = (
        data.resume_filename
    )

    candidate.resume_storage_name = (
        data.resume_storage_name
    )

    candidate.name = data.name

    candidate.email = data.email

    candidate.phone = data.phone

    candidate.headline = data.headline

    candidate.skills = data.skills

    candidate.education = data.education

    candidate.experience = data.experience

    candidate.projects = data.projects

    candidate.certifications = (
        data.certifications
    )

    candidate.preferred_roles = (
        data.preferred_roles
    )

    candidate.preferred_locations = (
        data.preferred_locations
    )


    db.commit()

    db.refresh(candidate)


    # -----------------------------------------------------
    # If a different physical resume was supplied,
    # remove the old one.
    # -----------------------------------------------------

    if (
        old_storage_name
        and
        data.resume_storage_name
        and
        old_storage_name !=
        data.resume_storage_name
    ):

        old_file = (
            UPLOAD_DIR /
            Path(old_storage_name).name
        )

        try:

            old_file.unlink(
                missing_ok=True
            )

        except Exception:

            pass


    return {

        "message":
            "Candidate profile updated successfully",

        "candidate":
            candidate_to_dict(
                candidate
            )
    }


# =========================================================
# DELETE MY RESUME
# =========================================================

@router.delete(
    "/resume/{candidate_id}"
)
def delete_my_resume(

    candidate_id: int,

    current_user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    )
):

    # -----------------------------------------------------
    # SECURITY:
    # candidate can ONLY delete their own record
    # -----------------------------------------------------

    candidate = (
        db.query(Candidate)
        .filter(

            Candidate.id ==
            candidate_id,

            Candidate.user_id ==
            current_user.id

        )
        .first()
    )


    if not candidate:

        raise HTTPException(
            status_code=404,
            detail="Resume not found."
        )


    storage_name = (
        candidate.resume_storage_name
    )


    # -----------------------------------------------------
    # DELETE DATABASE RECORD
    # -----------------------------------------------------

    db.delete(candidate)

    db.commit()


    # -----------------------------------------------------
    # DELETE PHYSICAL FILE
    # -----------------------------------------------------

    if storage_name:

        safe_filename = (
            Path(storage_name).name
        )

        file_path = (
            UPLOAD_DIR /
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
            "Resume deleted successfully"
    }