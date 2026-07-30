import os
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from geoalchemy2.shape import to_shape
from shapely.geometry import mapping
from sqlalchemy.orm import Session

from app.auth import require_admin
from app.config import settings
from app.database import get_db
from app.gpx_utils import GpxParseError, parse_gpx
from app.models import Hike
from app.schemas import HikeCreate, HikeOut, HikeSummary, HikeUpdate

router = APIRouter(prefix="/api/hikes", tags=["hikes"])


def _hike_to_out(hike: Hike) -> HikeOut:
    data = HikeOut.model_validate(hike, from_attributes=True).model_dump()
    if hike.geom is not None:
        data["track_geojson"] = mapping(to_shape(hike.geom))
    return HikeOut.model_validate(data)


@router.get("", response_model=list[HikeSummary])
def list_hikes(db: Session = Depends(get_db)):
    return db.query(Hike).order_by(Hike.name).all()


@router.get("/{hike_id}", response_model=HikeOut)
def get_hike(hike_id: int, db: Session = Depends(get_db)):
    hike = db.get(Hike, hike_id)
    if not hike:
        raise HTTPException(status_code=404, detail="Randonnée introuvable")
    return _hike_to_out(hike)


@router.post("", response_model=HikeOut, dependencies=[Depends(require_admin)])
async def create_hike(
    name: str = Form(...),
    description: str | None = Form(None),
    difficulty: str | None = Form(None),
    duration_hint: str | None = Form(None),
    gpx_file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    hike = Hike(name=name, description=description, difficulty=difficulty, duration_hint=duration_hint)
    if gpx_file is not None:
        _apply_gpx(hike, await gpx_file.read(), gpx_file.filename)
    db.add(hike)
    db.commit()
    db.refresh(hike)
    return _hike_to_out(hike)


@router.put("/{hike_id}", response_model=HikeOut, dependencies=[Depends(require_admin)])
def update_hike(hike_id: int, payload: HikeUpdate, db: Session = Depends(get_db)):
    hike = db.get(Hike, hike_id)
    if not hike:
        raise HTTPException(status_code=404, detail="Randonnée introuvable")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(hike, field, value)
    db.commit()
    db.refresh(hike)
    return _hike_to_out(hike)


@router.delete("/{hike_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_hike(hike_id: int, db: Session = Depends(get_db)):
    hike = db.get(Hike, hike_id)
    if not hike:
        raise HTTPException(status_code=404, detail="Randonnée introuvable")
    if hike.gpx_filename:
        _remove_gpx_file(hike.gpx_filename)
    db.delete(hike)
    db.commit()


@router.post("/{hike_id}/gpx", response_model=HikeOut, dependencies=[Depends(require_admin)])
async def upload_gpx(hike_id: int, gpx_file: UploadFile = File(...), db: Session = Depends(get_db)):
    hike = db.get(Hike, hike_id)
    if not hike:
        raise HTTPException(status_code=404, detail="Randonnée introuvable")
    if hike.gpx_filename:
        _remove_gpx_file(hike.gpx_filename)
    _apply_gpx(hike, await gpx_file.read(), gpx_file.filename)
    db.commit()
    db.refresh(hike)
    return _hike_to_out(hike)


def _apply_gpx(hike: Hike, raw_bytes: bytes, original_filename: str | None) -> None:
    try:
        parsed = parse_gpx(raw_bytes)
    except GpxParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    stored_name = f"{uuid.uuid4().hex}.gpx"
    os.makedirs(settings.uploads_dir, exist_ok=True)
    with open(os.path.join(settings.uploads_dir, stored_name), "wb") as f:
        f.write(raw_bytes)

    hike.distance_km = parsed["distance_km"]
    hike.elevation_gain_m = parsed["elevation_gain_m"]
    hike.elevation_loss_m = parsed["elevation_loss_m"]
    hike.start_lat = parsed["start_lat"]
    hike.start_lon = parsed["start_lon"]
    hike.elevation_profile = parsed["elevation_profile"]
    hike.geom = parsed["wkt"]
    hike.gpx_filename = stored_name


def _remove_gpx_file(stored_name: str) -> None:
    path = os.path.join(settings.uploads_dir, stored_name)
    if os.path.exists(path):
        os.remove(path)
