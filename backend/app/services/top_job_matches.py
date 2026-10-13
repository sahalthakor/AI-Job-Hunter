from sqlalchemy.orm import Session

from app.models.candidate import Candidate
from app.models.job import Job
from app.services.job_matcher import match_job_to_candidate


def get_top_job_matches(
    db: Session,
    candidate: Candidate,
    limit: int = 10,
) -> list[dict]:

    jobs = (
        db.query(Job)
        .order_by(
            Job.posted_at.desc().nullslast(),
            Job.fetched_at.desc(),
        )
        .limit(50)
        .all()
    )

    matched_jobs = []

    for job in jobs:
        try:
            match = match_job_to_candidate(
                candidate=candidate,
                job=job,
            )

            matched_jobs.append(
                {
                    "job": {
                        "id": job.id,
                        "title": job.title,
                        "company": job.company,
                        "location": job.location,
                        "description": job.description,
                        "skills": job.skills or [],
                        "experience_required": (
                            job.experience_required or ""
                        ),
                        "employment_type": (
                            job.employment_type or ""
                        ),
                        "salary": job.salary or "",
                        "job_url": job.job_url,
                        "source": job.source,
                        "posted_at": job.posted_at,
                    },
                    "match": match.model_dump(),
                }
            )

        except Exception as error:
            print(
                f"Could not match job {job.id}: {error}"
            )

    matched_jobs.sort(
        key=lambda item: item["match"]["match_score"],
        reverse=True,
    )

    return matched_jobs[:limit]