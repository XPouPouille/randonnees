import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, Popup } from "react-leaflet";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteHike, getHike, updateHike } from "../api";
import { BaseLayers } from "../components/IgnLayers";
import { ElevationChart } from "../components/ElevationChart";
import { ACTIVITY_COLORS, ACTIVITY_LABELS } from "../activity";
import { NOTES_MAX_LENGTH } from "../constants";
import { POI_LABELS } from "../poi";
import type { ActivityType, HikeDetail } from "../types";

const POI_COLOR = "#e07b00";

function directionsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
}

interface EditForm {
  name: string;
  description: string;
  notes: string;
  difficulty: string;
  duration_hint: string;
  activity_type: ActivityType;
}

function toEditForm(hike: HikeDetail): EditForm {
  return {
    name: hike.name,
    description: hike.description || "",
    notes: hike.notes || "",
    difficulty: hike.difficulty || "",
    duration_hint: hike.duration_hint || "",
    activity_type: hike.activity_type,
  };
}

export function HikeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [hike, setHike] = useState<HikeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [adminToken, setAdminToken] = useState(localStorage.getItem("admin_token") || "");
  const [form, setForm] = useState<EditForm | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  function startEditing() {
    setForm(toEditForm(hike!));
    setSaveError(null);
    setEditing(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form || !hike) return;
    localStorage.setItem("admin_token", adminToken);
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateHike(hike.id, {
        name: form.name,
        description: form.description || null,
        notes: form.notes || null,
        difficulty: form.difficulty || null,
        duration_hint: form.duration_hint || null,
        activity_type: form.activity_type,
      });
      setHike(updated);
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <p>
        <Link to="/">← Retour à la carte</Link>
      </p>

      {editing && form ? (
        <form onSubmit={handleSave}>
          <h2>Modifier la randonnée</h2>
          <p>
            <label>
              Token admin
              <br />
              <input type="password" value={adminToken} onChange={(e) => setAdminToken(e.target.value)} required />
            </label>
          </p>
          <p>
            <label>
              Nom
              <br />
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>
          </p>
          <p>
            <label>
              Catégorie
              <br />
              <select
                value={form.activity_type}
                onChange={(e) => setForm({ ...form, activity_type: e.target.value as ActivityType })}
              >
                <option value="rando">Rando</option>
                <option value="velo">Vélo</option>
              </select>
            </label>
          </p>
          <p>
            <label>
              Difficulté
              <br />
              <input value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} />
            </label>
          </p>
          <p>
            <label>
              Durée estimée
              <br />
              <input
                value={form.duration_hint}
                onChange={(e) => setForm({ ...form, duration_hint: e.target.value })}
              />
            </label>
          </p>
          <p>
            <label>
              Description
              <br />
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </label>
          </p>
          <p>
            <label>
              Commentaires
              <br />
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value.slice(0, NOTES_MAX_LENGTH) })}
                maxLength={NOTES_MAX_LENGTH}
                rows={4}
              />
            </label>
            <br />
            <small>
              {form.notes.length}/{NOTES_MAX_LENGTH} caractères
            </small>
          </p>
          {saveError && <p style={{ color: "red" }}>{saveError}</p>}
          <p>
            <button type="submit" disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>{" "}
            <button type="button" onClick={() => setEditing(false)}>
              Annuler
            </button>
          </p>
        </form>
      ) : (
        <>
          <h2>
            {hike.name}{" "}
            <span style={{ fontSize: "0.6em", color: ACTIVITY_COLORS[hike.activity_type] }}>
              ■ {ACTIVITY_LABELS[hike.activity_type]}
            </span>
          </h2>
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
        </>
      )}

      <MapContainer center={center} zoom={13} style={{ height: "50vh", width: "100%" }}>
        <BaseLayers />
        {coords && <Polyline positions={coords} pathOptions={{ color: ACTIVITY_COLORS[hike.activity_type], weight: 4 }} />}
        {hike.start_lat != null && hike.start_lon != null && (
          <Marker position={[hike.start_lat, hike.start_lon]} />
        )}
        {hike.pois.map((poi, i) => (
          <CircleMarker
            key={i}
            center={[poi.lat, poi.lon]}
            radius={5}
            pathOptions={{ color: POI_COLOR, fillColor: POI_COLOR, fillOpacity: 1 }}
          >
            <Popup>
              <strong>{poi.name || POI_LABELS[poi.category] || poi.category}</strong>
              <br />
              {POI_LABELS[poi.category] || poi.category}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {hike.elevation_profile && hike.elevation_profile.length > 0 && (
        <>
          <h3>Profil topologique</h3>
          <ElevationChart profile={hike.elevation_profile} />
        </>
      )}

      {hike.pois.length > 0 && (
        <>
          <h3>Points d'intérêt</h3>
          <ul>
            {hike.pois.map((poi, i) => (
              <li key={i}>
                {poi.name || POI_LABELS[poi.category] || poi.category} ({POI_LABELS[poi.category] || poi.category})
              </li>
            ))}
          </ul>
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

      <h3>Commentaires</h3>
      {hike.notes ? (
        <p>{hike.notes}</p>
      ) : (
        <p>
          <em>
            Aucun commentaire pour l'instant ({NOTES_MAX_LENGTH} caractères max, via le bouton "Modifier").
          </em>
        </p>
      )}

      {!editing && (
        <p>
          <button onClick={startEditing}>Modifier</button>{" "}
          <button onClick={handleDelete}>Supprimer cette randonnée</button>
        </p>
      )}
    </div>
  );
}
