"""
Canopy API — AI rooftop transformation platform for Atlanta building owners.
"""

from dotenv import load_dotenv

load_dotenv()  # read backend/.env before services import their keys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import analyze, solar, geocode

app = FastAPI(
    title="Canopy API",
    description="AI-powered rooftop transformation recommendations for Atlanta",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze.router, prefix="/api/analyze", tags=["Analysis"])
app.include_router(solar.router, prefix="/api/solar", tags=["Solar"])
app.include_router(geocode.router, prefix="/api/geocode", tags=["Geocode"])


@app.get("/")
def root():
    return {"status": "ok", "service": "Canopy API"}
