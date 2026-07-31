import os
import uuid

import requests
from fastapi import HTTPException
from geoalchemy2.shape import to_shape
from shapely.geometry import mapping

from app.config import settings
from app.gpx_utils import GpxParseError, parse_gpx
from app.models import Hike
from app.schemas import HikeOut, HikeSummary

# Tolérance de simplification (degrés) appliquée à la trace pour la vue
# d'ensemble sur la carte liste : garde la forme visible sans envoyer chaque
# point GPS brut pour des centaines de randonnées à la fois.
LIST_SIMPLIFY_TOLERANCE = 0.0008

IGN_ELEVATION_URL = "https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json"
IGN_ITINERAIRE_URL = "https://data.geopf.fr/navigation/itineraire"

# Le service IGN n'a pas de profil vélo dédié : "car" (réseau routier) est la
# meilleure approximation disponible pour un itinéraire cyclo/VTT.
ROUTING_PROFILES = {"rando": "pedestrian", "velo": "car"}


def hike_to_out(hike: Hike) -> HikeOut:
    data = HikeOut.model_validate(hike, from_attributes=True).model_dump()
    if hike.geom is not None:
        data["track_geojson"] = mapping(to_shape(hike.geom))
    return HikeOut.model_validate(data)


def hike_to_summary(hike: Hike) -> HikeSummary:
    data = HikeSummary.model_validate(hike, from_attributes=True).model_dump()
    if hike.geom is not None:
        shape = to_shape(hike.geom).simplify(LIST_SIMPLIFY_TOLERANCE, preserve_topology=False)
        data["track_geojson"] = mapping(shape)
    return HikeSummary.model_validate(data)


def apply_gpx(hike: Hike, raw_bytes: bytes) -> None:
    try:
        parsed = parse_gpx(raw_bytes)
    except GpxParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    stored_name = f"{uuid.uuid4().hex}.gpx"
    os.makedirs(settings.uploads_dir, exist_ok=True)
    with open(os.path.join(settings.uploads_dir, stored_name), "wb") as f:
        f.write(raw_bytes)

    hike.distance_km = parsed["distance_km"]
    hike.elevation_gain_m = parsed["elevation_gain_m"]
    hike.elevation_loss_m = parsed["elevation_loss_m"]
    hike.start_lat = parsed["start_lat"]
    hike.start_lon = parsed["start_lon"]
    hike.elevation_profile = parsed["elevation_profile"]
    hike.geom = parsed["wkt"]
    hike.gpx_filename = stored_name


def remove_gpx_file(stored_name: str) -> None:
    path = os.path.join(settings.uploads_dir, stored_name)
    if os.path.exists(path):
        os.remove(path)


# Au-delà, l'URL GET (points encodés en paramètres) dépasse les limites de
# longueur de requête du service et renvoie une erreur 400 — un tracé routé
# en détail peut vite compter plusieurs centaines de points.
ELEVATION_BATCH_SIZE = 200


def fetch_elevations(points: list[tuple[float, float]]) -> list[float]:
    """Interroge le service altimétrique IGN (Géoplateforme, sans clé) pour une
    liste de points (lat, lon) et retourne l'altitude (m) dans le même ordre."""
    if not points:
        return []
    elevations: list[float] = []
    for i in range(0, len(points), ELEVATION_BATCH_SIZE):
        batch = points[i : i + ELEVATION_BATCH_SIZE]
        lon_str = "|".join(str(lon) for _, lon in batch)
        lat_str = "|".join(str(lat) for lat, _ in batch)
        resp = requests.get(
            IGN_ELEVATION_URL,
            params={"lon": lon_str, "lat": lat_str, "resource": "ign_rge_alti_wld", "indent": "false"},
            timeout=20,
        )
        resp.raise_for_status()
        elevations.extend(e["z"] for e in resp.json()["elevations"])
    return elevations


def fetch_route(points: list[tuple[float, float]], activity_type: str) -> list[tuple[float, float]]:
    """Calcule un itinéraire suivant le réseau IGN (BD TOPO, Géoplateforme,
    sans clé) reliant des points (lat, lon) successifs par les routes/chemins
    plutôt qu'à vol d'oiseau. Si le service échoue (zone non couverte,
    indisponibilité...), retourne les points tels quels : le tracé se rabat
    alors sur des segments en ligne droite plutôt que de bloquer l'utilisateur.
    """
    if len(points) < 2:
        return points

    profile = ROUTING_PROFILES.get(activity_type, "pedestrian")
    start_lat, start_lon = points[0]
    end_lat, end_lon = points[-1]
    params = {
        "resource": "bdtopo-osrm",
        "profile": profile,
        "optimization": "fastest",
        "start": f"{start_lon},{start_lat}",
        "end": f"{end_lon},{end_lat}",
        "geometryFormat": "geojson",
        "crs": "EPSG:4326",
    }
    if len(points) > 2:
        params["intermediates"] = "|".join(f"{lon},{lat}" for lat, lon in points[1:-1])

    try:
        resp = requests.get(IGN_ITINERAIRE_URL, params=params, timeout=20)
        resp.raise_for_status()
        coords = resp.json()["geometry"]["coordinates"]
        return [(lat, lon) for lon, lat in coords]
    except (requests.RequestException, KeyError, ValueError, TypeError):
        return points
