import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import create_db_and_tables
from .routers import tailor, resume, history, export, models_status

@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_db_and_tables()
    yield

app = FastAPI(title="ResumeForge API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tailor.router)
app.include_router(resume.router)
app.include_router(history.router)
app.include_router(export.router)
app.include_router(models_status.router)

@app.get("/health")
async def health():
    return {"status": "ok"}

# Serve built frontend (production / Docker)
dist_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(dist_path):
    app.mount("/", StaticFiles(directory=dist_path, html=True), name="static")
