from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.job_sources import get_configured_job_sources
from app.models.job import Job


def search_and_import_jobs(
    db: Session,
    keywords: list[str],
    location: str = "",
    pages: int = 1,
    results_per_page: int = 20,
) -> dict:
    total_fetched = 0
    total_saved = 0
    total_skipped = 0
    sources, unavailable_sources = get_configured_job_sources()

    if not sources:
        details = "; ".join(unavailable_sources.values())
        raise RuntimeError(
            "No job providers are configured. "
            f"{details}".strip()
        )

    normalized_keywords = list(
        dict.fromkeys(
            keyword.strip()
            for keyword in keywords
            if isinstance(keyword, str) and keyword.strip()
        )
    )

    if not normalized_keywords:
        raise ValueError("At least one non-empty job search keyword is required.")

    source_results = {
        name: {
            "fetched": 0,
            "saved": 0,
            "skipped": 0,
            "errors": [],
        }
        for name, _ in sources
    }

    # Providers can return the same vacancy for more than one role, and two
    # aggregators can expose the same original listing.  Avoid importing and
    # showing duplicate cards during a single multi-source search.
    seen_job_keys = set()

    for source_name, source in sources:
        report = source_results[source_name]

        for keyword in normalized_keywords:
            for page in range(1, pages + 1):
                try:
                    jobs = source.search_jobs(
                        keywords=keyword,
                        location=location,
                        page=page,
                        results_per_page=results_per_page,
                    )
                except Exception as error:
                    # One provider being unavailable must not hide matches
                    # from all the other configured providers.
                    report["errors"].append(
                        f"{keyword} (page {page}): {type(error).__name__}"
                    )
                    continue

                report["fetched"] += len(jobs)
                total_fetched += len(jobs)

                for data in jobs:
                    if not _is_valid_job(data):
                        report["skipped"] += 1
                        total_skipped += 1
                        continue

                    dedupe_key = _job_dedupe_key(data)
                    if dedupe_key in seen_job_keys or _job_already_exists(db, data):
                        seen_job_keys.add(dedupe_key)
                        report["skipped"] += 1
                        total_skipped += 1
                        continue

                    db.add(
                        Job(
                            source=data["source"],
                            external_id=data["external_id"],
                            title=data["title"],
                            company=data.get("company") or "",
                            location=data.get("location") or "",
                            description=data.get("description") or "",
                            skills=data.get("skills") or [],
                            experience_required=data.get("experience_required") or "",
                            employment_type=data.get("employment_type") or "",
                            salary=data.get("salary") or "",
                            job_url=data["job_url"],
                            posted_at=data.get("posted_at"),
                        )
                    )
                    seen_job_keys.add(dedupe_key)
                    report["saved"] += 1
                    total_saved += 1

    db.commit()

    return {
        "keywords": normalized_keywords,
        "location": location,
        "fetched": total_fetched,
        "saved": total_saved,
        "skipped": total_skipped,
        "source_results": source_results,
        "unavailable_sources": unavailable_sources,
    }


def _is_valid_job(data: dict) -> bool:
    return bool(
        data.get("source")
        and data.get("external_id")
        and data.get("title")
        and data.get("job_url")
    )


def _job_dedupe_key(data: dict) -> tuple:
    """Use the canonical URL when available, otherwise stable job metadata."""
    job_url = str(data.get("job_url") or "").strip().casefold()
    if job_url:
        return ("url", job_url)

    return (
        "details",
        str(data.get("title") or "").strip().casefold(),
        str(data.get("company") or "").strip().casefold(),
        str(data.get("location") or "").strip().casefold(),
    )


def _job_already_exists(db: Session, data: dict) -> bool:
    source_match = db.query(Job.id).filter(
        Job.source == data["source"],
        Job.external_id == data["external_id"],
    )
    if source_match.first():
        return True

    job_url = str(data.get("job_url") or "").strip()
    if job_url and db.query(Job.id).filter(Job.job_url == job_url).first():
        return True

    return bool(
        db.query(Job.id)
        .filter(
            and_(
                func.lower(Job.title) == str(data["title"]).strip().casefold(),
                func.lower(func.coalesce(Job.company, ""))
                == str(data.get("company") or "").strip().casefold(),
                func.lower(func.coalesce(Job.location, ""))
                == str(data.get("location") or "").strip().casefold(),
            )
        )
        .first()
    )
