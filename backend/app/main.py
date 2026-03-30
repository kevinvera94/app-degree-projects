from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import (
    academic_programs,
    act,
    auth,
    date_windows,
    evaluations,
    jurors,
    modalities,
    projects,
    reports,
    submissions,
    sustentation,
    users,
)

app = FastAPI(
    title="USC App Degree Projects API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(academic_programs.router, prefix="/api/v1")
app.include_router(modalities.router, prefix="/api/v1")
app.include_router(date_windows.router, prefix="/api/v1")
app.include_router(projects.router, prefix="/api/v1")
app.include_router(submissions.router, prefix="/api/v1")
app.include_router(jurors.router, prefix="/api/v1")
app.include_router(evaluations.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(sustentation.router, prefix="/api/v1")
app.include_router(act.router, prefix="/api/v1")


@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok"}
