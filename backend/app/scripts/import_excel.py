"""Importe en masse des randonnées (nom + lien externe) depuis un fichier Excel.

Usage (depuis le conteneur backend):
    python -m app.scripts.import_excel /app/uploads/mon_fichier.xlsx

Colonnes attendues dans la feuille (insensible à la casse, variantes FR/EN
acceptées) : Nom/Name, URL/Lien/Link, Plateforme/Platform (optionnelle,
déduite du domaine sinon), Description (optionnelle).

Ce script ne fait qu'importer les liens ; les traces GPX et le détail de
chaque randonnée s'ajoutent ensuite manuellement via le site (page "Ajouter").
"""

import sys

import pandas as pd

from app.database import SessionLocal
from app.models import ExternalLink, Hike

COLUMN_ALIASES = {
    "name": ["nom", "name", "titre", "title"],
    "url": ["url", "lien", "link"],
    "platform": ["plateforme", "platform", "site"],
    "description": ["description", "desc"],
}


def _find_column(columns: list[str], aliases: list[str]) -> str | None:
    lowered = {c.lower().strip(): c for c in columns}
    for alias in aliases:
        if alias in lowered:
            return lowered[alias]
    return None


def _guess_platform(url: str) -> str:
    url_lower = url.lower()
    if "komoot" in url_lower:
        return "komoot"
    if "alltrails" in url_lower:
        return "alltrails"
    if "garmin" in url_lower:
        return "garmin"
    if "visorando" in url_lower:
        return "visorando"
    return "other"


def import_excel(path: str) -> None:
    df = pd.read_excel(path)
    columns = list(df.columns)

    name_col = _find_column(columns, COLUMN_ALIASES["name"])
    url_col = _find_column(columns, COLUMN_ALIASES["url"])
    platform_col = _find_column(columns, COLUMN_ALIASES["platform"])
    description_col = _find_column(columns, COLUMN_ALIASES["description"])

    if not name_col or not url_col:
        raise SystemExit(
            f"Colonnes 'Nom' et 'URL' introuvables. Colonnes détectées: {columns}"
        )

    db = SessionLocal()
    created = 0
    try:
        for _, row in df.iterrows():
            name = str(row[name_col]).strip()
            url = str(row[url_col]).strip()
            if not name or not url or name == "nan" or url == "nan":
                continue

            platform = str(row[platform_col]).strip() if platform_col and pd.notna(row.get(platform_col)) else _guess_platform(url)
            description = str(row[description_col]).strip() if description_col and pd.notna(row.get(description_col)) else None

            hike = Hike(name=name, description=description)
            hike.links = [ExternalLink(platform=platform, url=url)]
            db.add(hike)
            created += 1

        db.commit()
    finally:
        db.close()

    print(f"{created} randonnée(s) importée(s) depuis {path}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python -m app.scripts.import_excel <chemin_fichier.xlsx>")
    import_excel(sys.argv[1])
