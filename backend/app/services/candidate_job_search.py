from sqlalchemy.orm import Session

from app.models.candidate import Candidate
from app.services.job_search_service import search_and_import_jobs


def search_jobs_for_candidate(
    db: Session,
    candidate_id: int,
) -> dict:

    candidate = (
        db.query(Candidate)
        .filter(Candidate.id == candidate_id)
        .first()
    )

    if not candidate:
        raise ValueError("Candidate profile not found.")

    roles = candidate.preferred_roles or []
    locations = candidate.preferred_locations or []

    if not roles:
        raise ValueError(
            "No preferred job roles found in candidate profile."
        )

    location = ""

    if locations:
        location = locations[0]

    result = search_and_import_jobs(
        db=db,
        keywords=roles,
        location=location,
        pages=1,
        results_per_page=20,
    )

    return {
        "candidate_id": candidate.id,
        "candidate_name": candidate.name,
        "searched_roles": roles,
        "searched_location": location,
        "result": result,
    }