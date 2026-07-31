import { useEffect, useState } from "react";
import { MapContainer, Marker, Polyline, Popup } from "react-leaflet";
import { Link } from "react-router-dom";
import { getHikes } from "../api";
import { BaseLayers } from "../components/IgnLayers";
import { HikeFilters } from "../components/HikeFilters";
import { useHikeFilters } from "../filters";
import { ACTIVITY_COLORS, ACTIVITY_LABELS } from "../activity";
import type { HikeSummary } from "../types";

export function MapPage() {
  const [hikes, setHikes] = useState<HikeSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const {
    filtered,
    activity,
    setActivity,
    minDistance,
    setMinDistance,
    maxDistance,
    setMaxDistance,
    distanceBoundMax,
  } = useHikeFilters(hikes);

  useEffect(() => {
    getHikes(true).then(setHikes).catch((e) => setError(e.message));
  }, []);

  const withCoords = filtered.filter((h) => h.start_lat != null && h.start_lon != null);

  return (
    <div>
      <p>
        {filtered.length} randonnée(s) affichée(s) sur {hikes.length}
        {error ? ` — erreur: ${error}` : ""}.
      </p>

      <HikeFilters
        activity={activity}
        setActivity={setActivity}
        minDistance={minDistance}
        setMinDistance={setMinDistance}
        maxDistance={maxDistance}
        setMaxDistance={setMaxDistance}
        distanceBoundMax={distanceBoundMax}
      />

      <MapContainer center={[46.6, 2.4]} zoom={6} style={{ height: "70vh", width: "100%" }}>
        <BaseLayers />
        {filtered.map((hike) => {
          const coords = hike.track_geojson?.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]);
          if (!coords || coords.length < 2) return null;
          return (
            <Polyline
              key={hike.id}
              positions={coords}
              pathOptions={{ color: ACTIVITY_COLORS[hike.activity_type], weight: 3 }}
            />
          );
        })}
        {withCoords.map((hike) => (
          <Marker key={hike.id} position={[hike.start_lat as number, hike.start_lon as number]}>
            <Popup>
              <strong>{hike.name}</strong> ({ACTIVITY_LABELS[hike.activity_type]})
              <br />
              {hike.distance_km != null && <>{hike.distance_km} km · </>}
              {hike.elevation_gain_m != null && <>+{Math.round(hike.elevation_gain_m)} m</>}
              <br />
              <Link to={`/hikes/${hike.id}`}>Voir le détail →</Link>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
