"""Jooble job-source adapter.

Jooble aggregates listings from a broad range of employer sites and job
boards.  It is optional: the source is enabled only when JOOBLE_API_KEY is
configured, so a missing key never stops searches on other providers.
"""

import hashlib
import os
from datetime import datetime
from typing import Any
from urllib.parse import quote

import requests

from app.job_sources.base import JobSource


class JoobleJobSource(JobSource):
    """Fetch and normalize vacancies returned by the Jooble REST API."""

    def __init__(self):
        self.api_key = os.getenv("JOOBLE_API_KEY")
        # Set JOOBLE_BASE_URL for a country-specific Jooble domain when the
        # API key was created for that domain (for example, https://in.jooble.org/api).
        self.base_url = os.getenv("JOOBLE_BASE_URL", "https://jooble.org/api")

        if not self.api_key:
            raise RuntimeError("JOOBLE_API_KEY is not configured.")

    def search_jobs(
        self,
        keywords: str,
        location: str = "",
        page: int = 1,
        results_per_page: int = 20,
    ) -> list[dict[str, Any]]:
        url = f"{self.base_url.rstrip('/')}/{quote(self.api_key, safe='')}"
        payload = {
            "keywords": keywords,
            "location": location,
            "page": page,
            "ResultOnPage": results_per_page,
        }

        response = requests.post(
            url,
            json=payload,
            headers={"Accept": "application/json"},
            timeout=30,
        )
        response.raise_for_status()

        data = response.json()
        return [
            self._normalize_job(item)
            for item in data.get("jobs", [])
            if isinstance(item, dict)
        ]

    def _normalize_job(self, item: dict[str, Any]) -> dict[str, Any]:
        job_url = str(item.get("link") or "")
        external_id = str(item.get("id") or "")

        # Some listings do not provide an id.  A stable URL-based identifier
        # keeps those jobs deduplicated without dropping valid opportunities.
        if not external_id:
            external_id = hashlib.sha256(job_url.encode("utf-8")).hexdigest()

        return {
            "source": "jooble",
            "external_id": external_id,
            "title": str(item.get("title") or "").strip(),
            "company": str(item.get("company") or "").strip(),
            "location": str(item.get("location") or "").strip(),
            "description": str(item.get("snippet") or "").strip(),
            "skills": [],
            "experience_required": "",
            "employment_type": str(item.get("type") or "").strip(),
            "salary": str(item.get("salary") or "").strip(),
            "job_url": job_url,
            "posted_at": self._parse_datetime(item.get("updated")),
        }

    @staticmethod
    def _parse_datetime(value: Any) -> datetime | None:
        if not value:
            return None

        try:
            return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            return None
