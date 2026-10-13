"""Configured job-source registry.

Add a provider here rather than branching throughout API routes.  Searches
can then fan out to every configured source and isolate individual provider
failures from one another.
"""

from app.job_sources.adzuna import AdzunaJobSource
from app.job_sources.jooble import JoobleJobSource


SOURCE_CLASSES = {
    "adzuna": AdzunaJobSource,
    "jooble": JoobleJobSource,
}


def get_configured_job_sources():
    """Return enabled sources and reasons optional sources are unavailable."""
    sources = []
    unavailable = {}

    for name, source_class in SOURCE_CLASSES.items():
        try:
            sources.append((name, source_class()))
        except RuntimeError as error:
            unavailable[name] = str(error)

    return sources, unavailable


def get_job_source_status():
    """Expose provider availability without exposing credential values."""
    sources, unavailable = get_configured_job_sources()
    enabled_names = {name for name, _ in sources}

    return [
        {
            "name": name,
            "configured": name in enabled_names,
            "reason": unavailable.get(name),
        }
        for name in SOURCE_CLASSES
    ]
