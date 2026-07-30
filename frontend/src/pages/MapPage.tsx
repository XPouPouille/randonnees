import { useEffect, useState } from "react";
import { MapContainer, Marker, Popup } from "react-leaflet";
import { Link } from "react-router-dom";
import { getHikes } from "../api";
import { BaseLayers } from "../components/IgnLayers";
import type { HikeSummary } from "../types";

export function MapPage() {
  const [hikes, setHikes] = useState<HikeSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getHikes().then(setHikes).catch((e) => setError(e.message));
  }, []);

  const withCoords = hikes.filter((h) => h.start_lat != null && h.start_lon != null);

  return (
    <div>
      <p>{hikes.length} randonnée(s) au catalogue{error ? ` — erreur: ${error}` : ""}.</p>
      <MapContainer center={[46.6, 2.4]} zoom={6} style={{ height: "70vh", width: "100%" }}>
        <BaseLayers />
        {withCoords.map((hike) => (
          <Marker key={hike.id} position={[hike.start_lat as number, hike.start_lon as number]}>
            <Popup>
              <strong>{hike.name}</strong>
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
