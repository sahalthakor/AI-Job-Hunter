import os

from google import genai

from app.models.candidate import Candidate
from app.models.job import Job
from app.schemas.job_match import JobMatchResult


client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY")
)


def match_job_to_candidate(
    candidate: Candidate,
    job: Job,
) -> JobMatchResult:

    candidate_profile = {
        "name": candidate.name or "",
        "headline": candidate.headline or "",
        "skills": candidate.skills or [],
        "education": candidate.education or [],
        "experience": candidate.experience or [],
        "projects": candidate.projects or [],
        "certifications": candidate.certifications or [],
        "preferred_roles": candidate.preferred_roles or [],
        "preferred_locations": candidate.preferred_locations or [],
    }

    job_data = {
        "title": job.title or "",
        "company": job.company or "",
        "location": job.location or "",
        "description": job.description or "",
        "skills": job.skills or [],
        "experience_required": job.experience_required or "",
        "employment_type": job.employment_type or "",
        "salary": job.salary or "",
    }

    prompt = f"""
You are an expert AI job-matching engine.

Compare the candidate profile with the job.

Return ONLY valid JSON matching the provided JobMatchResult schema.

Rules:

1. Match score must be between 0 and 100.
2. Do not invent candidate skills or experience.
3. Consider skills, education, experience, projects,
   preferred roles and location.
4. Identify skills that clearly match.
5. Identify important job requirements that are missing.
6. Give concise reasons for the score.
7. Give a practical recommendation.
8. Be conservative. Do not give a high score just because
   the job title looks similar.

CANDIDATE PROFILE:

{candidate_profile}

JOB:

{job_data}
"""

    response = client.models.generate_content(
        model="gemini-3.6-flash",
        contents=prompt,
        config={
            "response_mime_type": "application/json",
            "response_schema": JobMatchResult,
        },
    )

    return JobMatchResult.model_validate_json(
        response.text
    )