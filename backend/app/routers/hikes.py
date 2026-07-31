from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session, defer

from app.auth import require_admin
from app.database import get_db
from app.models import Hike
from app.schemas import HikeOut, HikeSummary, HikeUpdate
from app.services import apply_gpx, hike_to_out, hike_to_summary, remove_gpx_file

router = APIRouter(prefix="/api/hikes", tags=["hikes"])


@router.get("", response_model=list[HikeSummary])
def list_hikes(include_track: bool = False, db: Session = Depends(get_db)):
    # HikeSummary n'expose jamais elevation_profile (mesuré : 77 Mo cumulés
    # pour ~300 randonnées, jusqu'à 1.5 Mo pour une seule) : le déférer évite
    # de le charger/désérialiser depuis Postgres pour rien à chaque appel.
    query = db.query(Hike).order_by(Hike.name).options(defer(Hike.elevation_profile))
    if not include_track:
        # Idem pour la géométrie quand l'appelant ne l'affiche pas (page Liste).
        query = query.options(defer(Hike.geom))
    hikes = query.all()
    return [hike_to_summary(h, include_track=include_track) for h in hikes]


@router.get("/{hike_id}", response_model=HikeOut)
def get_hike(hike_id: int, db: Session = Depends(get_db)):
    hike = db.get(Hike, hike_id)
    if not hike:
        raise HTTPException(status_code=404, detail="Randonnée introuvable")
    return hike_to_out(hike)


@router.post("", response_model=HikeOut, dependencies=[Depends(require_admin)])
async def create_hike(
    name: str = Form(...),
    description: str | None = Form(None),
    difficulty: str | None = Form(None),
    duration_hint: str | None = Form(None),
    activity_type: str = Form("rando"),
    gpx_file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    hike = Hike(
        name=name,
        description=description,
        difficulty=difficulty,
        duration_hint=duration_hint,
        activity_type=activity_type,
    )
    if gpx_file is not None:
        apply_gpx(hike, await gpx_file.read())
    db.add(hike)
    db.commit()
    db.refresh(hike)
    return hike_to_out(hike)


@router.put("/{hike_id}", response_model=HikeOut, dependencies=[Depends(require_admin)])
def update_hike(hike_id: int, payload: HikeUpdate, db: Session = Depends(get_db)):
    hike = db.get(Hike, hike_id)
    if not hike:
        raise HTTPException(status_code=404, detail="Randonnée introuvable")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(hike, field, value)
    db.commit()
    db.refresh(hike)
    return hike_to_out(hike)


@router.delete("/{hike_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_hike(hike_id: int, db: Session = Depends(get_db)):
    hike = db.get(Hike, hike_id)
    if not hike:
        raise HTTPException(status_code=404, detail="Randonnée introuvable")
    if hike.gpx_filename:
        remove_gpx_file(hike.gpx_filename)
    db.delete(hike)
    db.commit()


@router.post("/{hike_id}/gpx", response_model=HikeOut, dependencies=[Depends(require_admin)])
async def upload_gpx(hike_id: int, gpx_file: UploadFile = File(...), db: Session = Depends(get_db)):
    hike = db.get(Hike, hike_id)
    if not hike:
        raise HTTPException(status_code=404, detail="Randonnée introuvable")
    if hike.gpx_filename:
        remove_gpx_file(hike.gpx_filename)
    apply_gpx(hike, await gpx_file.read())
    db.commit()
    db.refresh(hike)
    return hike_to_out(hike)
