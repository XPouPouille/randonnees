"""Importe en masse les randonnées du fichier Excel export "Recto Verso"
(lesothers.com / rectoverso.co).

Le fichier contient plusieurs feuilles ("Base", "Randonnées-France",
"Europe", ...) avec, dans les 12 premières colonnes de chaque ligne (les
en-têtes de la feuille "Randonnées-France" sont décalés dans le fichier
source, on ignore donc les en-têtes et on lit par position) :

    Type | région | ref | nom | durée | difficulté | type | distance | D+ | lien | départ | arrivé

Le lien peut être :
- un lien direct vers un fichier .gpx (feuille "Base") ;
- un lien court rectoverso.co/qr/... (autres feuilles) qui redirige vers une
  page contenant le lien .gpx réel — ce script suit ce lien et l'extrait de
  la page.

Pour chaque ligne, le GPX est téléchargé, parsé (distance/dénivelé/profil
calculés à partir de la trace réelle, comme un upload manuel), et une
randonnée + un lien externe (vers la page d'origine) sont créés. Les lignes
déjà importées (même URL source) sont ignorées.

Usage (depuis le conteneur backend) :
    python -m app.scripts.import_recto_verso "/app/uploads/Recto Verso.xlsx"
    python -m app.scripts.import_recto_verso "/app/uploads/Recto Verso.xlsx" --dry-run --limit 5
"""

import argparse
import os
import re
import sys
import time
import uuid

import pandas as pd
import requests

USER_AGENT = "randonnees-import/1.0 (+https://github.com/XPouPouille/randonnees)"
REQUEST_TIMEOUT = 15
REQUEST_DELAY_SECONDS = 0.4
GPX_URL_RE = re.compile(r"https?://[^\s\"'<>]+\.gpx")

# Colonnes utiles, dans l'ordre positionnel réel (indépendant des en-têtes).
COL_TYPE, COL_REGION, COL_REF, COL_NOM, COL_DUREE, COL_DIFFICULTE = 0, 1, 2, 3, 4, 5
COL_TYPE_PARCOURS, COL_DISTANCE, COL_DPLUS, COL_LIEN, COL_DEPART, COL_ARRIVEE = 6, 7, 8, 9, 10, 11


def _clean(value) -> str | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    text = str(value).strip()
    return text or None


def load_rows(xlsx_path: str) -> list[dict]:
    """Lit toutes les feuilles du classeur et retourne une liste de lignes normalisées."""
    sheets = pd.read_excel(xlsx_path, sheet_name=None, header=None)
    rows = []
    for sheet_name, df in sheets.items():
        if df.shape[1] <= COL_LIEN:
            continue
        for i in range(1, len(df)):  # ligne 0 = en-têtes
            raw = df.iloc[i]
            lien = _clean(raw[COL_LIEN])
            if not lien or not lien.lower().startswith("http"):
                continue
            rows.append(
                {
                    "sheet": sheet_name,
                    "type": _clean(raw[COL_TYPE]),
                    "region": _clean(raw[COL_REGION]),
                    "ref": _clean(raw[COL_REF]),
                    "nom": _clean(raw[COL_NOM]),
                    "difficulte": _clean(raw[COL_DIFFICULTE]),
                    "type_parcours": _clean(raw[COL_TYPE_PARCOURS]),
                    "lien": lien,
                    "depart": _clean(raw[COL_DEPART]),
                    "arrivee": _clean(raw[COL_ARRIVEE]),
                }
            )
    return rows


def resolve_gpx_url(session: requests.Session, url: str) -> str:
    """Retourne l'URL du fichier .gpx : directe si le lien y pointe déjà,
    sinon en suivant le lien court et en l'extrayant de la page cible."""
    if url.lower().endswith(".gpx"):
        return url
    resp = session.get(url, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    match = GPX_URL_RE.search(resp.text)
    if not match:
        raise ValueError(f"Aucun lien .gpx trouvé sur la page {url}")
    return match.group(0)


def build_description(row: dict) -> str | None:
    parts = []
    if row["region"]:
        parts.append(f"Région : {row['region']}")
    if row["type_parcours"]:
        parts.append(row["type_parcours"].capitalize())
    if row["difficulte"]:
        parts.append(f"Difficulté : {row['difficulte']}")
    if row["depart"] and row["arrivee"] and row["depart"] != row["arrivee"]:
        parts.append(f"Départ : {row['depart']} → Arrivée : {row['arrivee']}")
    elif row["depart"]:
        parts.append(f"Départ : {row['depart']}")
    return " · ".join(parts) if parts else None


def build_name(row: dict, gpx_name: str | None) -> str:
    name = row["nom"] or gpx_name or f"Randonnée {row['ref'] or row['lien']}"
    ref = row["ref"] or ""
    if ref.upper().startswith("V."):
        name = f"[Vélo] {name}"
    return name


def run(xlsx_path: str, dry_run: bool, limit: int | None) -> None:
    # Progrès visible même redirigé vers un fichier/pipe, et jamais planté par un
    # nom de rando contenant des caractères que la console locale ne sait pas afficher.
    sys.stdout.reconfigure(line_buffering=True, errors="backslashreplace")
    rows = load_rows(xlsx_path)
    if limit:
        rows = rows[:limit]
    print(f"{len(rows)} ligne(s) à traiter depuis {xlsx_path}")

    # Imports différés : évite de charger l'app/la config DB en mode --dry-run
    # (utile pour tester le téléchargement/parsing sans base de données).
    if not dry_run:
        from app.database import SessionLocal
        from app.models import ExternalLink, Hike

        db = SessionLocal()
    else:
        db = None

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    created = skipped = failed = 0

    try:
        for i, row in enumerate(rows, start=1):
            label = row["nom"] or row["ref"] or row["lien"]
            try:
                if db is not None:
                    from app.models import ExternalLink

                    already = db.query(ExternalLink).filter(ExternalLink.url == row["lien"]).first()
                    if already:
                        print(f"[{i}/{len(rows)}] SKIP (déjà importé) : {label}")
                        skipped += 1
                        continue

                gpx_url = resolve_gpx_url(session, row["lien"])
                gpx_resp = session.get(gpx_url, timeout=REQUEST_TIMEOUT)
                gpx_resp.raise_for_status()

                from app.gpx_utils import GpxParseError, parse_gpx

                parsed = parse_gpx(gpx_resp.content)
                name = build_name(row, parsed.get("name"))

                if dry_run:
                    print(
                        f"[{i}/{len(rows)}] OK (dry-run) : {name} — "
                        f"{parsed['distance_km']} km, +{parsed['elevation_gain_m']} m"
                    )
                    created += 1
                    continue

                from app.config import settings
                from app.models import ExternalLink, Hike

                stored_name = f"{uuid.uuid4().hex}.gpx"
                os.makedirs(settings.uploads_dir, exist_ok=True)
                with open(os.path.join(settings.uploads_dir, stored_name), "wb") as f:
                    f.write(gpx_resp.content)

                hike = Hike(
                    name=name,
                    description=build_description(row),
                    difficulty=row["difficulte"],
                    distance_km=parsed["distance_km"],
                    elevation_gain_m=parsed["elevation_gain_m"],
                    elevation_loss_m=parsed["elevation_loss_m"],
                    start_lat=parsed["start_lat"],
                    start_lon=parsed["start_lon"],
                    elevation_profile=parsed["elevation_profile"],
                    geom=parsed["wkt"],
                    gpx_filename=stored_name,
                )
                hike.links = [ExternalLink(platform="lesothers", url=row["lien"], label=row["ref"])]
                db.add(hike)
                db.commit()
                print(f"[{i}/{len(rows)}] OK : {name} — {parsed['distance_km']} km, +{parsed['elevation_gain_m']} m")
                created += 1

            except Exception as exc:  # noqa: BLE001
                if db is not None:
                    db.rollback()
                print(f"[{i}/{len(rows)}] ECHEC ({label}) : {exc}")
                failed += 1
            finally:
                time.sleep(REQUEST_DELAY_SECONDS)
    finally:
        if db is not None:
            db.close()

    print(f"\nTerminé : {created} importée(s), {skipped} déjà présente(s), {failed} échec(s).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("xlsx_path")
    parser.add_argument("--dry-run", action="store_true", help="Ne rien écrire en base, juste tester le téléchargement/parsing")
    parser.add_argument("--limit", type=int, default=None, help="Limiter aux N premières lignes (tests)")
    args = parser.parse_args()

    if not os.path.exists(args.xlsx_path):
        sys.exit(f"Fichier introuvable : {args.xlsx_path}")

    run(args.xlsx_path, dry_run=args.dry_run, limit=args.limit)
