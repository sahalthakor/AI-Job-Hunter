from pathlib import Path
from uuid import uuid4

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile
)

from app.services.resume_parser import (
    extract_resume_text
)

from app.services.ai_parser import (
    analyze_resume
)
from app.models.user import User
from app.routers.auth import get_current_user


router = APIRouter(
    prefix="/resume",
    tags=["Resume"]
)


# =========================================================
# SECURE UPLOAD DIRECTORY
# =========================================================

BASE_DIR = Path(__file__).resolve().parents[2]

UPLOAD_DIR = BASE_DIR / "uploads"

UPLOAD_DIR.mkdir(
    parents=True,
    exist_ok=True
)


# =========================================================
# ALLOWED FILE TYPES
# =========================================================

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".docx",
    ".doc"
}


MAX_FILE_SIZE = 10 * 1024 * 1024


# =========================================================
# UPLOAD + AI ANALYSIS
# =========================================================

@router.post("/upload")
async def upload_resume(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):

    # -----------------------------------------------------
    # CHECK FILE NAME
    # -----------------------------------------------------

    if not file.filename:

        raise HTTPException(
            status_code=400,
            detail="Please select a resume file."
        )


    # -----------------------------------------------------
    # GET EXTENSION
    # -----------------------------------------------------

    original_filename = Path(
        file.filename
    ).name

    file_extension = Path(
        original_filename
    ).suffix.lower()


    if file_extension not in ALLOWED_EXTENSIONS:

        raise HTTPException(
            status_code=400,
            detail=(
                "Only PDF, DOC and DOCX "
                "files are supported."
            )
        )


    # -----------------------------------------------------
    # READ FILE
    # -----------------------------------------------------

    file_content = await file.read()


    if not file_content:

        raise HTTPException(
            status_code=400,
            detail="The uploaded file is empty."
        )


    if len(file_content) > MAX_FILE_SIZE:

        raise HTTPException(
            status_code=400,
            detail="File size must be less than 10 MB."
        )


    # -----------------------------------------------------
    # GENERATE RANDOM STORAGE NAME
    # -----------------------------------------------------

    storage_filename = (
        f"{uuid4().hex}"
        f"{file_extension}"
    )


    file_path = (
        UPLOAD_DIR /
        storage_filename
    )


    # -----------------------------------------------------
    # SAVE FILE
    # -----------------------------------------------------

    try:

        with open(
            file_path,
            "wb"
        ) as buffer:

            buffer.write(
                file_content
            )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=(
                "Could not store the uploaded "
                f"resume: {str(error)}"
            )
        )


    # -----------------------------------------------------
    # EXTRACT TEXT
    # -----------------------------------------------------

    try:

        resume_text = (
            extract_resume_text(
                file_path
            )
        )

    except Exception as error:

        # Remove file if extraction fails
        try:

            file_path.unlink(
                missing_ok=True
            )

        except Exception:
            pass


        raise HTTPException(
            status_code=400,
            detail=(
                "Could not read resume: "
                f"{str(error)}"
            )
        )


    if not resume_text.strip():

        try:

            file_path.unlink(
                missing_ok=True
            )

        except Exception:
            pass


        raise HTTPException(
            status_code=400,
            detail=(
                "Could not extract text "
                "from the resume."
            )
        )


    # -----------------------------------------------------
    # AI ANALYSIS
    # -----------------------------------------------------

    try:

        candidate_profile = (
            analyze_resume(
                resume_text
            )
        )

    except Exception as error:

        # Remove file if AI processing fails
        try:

            file_path.unlink(
                missing_ok=True
            )

        except Exception:
            pass


        raise HTTPException(
            status_code=500,
            detail=(
                "AI resume analysis failed: "
                f"{str(error)}"
            )
        )


    # -----------------------------------------------------
    # RETURN DRAFT
    #
    # IMPORTANT:
    # Nothing is saved to candidates table yet.
    #
    # Candidate reviews the profile first.
    # -----------------------------------------------------

    return {

        "message":
            "Resume analyzed successfully",

        # Filename shown to the user
        "filename":
            original_filename,

        # Internal server filename
        # Needed when profile is finally saved
        "storage_filename":
            storage_filename,

        "text_length":
            len(resume_text),

        "profile":
            candidate_profile.model_dump()
    }
