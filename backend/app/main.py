from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.routers import hikes, links

app = FastAPI(title="Randonnées API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(hikes.router)
app.include_router(links.router)
app.mount("/uploads", StaticFiles(directory=settings.uploads_dir, check_dir=False), name="uploads")


@app.get("/api/health")
def health():
    return {"status": "ok"}
