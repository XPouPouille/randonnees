import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Polyline, Popup } from "react-leaflet";
import { Link } from "react-router-dom";
import { getHikes } from "../api";
import { BaseLayers } from "../components/IgnLayers";
import { ACTIVITY_COLORS, ACTIVITY_LABELS } from "../activity";
import type { ActivityType, HikeSummary } from "../types";

type Filter = "all" | ActivityType;

export function MapPage() {
  const [hikes, setHikes] = useState<HikeSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    getHikes().then(setHikes).catch((e) => setError(e.message));
  }, []);

  const filtered = useMemo(
    () => hikes.filter((h) => filter === "all" || h.activity_type === filter),
    [hikes, filter]
  );
  const withCoords = filtered.filter((h) => h.start_lat != null && h.start_lon != null);

  return (
    <div>
      <p>
        {filtered.length} randonnée(s) affichée(s) sur {hikes.length}
        {error ? ` — erreur: ${error}` : ""}.
      </p>

      <div style={{ marginBottom: 8 }}>
        <label style={{ marginRight: 12 }}>
          <input type="radio" checked={filter === "all"} onChange={() => setFilter("all")} /> Toutes
        </label>
        <label style={{ marginRight: 12 }}>
          <input type="radio" checked={filter === "rando"} onChange={() => setFilter("rando")} />{" "}
          <span style={{ color: ACTIVITY_COLORS.rando }}>■</span> {ACTIVITY_LABELS.rando}
        </label>
        <label>
          <input type="radio" checked={filter === "velo"} onChange={() => setFilter("velo")} />{" "}
          <span style={{ color: ACTIVITY_COLORS.velo }}>■</span> {ACTIVITY_LABELS.velo}
        </label>
      </div>

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
