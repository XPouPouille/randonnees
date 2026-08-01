from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import EquipmentItem
from app.schemas import EquipmentItemCreate, EquipmentItemOut, EquipmentItemUpdate, EquipmentReorderRequest

# Pas de token admin ici (à la demande explicite) : liste de matériel perso,
# librement modifiable par quiconque accède au site.
router = APIRouter(prefix="/api/equipment", tags=["equipment"])


@router.get("", response_model=list[EquipmentItemOut])
def list_equipment(db: Session = Depends(get_db)):
    return db.query(EquipmentItem).order_by(EquipmentItem.position, EquipmentItem.id).all()


@router.post("", response_model=EquipmentItemOut)
def create_equipment(payload: EquipmentItemCreate, db: Session = Depends(get_db)):
    max_position = db.query(func.max(EquipmentItem.position)).scalar() or 0
    item = EquipmentItem(**payload.model_dump(), position=max_position + 1)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


# Doit être déclarée avant "/{item_id}" : sinon FastAPI tente de convertir
# "reorder" en int pour item_id et renvoie 422 avant d'atteindre cette route.
@router.put("/reorder", response_model=list[EquipmentItemOut])
def reorder_equipment(payload: EquipmentReorderRequest, db: Session = Depends(get_db)):
    # Toujours réassigner une position unique et contiguë à TOUS les items,
    # pas seulement ceux listés : si la liste envoyée est incomplète (item
    # ajouté entre-temps par un autre onglet, requête partielle...), les
    # items omis sont simplement ajoutés à la suite plutôt que de risquer
    # une collision de position avec ceux qu'on vient de réordonner.
    all_items = db.query(EquipmentItem).order_by(EquipmentItem.position, EquipmentItem.id).all()
    by_id = {item.id: item for item in all_items}
    ordered_ids = [i for i in payload.ids if i in by_id]
    remaining_ids = [item.id for item in all_items if item.id not in set(ordered_ids)]
    for position, item_id in enumerate(ordered_ids + remaining_ids):
        by_id[item_id].position = position
    db.commit()
    return db.query(EquipmentItem).order_by(EquipmentItem.position, EquipmentItem.id).all()


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
