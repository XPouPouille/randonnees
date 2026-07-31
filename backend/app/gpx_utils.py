import gpxpy


class GpxParseError(ValueError):
    pass


def parse_gpx(raw_bytes: bytes) -> dict:
    """Parse un fichier GPX et retourne distance, dénivelé, profil et trace.

    Le profil topologique (distance cumulée / élévation) sert au graphique
    de dénivelé affiché sur la fiche détail d'une randonnée.
    """
    try:
        gpx = gpxpy.parse(raw_bytes.decode("utf-8"))
    except Exception as exc:  # noqa: BLE001
        raise GpxParseError(f"Fichier GPX invalide: {exc}") from exc

    points = []
    for track in gpx.tracks:
        for segment in track.segments:
            points.extend(segment.points)
    if not points and gpx.routes:
        for route in gpx.routes:
            points.extend(route.points)

    if len(points) < 2:
        raise GpxParseError("Le GPX ne contient pas assez de points pour former une trace")

    uphill, downhill = gpx.get_uphill_downhill()

    profile = []
    cumulative_km = 0.0
    prev = points[0]
    for point in points:
        if point is not prev:
            cumulative_km += (point.distance_3d(prev) or point.distance_2d(prev) or 0.0) / 1000
        profile.append(
            {
                "distance_km": round(cumulative_km, 3),
                "elevation_m": round(point.elevation or 0.0, 1),
                "lat": point.latitude,
                "lon": point.longitude,
            }
        )
        prev = point

    coordinates = [[p.longitude, p.latitude] for p in points]

    name = gpx.name
    if not name and gpx.tracks:
        name = gpx.tracks[0].name

    return {
        "name": name,
        "distance_km": round(cumulative_km, 2),
        "elevation_gain_m": round(uphill or 0.0, 1),
        "elevation_loss_m": round(downhill or 0.0, 1),
        "start_lat": points[0].latitude,
        "start_lon": points[0].longitude,
        "elevation_profile": profile,
        "track_geojson": {"type": "LineString", "coordinates": coordinates},
        "wkt": "LINESTRING(" + ", ".join(f"{lon} {lat}" for lon, lat in coordinates) + ")",
    }
