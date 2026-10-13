import os
from datetime import datetime
from typing import Any

import requests

from app.job_sources.base import JobSource


class AdzunaJobSource(JobSource):

    BASE_URL = "https://api.adzuna.com/v1/api"

    def __init__(self):
        self.app_id = os.getenv("ADZUNA_APP_ID")
        self.app_key = os.getenv("ADZUNA_APP_KEY")
        self.country = os.getenv("ADZUNA_COUNTRY", "in")

        if not self.app_id:
            raise RuntimeError("ADZUNA_APP_ID is not configured.")

        if not self.app_key:
            raise RuntimeError("ADZUNA_APP_KEY is not configured.")

    def search_jobs(
        self,
        keywords: str,
        location: str = "",
        page: int = 1,
        results_per_page: int = 20,
    ) -> list[dict[str, Any]]:

        url = (
            f"{self.BASE_URL}/jobs/"
            f"{self.country}/search/{page}"
        )

        params = {
            "app_id": self.app_id,
            "app_key": self.app_key,
            "results_per_page": results_per_page,
            "what": keywords,
            "content-type": "application/json",
        }

        if location:
            params["where"] = location

        response = requests.get(
            url,
            params=params,
            headers={"Accept": "application/json"},
            timeout=30,
        )

        response.raise_for_status()

        data = response.json()

        results = data.get("results", [])

        normalized_jobs = []

        for item in results:
            normalized_jobs.append(
                self._normalize_job(item)
            )

        return normalized_jobs

    def _normalize_job(self, item: dict[str, Any]) -> dict[str, Any]:

        location_data = item.get("location") or {}

        area = location_data.get("area") or []

        location = location_data.get("display_name") or ""

        if not location and area:
            location = ", ".join(
                str(value)
                for value in area
                if value
            )

        description = item.get("description") or ""

        salary = ""

        salary_min = item.get("salary_min")
        salary_max = item.get("salary_max")

        if salary_min is not None and salary_max is not None:
            salary = f"{salary_min} - {salary_max}"
        elif salary_min is not None:
            salary = f"From {salary_min}"
        elif salary_max is not None:
            salary = f"Up to {salary_max}"

        posted_at = self._parse_datetime(
            item.get("created")
        )

        return {
            "source": "adzuna",

            "external_id": str(
                item.get("id") or ""
            ),

            "title": item.get("title") or "",

            "company": (
                item.get("company", {}).get("display_name")
                or ""
            ),

            "location": location,

            "description": description,

            "skills": [],

            "experience_required": "",

            "employment_type": "",

            "salary": salary,

            "job_url": item.get("redirect_url") or "",

            "posted_at": posted_at,
        }

    @staticmethod
    def _parse_datetime(value: Any):

        if not value:
            return None

        if isinstance(value, datetime):
            return value

        try:
            return datetime.fromisoformat(
                str(value).replace("Z", "+00:00")
            )
        except ValueError:
            return None