from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import analyze, solar, plans, geocode

app = FastAPI(
    title="TerraWatt API",
    description="Rooftop & land renewable energy planning backend",
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
app.include_router(plans.router, prefix="/api/plans", tags=["Plans"])
app.include_router(geocode.router, prefix="/api/geocode", tags=["Geocode"])


@app.get("/")
def root():
    return {"status": "ok", "service": "TerraWatt API"}
