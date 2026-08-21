from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import ExternalLink, Hike
from app.schemas import ExternalLinkCreate, ExternalLinkOut

router = APIRouter(tags=["links"], dependencies=[Depends(get_current_user)])


@router.post("/api/hikes/{hike_id}/links", response_model=ExternalLinkOut)
def add_link(hike_id: int, payload: ExternalLinkCreate, db: Session = Depends(get_db)):
    hike = db.get(Hike, hike_id)
    if not hike:
        raise HTTPException(status_code=404, detail="Randonnée introuvable")
    link = ExternalLink(hike_id=hike_id, **payload.model_dump())
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


@router.delete("/api/links/{link_id}", status_code=204)
def delete_link(link_id: int, db: Session = Depends(get_db)):
    link = db.get(ExternalLink, link_id)
    if not link:
        raise HTTPException(status_code=404, detail="Lien introuvable")
    db.delete(link)
    db.commit()
