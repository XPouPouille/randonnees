from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import EquipmentCategory, EquipmentItem
from app.schemas import (
    EquipmentCategoryCreate,
    EquipmentCategoryOut,
    EquipmentCategoryReorderRequest,
    EquipmentCategoryUpdate,
    EquipmentItemCreate,
    EquipmentItemOut,
    EquipmentItemUpdate,
    EquipmentReorderRequest,
)

# Pas de token admin ici (à la demande explicite) : liste de matériel perso,
# librement modifiable par quiconque accède au site.
router = APIRouter(prefix="/api/equipment", tags=["equipment"])


def _next_position_in_category(db: Session, category_id: int | None) -> int:
    max_position = (
        db.query(func.max(EquipmentItem.position))
        .filter(EquipmentItem.category_id == category_id)
        .scalar()
    )
    return 0 if max_position is None else max_position + 1


# --- Catégories ---
# Déclarées avant "/{item_id}" des items : chemins distincts sous /categories
# donc pas d'ambiguïté de routage ici (contrairement à /reorder plus bas).


@router.get("/categories", response_model=list[EquipmentCategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.query(EquipmentCategory).order_by(EquipmentCategory.position, EquipmentCategory.id).all()


@router.post("/categories", response_model=EquipmentCategoryOut)
def create_category(payload: EquipmentCategoryCreate, db: Session = Depends(get_db)):
    max_position = db.query(func.max(EquipmentCategory.position)).scalar() or 0
    category = EquipmentCategory(name=payload.name, position=max_position + 1)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.put("/categories/reorder", response_model=list[EquipmentCategoryOut])
def reorder_categories(payload: EquipmentCategoryReorderRequest, db: Session = Depends(get_db)):
    all_categories = db.query(EquipmentCategory).order_by(EquipmentCategory.position, EquipmentCategory.id).all()
    by_id = {c.id: c for c in all_categories}
    ordered_ids = [i for i in payload.ids if i in by_id]
    remaining_ids = [c.id for c in all_categories if c.id not in set(ordered_ids)]
    for position, cat_id in enumerate(ordered_ids + remaining_ids):
        by_id[cat_id].position = position
    db.commit()
    return db.query(EquipmentCategory).order_by(EquipmentCategory.position, EquipmentCategory.id).all()


@router.put("/categories/{category_id}", response_model=EquipmentCategoryOut)
def update_category(category_id: int, payload: EquipmentCategoryUpdate, db: Session = Depends(get_db)):
    category = db.get(EquipmentCategory, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Catégorie introuvable")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    db.commit()
    db.refresh(category)
    return category


@router.delete("/categories/{category_id}", status_code=204)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    category = db.get(EquipmentCategory, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Catégorie introuvable")
    db.delete(category)  # les items liés repassent en category_id NULL (ondelete SET NULL)
    db.commit()


# --- Items ---


@router.get("", response_model=list[EquipmentItemOut])
def list_equipment(db: Session = Depends(get_db)):
    return (
        db.query(EquipmentItem)
        .order_by(EquipmentItem.category_id.is_(None).desc(), EquipmentItem.category_id, EquipmentItem.position, EquipmentItem.id)
        .all()
    )


@router.post("", response_model=EquipmentItemOut)
def create_equipment(payload: EquipmentItemCreate, db: Session = Depends(get_db)):
    position = _next_position_in_category(db, payload.category_id)
    item = EquipmentItem(**payload.model_dump(), position=position)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


# Doit être déclarée avant "/{item_id}" : sinon FastAPI tente de convertir
# "reorder" en int pour item_id et renvoie 422 avant d'atteindre cette route.
@router.put("/reorder", response_model=list[EquipmentItemOut])
def reorder_equipment(payload: EquipmentReorderRequest, db: Session = Depends(get_db)):
    # Toujours réassigner une position unique et contiguë à TOUS les items de
    # cette catégorie (pas seulement ceux listés) : si la liste envoyée est
    # incomplète, les items omis sont ajoutés à la suite plutôt que de risquer
    # une collision de position.
    bucket = (
        db.query(EquipmentItem)
        .filter(EquipmentItem.category_id == payload.category_id)
        .order_by(EquipmentItem.position, EquipmentItem.id)
        .all()
    )
    by_id = {item.id: item for item in bucket}
    ordered_ids = [i for i in payload.ids if i in by_id]
    remaining_ids = [item.id for item in bucket if item.id not in set(ordered_ids)]
    for position, item_id in enumerate(ordered_ids + remaining_ids):
        by_id[item_id].position = position
    db.commit()
    return (
        db.query(EquipmentItem)
        .order_by(EquipmentItem.category_id.is_(None).desc(), EquipmentItem.category_id, EquipmentItem.position, EquipmentItem.id)
        .all()
    )


@router.put("/{item_id}", response_model=EquipmentItemOut)
def update_equipment(item_id: int, payload: EquipmentItemUpdate, db: Session = Depends(get_db)):
    item = db.get(EquipmentItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item introuvable")
    data = payload.model_dump(exclude_unset=True)
    if "category_id" in data and data["category_id"] != item.category_id:
        data["position"] = _next_position_in_category(db, data["category_id"])
    for field, value in data.items():
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
