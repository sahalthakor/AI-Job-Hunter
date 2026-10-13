# AI Job Hunter backend

## What it does

1. Authenticated users upload a PDF, DOCX, or DOC résumé (maximum 10 MB).
2. The application extracts its text, uses Gemini to draft a structured candidate profile, and lets the user review it.
3. Saving the profile starts a search across every configured job provider. Listings are normalized, merged, deduplicated, and then ranked against the candidate profile.

## Setup

Copy `.env.example` to `.env` and set the required database, JWT, Gemini, and job-provider credentials. Start the API from this directory:

```powershell
.\venv_new\Scripts\python.exe -m uvicorn app.main:app --reload
```

The frontend development server is expected at `http://127.0.0.1:5173`.

## Job providers

Adzuna is enabled with `ADZUNA_APP_ID` and `ADZUNA_APP_KEY`. Jooble is optional and becomes part of every candidate search when `JOOBLE_API_KEY` is present. If a provider is unavailable, remaining configured providers still return results. Inspect provider readiness without exposing credentials at `GET /job-sources`.

To use a country-specific Jooble key, set `JOOBLE_BASE_URL` to that country domain's `/api` endpoint (for example, `https://in.jooble.org/api`).

## Verification

```powershell
.\venv_new\Scripts\python.exe -m unittest discover -s tests -v
```
