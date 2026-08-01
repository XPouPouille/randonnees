from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import EquipmentItem
from app.schemas import EquipmentItemCreate, EquipmentItemOut, EquipmentItemUpdate

# Pas de token admin ici (à la demande explicite) : liste de matériel perso,
# librement modifiable par quiconque accède au site.
router = APIRouter(prefix="/api/equipment", tags=["equipment"])


@router.get("", response_model=list[EquipmentItemOut])
def list_equipment(db: Session = Depends(get_db)):
    return db.query(EquipmentItem).order_by(EquipmentItem.id).all()


@router.post("", response_model=EquipmentItemOut)
def create_equipment(payload: EquipmentItemCreate, db: Session = Depends(get_db)):
    item = EquipmentItem(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/{item_id}", response_model=EquipmentItemOut)
def update_equipment(item_id: int, payload: EquipmentItemUpdate, db: Session = Depends(get_db)):
    item = db.get(EquipmentItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item introuvable")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
def delete_equipment(item_id: int, db: Session = Depends(get_db)):
    item = db.get(EquipmentItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item introuvable")
    db.delete(item)
    db.commit()
