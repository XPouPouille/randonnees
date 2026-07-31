import requests
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import require_admin
from app.database import get_db
from app.gpx_utils import build_gpx_bytes
from app.models import Hike
from app.schemas import (
    DrawHikeCreate,
    ElevationPointOut,
    ElevationRequest,
    HikeOut,
    LatLon,
    PoiOut,
    PoiRequest,
    RouteRequest,
)
from app.services import apply_gpx, fetch_elevations, fetch_poi, fetch_route, hike_to_out

router = APIRouter(prefix="/api", tags=["editor"])

MAX_POINTS = 2000


@router.post("/elevation", response_model=list[ElevationPointOut])
def get_elevation(payload: ElevationRequest):
    if len(payload.points) > MAX_POINTS:
        raise HTTPException(status_code=422, detail=f"Trop de points (max {MAX_POINTS})")
    if not payload.points:
        return []
    try:
        elevations = fetch_elevations([(p.lat, p.lon) for p in payload.points])
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Service altimétrie IGN indisponible : {exc}") from exc
    return [
        ElevationPointOut(lat=p.lat, lon=p.lon, elevation_m=e) for p, e in zip(payload.points, elevations)
    ]


@router.post("/route", response_model=list[LatLon])
def get_route(payload: RouteRequest):
    if len(payload.points) > MAX_POINTS:
        raise HTTPException(status_code=422, detail=f"Trop de points (max {MAX_POINTS})")
    if len(payload.points) < 2:
        return payload.points
    routed = fetch_route([(p.lat, p.lon) for p in payload.points], payload.activity_type)
    return [LatLon(lat=lat, lon=lon) for lat, lon in routed]


@router.post("/poi", response_model=list[PoiOut])
def get_poi(payload: PoiRequest):
    if len(payload.points) > MAX_POINTS:
        raise HTTPException(status_code=422, detail=f"Trop de points (max {MAX_POINTS})")
    try:
        results = fetch_poi([(p.lat, p.lon) for p in payload.points], payload.radius_m, payload.categories)
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Service OpenStreetMap indisponible : {exc}") from exc
    return [PoiOut(**r) for r in results]


@router.post("/hikes/draw", response_model=HikeOut, dependencies=[Depends(require_admin)])
def create_drawn_hike(payload: DrawHikeCreate, db: Session = Depends(get_db)):
    if len(payload.points) < 2:
        raise HTTPException(status_code=422, detail="Il faut au moins 2 points pour former un tracé")
    if len(payload.points) > MAX_POINTS:
        raise HTTPException(status_code=422, detail=f"Trop de points (max {MAX_POINTS})")

    # Le tracé enregistré suit toujours le réseau IGN (routes/chemins), jamais
    # les segments à vol d'oiseau entre les points cliqués par l'utilisateur.
    routed = fetch_route([(p.lat, p.lon) for p in payload.points], payload.activity_type)
    if len(routed) > MAX_POINTS:
        raise HTTPException(status_code=422, detail="Itinéraire calculé trop détaillé, réduisez le nombre de points")

    try:
        elevations = fetch_elevations(routed)
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Service altimétrie IGN indisponible : {exc}") from exc

    gpx_bytes = build_gpx_bytes(
        payload.name,
        [{"lat": lat, "lon": lon, "elevation_m": e} for (lat, lon), e in zip(routed, elevations)],
        waypoints=[p.model_dump() for p in payload.pois],
    )

    hike = Hike(
        name=payload.name,
        activity_type=payload.activity_type,
        difficulty=payload.difficulty,
        duration_hint=payload.duration_hint,
        description=payload.description,
    )
    apply_gpx(hike, gpx_bytes)
    db.add(hike)
    db.commit()
    db.refresh(hike)
    return hike_to_out(hike)
