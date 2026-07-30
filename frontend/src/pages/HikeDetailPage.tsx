import { useEffect, useState } from "react";
import { MapContainer, Marker, Polyline } from "react-leaflet";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteHike, getHike } from "../api";
import { BaseLayers } from "../components/IgnLayers";
import { ElevationChart } from "../components/ElevationChart";
import type { HikeDetail } from "../types";

function directionsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
}

export function HikeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [hike, setHike] = useState<HikeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getHike(Number(id)).then(setHike).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p>Erreur: {error}</p>;
  if (!hike) return <p>Chargement…</p>;

  const coords = hike.track_geojson?.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]);
  const center = coords?.[0] ?? (hike.start_lat && hike.start_lon ? [hike.start_lat, hike.start_lon] as [number, number] : [46.6, 2.4] as [number, number]);

  async function handleDelete() {
    if (!hike) return;
    if (!confirm(`Supprimer la randonnée "${hike.name}" ?`)) return;
    await deleteHike(hike.id);
    navigate("/");
  }

  return (
    <div>
      <p>
        <Link to="/">← Retour à la carte</Link>
      </p>
      <h2>{hike.name}</h2>
      {hike.description && <p>{hike.description}</p>}

      <ul>
        {hike.distance_km != null && <li>Distance : {hike.distance_km} km</li>}
        {hike.elevation_gain_m != null && <li>Dénivelé positif : +{Math.round(hike.elevation_gain_m)} m</li>}
        {hike.elevation_loss_m != null && <li>Dénivelé négatif : -{Math.round(hike.elevation_loss_m)} m</li>}
        {hike.difficulty && <li>Difficulté : {hike.difficulty}</li>}
        {hike.duration_hint && <li>Durée estimée : {hike.duration_hint}</li>}
      </ul>

      {hike.start_lat != null && hike.start_lon != null && (
        <p>
          <a href={directionsUrl(hike.start_lat, hike.start_lon)} target="_blank" rel="noreferrer">
            🚗 Itinéraire pour se rendre au point de départ
          </a>
        </p>
      )}

      <MapContainer center={center} zoom={13} style={{ height: "50vh", width: "100%" }}>
        <BaseLayers />
        {coords && <Polyline positions={coords} pathOptions={{ color: "#d3242a", weight: 4 }} />}
        {hike.start_lat != null && hike.start_lon != null && (
          <Marker position={[hike.start_lat, hike.start_lon]} />
        )}
      </MapContainer>

      {hike.elevation_profile && hike.elevation_profile.length > 0 && (
        <>
          <h3>Profil topologique</h3>
          <ElevationChart profile={hike.elevation_profile} />
        </>
      )}

      <h3>Liens externes</h3>
      {hike.links.length === 0 && <p>Aucun lien pour l'instant.</p>}
      <ul>
        {hike.links.map((link) => (
          <li key={link.id}>
            <a href={link.url} target="_blank" rel="noreferrer">
              {link.label || link.platform}
            </a>{" "}
            ({link.platform})
          </li>
        ))}
      </ul>

      <p>
        <button onClick={handleDelete}>Supprimer cette randonnée</button>
      </p>
    </div>
  );
}
