import io
import json
import os
import zipfile

from sqlalchemy.orm import Session

from app.config import settings
from app.models import EquipmentCategory, EquipmentItem, ExternalLink, Hike, PointOfInterest
from app.services import apply_gpx, remove_gpx_file


def collect_hikes(db: Session) -> list[dict]:
    hikes = db.query(Hike).order_by(Hike.id).all()
    return [
        {
            "name": h.name,
            "description": h.description,
            "notes": h.notes,
            "difficulty": h.difficulty,
            "duration_hint": h.duration_hint,
            "activity_type": h.activity_type,
            "gpx_filename": h.gpx_filename,
            "created_at": h.created_at.isoformat() if h.created_at else None,
            "links": [{"platform": l.platform, "url": l.url, "label": l.label} for l in h.links],
            "pois": [{"lat": p.lat, "lon": p.lon, "name": p.name, "category": p.category} for p in h.pois],
        }
        for h in hikes
    ]


def collect_equipment(db: Session) -> dict:
    categories = db.query(EquipmentCategory).order_by(EquipmentCategory.position, EquipmentCategory.id).all()
    cat_index = {c.id: i for i, c in enumerate(categories)}
    items = (
        db.query(EquipmentItem)
        .order_by(EquipmentItem.category_id.is_(None).desc(), EquipmentItem.category_id, EquipmentItem.position, EquipmentItem.id)
        .all()
    )
    return {
        "categories": [{"name": c.name} for c in categories],
        "items": [
            {
                "name": i.name,
                "quantity": i.quantity,
                "checked": i.checked,
                "category_index": cat_index.get(i.category_id) if i.category_id is not None else None,
            }
            for i in items
        ],
    }


def build_backup_zip(db: Session) -> bytes:
    """hikes.json + equipment.json (matériel gardé séparé des parcours, deux
    domaines indépendants) + les GPX originaux, pour restauration à
    l'identique via restore_from_zip()."""
    hikes_data = collect_hikes(db)
    equipment_data = collect_equipment(db)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("hikes.json", json.dumps(hikes_data, ensure_ascii=False, indent=2))
        zf.writestr("equipment.json", json.dumps(equipment_data, ensure_ascii=False, indent=2))
        for h in hikes_data:
            fname = h.get("gpx_filename")
            if not fname:
                continue
            path = os.path.join(settings.uploads_dir, fname)
            if os.path.exists(path):
                zf.write(path, arcname=f"gpx/{fname}")
    return buf.getvalue()


def restore_from_zip(db: Session, zip_bytes: bytes) -> dict:
    """Remplace entièrement les randonnées et le matériel actuels par le
    contenu de l'archive (restauration complète, pas une fusion)."""
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        names = set(zf.namelist())
        if "hikes.json" not in names or "equipment.json" not in names:
            raise ValueError("Archive invalide : hikes.json / equipment.json manquant")
        hikes_data = json.loads(zf.read("hikes.json"))
        equipment_data = json.loads(zf.read("equipment.json"))

        for h in db.query(Hike).all():
            if h.gpx_filename:
                remove_gpx_file(h.gpx_filename)
        db.query(Hike).delete()
        db.query(EquipmentItem).delete()
        db.query(EquipmentCategory).delete()
        db.flush()

        categories = []
        for c in equipment_data.get("categories", []):
            cat = EquipmentCategory(name=c["name"], position=len(categories))
            db.add(cat)
            categories.append(cat)
        db.flush()

        for pos, item in enumerate(equipment_data.get("items", [])):
            idx = item.get("category_index")
            category_id = categories[idx].id if idx is not None and 0 <= idx < len(categories) else None
            db.add(
                EquipmentItem(
                    name=item["name"],
                    quantity=item.get("quantity", 1),
                    checked=item.get("checked", False),
                    position=pos,
                    category_id=category_id,
                )
            )

        imported = 0
        skipped = 0
        for h in hikes_data:
            hike = Hike(
                name=h["name"],
                description=h.get("description"),
                notes=h.get("notes"),
                difficulty=h.get("difficulty"),
                duration_hint=h.get("duration_hint"),
                activity_type=h.get("activity_type", "rando"),
            )
            gpx_name = h.get("gpx_filename")
            gpx_bytes = zf.read(f"gpx/{gpx_name}") if gpx_name and f"gpx/{gpx_name}" in names else None
            if not gpx_bytes:
                skipped += 1
                continue
            try:
                apply_gpx(hike, gpx_bytes)
            except Exception:
                skipped += 1
                continue
            hike.links = [
                ExternalLink(platform=l["platform"], url=l["url"], label=l.get("label")) for l in h.get("links", [])
            ]
            hike.pois = [
                PointOfInterest(lat=p["lat"], lon=p["lon"], name=p.get("name"), category=p["category"])
                for p in h.get("pois", [])
            ]
            db.add(hike)
            imported += 1

        db.commit()
        return {
            "hikes_imported": imported,
            "hikes_skipped": skipped,
            "equipment_items": len(equipment_data.get("items", [])),
        }
