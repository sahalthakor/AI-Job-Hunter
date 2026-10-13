from sqlalchemy.orm import Session

from app.job_sources.adzuna import AdzunaJobSource
from app.models.job import Job


def import_adzuna_jobs(
    db: Session,
    keywords: str,
    location: str = "",
    page: int = 1,
    results_per_page: int = 20,
) -> dict:

    source = AdzunaJobSource()

    jobs = source.search_jobs(
        keywords=keywords,
        location=location,
        page=page,
        results_per_page=results_per_page,
    )

    saved = 0
    skipped = 0

    for data in jobs:

        existing = (
            db.query(Job)
            .filter(
                Job.source == data["source"],
                Job.external_id == data["external_id"],
            )
            .first()
        )

        if existing:
            skipped += 1
            continue

        job = Job(
            source=data["source"],
            external_id=data["external_id"],
            title=data["title"],
            company=data["company"],
            location=data["location"],
            description=data["description"],
            skills=data["skills"],
            experience_required=data["experience_required"],
            employment_type=data["employment_type"],
            salary=data["salary"],
            job_url=data["job_url"],
            posted_at=data["posted_at"],
        )

        db.add(job)
        saved += 1

    db.commit()

    return {
        "source": "adzuna",
        "fetched": len(jobs),
        "saved": saved,
        "skipped": skipped,
    }