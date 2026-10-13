from dotenv import load_dotenv
from app.routers.jobs import router as jobs_router

load_dotenv()
from app.routers.job_sources import router as job_sources_router
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.models.user import User
from app.models.candidate import Candidate
from app.models.job import Job
from app.routers.candidate_jobs import router as candidate_jobs_router

from app.routers.auth import router as auth_router
from app.routers.resume import router as resume_router
from app.routers.candidate import router as candidate_router
from app.routers.admin import router as admin_router
from app.routers.job_matching import router as job_matching_router
from app.routers.top_matches import router as top_matches_router


app = FastAPI(
    title="AI Job Hunter",
    description="AI-powered job discovery and matching platform",
    version="1.0.0",
)

Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(resume_router)
app.include_router(candidate_router)
app.include_router(admin_router)
app.include_router(jobs_router)
app.include_router(job_sources_router)
app.include_router(candidate_jobs_router)
app.include_router(job_matching_router)
app.include_router(top_matches_router)

@app.get("/")
def root():
    return {
        "message": "AI Job Hunter API is running"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }