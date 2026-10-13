import os
import time

from google import genai

from app.schemas.resume import CandidateProfile


client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY")
)


def analyze_resume(resume_text: str) -> CandidateProfile:

    prompt = f"""
You are an expert resume parser and career profile analyst.

Analyze the following resume and extract accurate information.

IMPORTANT RULES:

1. Only extract information that is actually present.
2. Do not invent experience, skills, education or projects.
3. If information is missing, return an empty string or empty list.
4. Normalize obvious variations of the same skill.
5. Identify realistic preferred job roles based on the candidate's
   education, experience, projects and skills.
6. Identify preferred locations only if they are mentioned or can
   reasonably be inferred from the resume.
7. Keep descriptions concise.

Return the information according to the provided CandidateProfile schema.

RESUME:

{resume_text}
"""

    max_attempts = 4

    for attempt in range(max_attempts):

        try:
            response = client.models.generate_content(
                model="gemini-3.6-flash",
                contents=prompt,
                config={
                    "response_mime_type": "application/json",
                    "response_schema": CandidateProfile,
                },
            )

            return CandidateProfile.model_validate_json(response.text)

        except Exception as error:

            error_text = str(error)

            # Retry temporary Gemini server/availability errors
            if "503" in error_text or "UNAVAILABLE" in error_text:

                if attempt < max_attempts - 1:
                    wait_time = 2 ** attempt

                    print(
                        f"Gemini temporarily unavailable. "
                        f"Retrying in {wait_time} seconds..."
                    )

                    time.sleep(wait_time)
                    continue

            raise error

    raise RuntimeError("Gemini analysis failed after multiple attempts.")