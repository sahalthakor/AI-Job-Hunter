import os
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# unittest discovery may launch from outside the backend directory in desktop
# environments.  Make imports and the test database independent of the CWD.
BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from app.database import Base
from app.models.job import Job
from app.services.job_search_service import search_and_import_jobs


class FakeSource:
    def __init__(self, name, jobs=None, error=None):
        self.name = name
        self.jobs = jobs or []
        self.error = error

    def search_jobs(self, **_kwargs):
        if self.error:
            raise self.error
        return self.jobs


def job(source, external_id, title, company, location, url):
    return {
        "source": source,
        "external_id": external_id,
        "title": title,
        "company": company,
        "location": location,
        "description": "Description",
        "skills": [],
        "experience_required": "",
        "employment_type": "Full-time",
        "salary": "",
        "job_url": url,
        "posted_at": datetime.now(timezone.utc),
    }


class JobSearchServiceTests(unittest.TestCase):
    def setUp(self):
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        self.session = sessionmaker(bind=engine)()

    def tearDown(self):
        self.session.close()

    def test_searches_each_source_and_deduplicates_results(self):
        adzuna_job = job(
            "adzuna", "a-1", "Python Developer", "Acme", "Pune", "https://jobs.example/1"
        )
        duplicate_from_jooble = job(
            "jooble", "j-1", "Python Developer", "Acme", "Pune", "https://jobs.example/1"
        )
        jooble_job = job(
            "jooble", "j-2", "Backend Engineer", "Example", "Pune", "https://jobs.example/2"
        )
        sources = [
            ("adzuna", FakeSource("adzuna", [adzuna_job])),
            ("jooble", FakeSource("jooble", [duplicate_from_jooble, jooble_job])),
        ]

        with patch(
            "app.services.job_search_service.get_configured_job_sources",
            return_value=(sources, {}),
        ):
            result = search_and_import_jobs(
                self.session,
                keywords=["Python Developer", "Python Developer"],
                location="Pune",
            )

        self.assertEqual(result["keywords"], ["Python Developer"])
        self.assertEqual(result["saved"], 2)
        self.assertEqual(result["skipped"], 1)
        self.assertEqual(self.session.query(Job).count(), 2)
        self.assertEqual(result["source_results"]["jooble"]["saved"], 1)

    def test_provider_failure_does_not_stop_other_sources(self):
        adzuna_job = job(
            "adzuna", "a-1", "Python Developer", "Acme", "Pune", "https://jobs.example/1"
        )
        sources = [
            ("adzuna", FakeSource("adzuna", [adzuna_job])),
            ("jooble", FakeSource("jooble", error=TimeoutError("timed out"))),
        ]

        with patch(
            "app.services.job_search_service.get_configured_job_sources",
            return_value=(sources, {}),
        ):
            result = search_and_import_jobs(
                self.session,
                keywords=["Python Developer"],
            )

        self.assertEqual(result["saved"], 1)
        self.assertEqual(self.session.query(Job).count(), 1)
        self.assertEqual(
            result["source_results"]["jooble"]["errors"],
            ["Python Developer (page 1): TimeoutError"],
        )


if __name__ == "__main__":
    unittest.main()
