from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.job_sources import get_job_source_status
from app.job_sources.adzuna import AdzunaJobSource
from app.services.job_importer import import_adzuna_jobs
from app.services.job_search_service import search_and_import_jobs


router = APIRouter(
    prefix="/job-sources",
    tags=["Job Sources"],
)


@router.get("")
def get_source_status():
    """List all supported providers and whether each is ready to search."""
    sources = get_job_source_status()
    return {
        "sources": sources,
        "configured_count": sum(source["configured"] for source in sources),
    }


# ---------------------------------------------------------
# 1. Search jobs from Adzuna
# ---------------------------------------------------------

@router.get("/adzuna/search")
def search_adzuna_jobs(
    keywords: str = Query(..., min_length=1),
    location: str = Query(""),
    page: int = Query(1, ge=1),
    results_per_page: int = Query(20, ge=1, le=50),
):
    try:
        source = AdzunaJobSource()

        jobs = source.search_jobs(
            keywords=keywords,
            location=location,
            page=page,
            results_per_page=results_per_page,
        )

        return {
            "source": "adzuna",
            "count": len(jobs),
            "jobs": jobs,
        }

    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"Adzuna request failed: {error}",
        )


# ---------------------------------------------------------
# 2. Import Adzuna jobs into PostgreSQL
# ---------------------------------------------------------

@router.post("/adzuna/import")
def import_adzuna(
    keywords: str = Query(..., min_length=1),
    location: str = Query(""),
    page: int = Query(1, ge=1),
    results_per_page: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    try:
        result = import_adzuna_jobs(
            db=db,
            keywords=keywords,
            location=location,
            page=page,
            results_per_page=results_per_page,
        )

        return result

    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"Job import failed: {error}",
        )


# ---------------------------------------------------------
# 3. Search all configured providers and import deduplicated jobs
# ---------------------------------------------------------

@router.post("/search-and-import")
def search_and_import(
    keywords: list[str],
    location: str = "",
    pages: int = Query(1, ge=1, le=5),
    results_per_page: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    try:
        result = search_and_import_jobs(
            db=db,
            keywords=keywords,
            location=location,
            pages=pages,
            results_per_page=results_per_page,
        )

        return result

    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"Job search failed: {error}",
        )
