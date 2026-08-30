import zipfile
from datetime import date

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.backup import build_backup_zip, restore_from_zip
from app.database import get_db

router = APIRouter(prefix="/api/backup", tags=["backup"], dependencies=[Depends(get_current_user)])


@router.get("/export")
def export_backup(db: Session = Depends(get_db)):
    content = build_backup_zip(db)
    filename = f"randonnees-backup-{date.today().isoformat()}.zip"
    return Response(
        content=content,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/import")
async def import_backup(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        return restore_from_zip(db, await file.read())
    except (ValueError, KeyError, zipfile.BadZipFile) as exc:
        raise HTTPException(status_code=422, detail=f"Sauvegarde invalide : {exc}") from exc
