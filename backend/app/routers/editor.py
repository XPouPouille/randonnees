import requests
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import require_admin
from app.database import get_db
from app.gpx_utils import build_gpx_bytes
from app.models import Hike, PointOfInterest
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

# Nombre de points cliqués/envoyés manuellement par l'utilisateur (waypoints
# d'un tracé, jamais des milliers en pratique).
MAX_WAYPOINTS = 2000

# Un tracé une fois routé sur le réseau IGN (une dizaine de clics peut suffire
# à générer un itinéraire de plusieurs dizaines de km) compte facilement
# plusieurs milliers de points de géométrie détaillée - déjà géré ailleurs
# dans l'appli pour de vraies randonnées importées (jusqu'à plusieurs
# milliers de points GPX). Une limite bien plus généreuse ici évite de
# bloquer un aperçu dénivelé/POI ou un enregistrement légitimes.
MAX_ROUTE_POINTS = 20000


@router.post("/elevation", response_model=list[ElevationPointOut])
def get_elevation(payload: ElevationRequest):
    if len(payload.points) > MAX_ROUTE_POINTS:
        raise HTTPException(status_code=422, detail=f"Trop de points (max {MAX_ROUTE_POINTS})")
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
    if len(payload.points) > MAX_WAYPOINTS:
        raise HTTPException(status_code=422, detail=f"Trop de points (max {MAX_WAYPOINTS})")
    if len(payload.points) < 2:
        return payload.points
    routed = fetch_route([(p.lat, p.lon) for p in payload.points], payload.activity_type)
    return [LatLon(lat=lat, lon=lon) for lat, lon in routed]


@router.post("/poi", response_model=list[PoiOut])
def get_poi(payload: PoiRequest):
    # fetch_poi sous-échantillonne déjà en interne avant d'interroger
    # Overpass : pas besoin de refuser une trace routée dense en amont.
    if len(payload.points) > MAX_ROUTE_POINTS:
        raise HTTPException(status_code=422, detail=f"Trop de points (max {MAX_ROUTE_POINTS})")
    try:
        results = fetch_poi([(p.lat, p.lon) for p in payload.points], payload.radius_m, payload.categories)
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Service OpenStreetMap indisponible : {exc}") from exc
    return [PoiOut(**r) for r in results]


@router.post("/hikes/draw", response_model=HikeOut, dependencies=[Depends(require_admin)])
def create_drawn_hike(payload: DrawHikeCreate, db: Session = Depends(get_db)):
    if len(payload.points) < 2:
        raise HTTPException(status_code=422, detail="Il faut au moins 2 points pour former un tracé")
    if len(payload.points) > MAX_WAYPOINTS:
        raise HTTPException(status_code=422, detail=f"Trop de points (max {MAX_WAYPOINTS})")

    # Le tracé enregistré suit toujours le réseau IGN (routes/chemins), jamais
    # les segments à vol d'oiseau entre les points cliqués par l'utilisateur.
    routed = fetch_route([(p.lat, p.lon) for p in payload.points], payload.activity_type)
    if len(routed) > MAX_ROUTE_POINTS:
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
    hike.pois = [
        PointOfInterest(lat=p.lat, lon=p.lon, name=p.name, category=p.category) for p in payload.pois
    ]
    db.add(hike)
    db.commit()
    db.refresh(hike)
    return hike_to_out(hike)


@router.post("/hikes/{hike_id}/pois", response_model=HikeOut, dependencies=[Depends(require_admin)])
def add_pois(hike_id: int, payload: list[PoiOut], db: Session = Depends(get_db)):
    hike = db.get(Hike, hike_id)
    if not hike:
        raise HTTPException(status_code=404, detail="Randonnée introuvable")
    existing = {(p.lat, p.lon, p.category) for p in hike.pois}
    for poi in payload:
        key = (poi.lat, poi.lon, poi.category)
        if key in existing:
            continue
        hike.pois.append(PointOfInterest(lat=poi.lat, lon=poi.lon, name=poi.name, category=poi.category))
        existing.add(key)
    db.commit()
    db.refresh(hike)
    return hike_to_out(hike)


@router.delete("/pois/{poi_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_poi(poi_id: int, db: Session = Depends(get_db)):
    poi = db.get(PointOfInterest, poi_id)
    if not poi:
        raise HTTPException(status_code=404, detail="Point d'intérêt introuvable")
    db.delete(poi)
    db.commit()
