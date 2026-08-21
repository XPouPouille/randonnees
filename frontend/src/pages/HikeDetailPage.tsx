import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, Popup } from "react-leaflet";
import { Link, useNavigate, useParams } from "react-router-dom";
import { addPoisToHike, deleteHike, deletePoi, getHike, getPoi, updateHike } from "../api";
import { useAuth } from "../auth";
import { BaseLayers, FullscreenToggle, NationalParksAdhesionToggle, NationalParksToggle } from "../components/IgnLayers";
import { MapLegend } from "../components/MapLegend";
import { ElevationChart } from "../components/ElevationChart";
import { PoiSearchControls } from "../components/PoiSearchControls";
import { ACTIVITY_COLORS, ACTIVITY_LABELS } from "../activity";
import { NOTES_MAX_LENGTH } from "../constants";
import { DEFAULT_POI_CATEGORIES, POI_LABELS } from "../poi";
import { samplePoints } from "../geo";
import type { ActivityType, HikeDetail, PoiResult } from "../types";

const POI_COLOR = "#e07b00";
const FOUND_POI_COLOR = "#1565c0";
const POI_SEARCH_SAMPLE_MAX = 300;

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
  const { email } = useAuth();
  const [hike, setHike] = useState<HikeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [hoveredPoint, setHoveredPoint] = useState<{ lat: number; lon: number } | null>(null);
  const [poiSearchOpen, setPoiSearchOpen] = useState(false);
  const [poiRadius, setPoiRadius] = useState(1000);
  const [poiCategories, setPoiCategories] = useState<Set<string>>(new Set(DEFAULT_POI_CATEGORIES));
  const [foundPois, setFoundPois] = useState<PoiResult[]>([]);
  const [poiSearching, setPoiSearching] = useState(false);
  const [poiAdding, setPoiAdding] = useState(false);
  const [poiError, setPoiError] = useState<string | null>(null);

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

  function togglePoiCategory(key: string) {
    setPoiCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSearchPoi() {
    if (!hike) return;
    const source =
      coords && coords.length > 0
        ? coords.map(([lat, lon]) => ({ lat, lon }))
        : hike.start_lat != null && hike.start_lon != null
          ? [{ lat: hike.start_lat, lon: hike.start_lon }]
          : [];
    if (source.length === 0 || poiCategories.size === 0) return;
    setPoiSearching(true);
    setPoiError(null);
    try {
      const result = await getPoi(samplePoints(source, POI_SEARCH_SAMPLE_MAX), poiRadius, Array.from(poiCategories));
      // Ne propose que les POI pas déjà enregistrés sur cette rando.
      const existing = new Set(hike.pois.map((p) => `${p.lat},${p.lon},${p.category}`));
      setFoundPois(result.filter((p) => !existing.has(`${p.lat},${p.lon},${p.category}`)));
    } catch (err) {
      setPoiError(err instanceof Error ? err.message : String(err));
    } finally {
      setPoiSearching(false);
    }
  }

  function removeFoundPoi(index: number) {
    setFoundPois((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleAddFoundPois() {
    if (!hike || foundPois.length === 0) return;
    setPoiAdding(true);
    setPoiError(null);
    try {
      const updated = await addPoisToHike(hike.id, foundPois);
      setHike(updated);
      setFoundPois([]);
    } catch (err) {
      setPoiError(err instanceof Error ? err.message : String(err));
    } finally {
      setPoiAdding(false);
    }
  }

  async function handleDeleteSavedPoi(poiId: number | null | undefined) {
    if (!hike || poiId == null) return;
    try {
      await deletePoi(poiId);
      setHike({ ...hike, pois: hike.pois.filter((p) => p.id !== poiId) });
    } catch (err) {
      setPoiError(err instanceof Error ? err.message : String(err));
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

          {hike.gpx_filename && (
            <p>
              <a href={`/uploads/${hike.gpx_filename}`} download={`${hike.name}.gpx`}>
                ⬇️ Télécharger le fichier GPX
              </a>
            </p>
          )}
        </>
      )}

      <MapContainer center={center} zoom={13} style={{ height: "50vh", width: "100%" }}>
        <BaseLayers />
        <NationalParksToggle />
        <NationalParksAdhesionToggle />
        <MapLegend />
        <FullscreenToggle />
        {coords && <Polyline positions={coords} pathOptions={{ color: ACTIVITY_COLORS[hike.activity_type], weight: 4 }} />}
        {hike.start_lat != null && hike.start_lon != null && (
          <Marker position={[hike.start_lat, hike.start_lon]} />
        )}
        {hike.pois.map((poi, i) => (
          <CircleMarker
            key={`saved-${i}`}
            center={[poi.lat, poi.lon]}
            radius={5}
            pathOptions={{ color: POI_COLOR, fillColor: POI_COLOR, fillOpacity: 1 }}
          >
            <Popup>
              <strong>{poi.name || POI_LABELS[poi.category] || poi.category}</strong>
              <br />
              {POI_LABELS[poi.category] || poi.category}
              <br />
              {email && (
                <button type="button" onClick={() => handleDeleteSavedPoi(poi.id)}>
                  Retirer
                </button>
              )}
            </Popup>
          </CircleMarker>
        ))}
        {foundPois.map((poi, i) => (
          <CircleMarker
            key={`found-${i}`}
            center={[poi.lat, poi.lon]}
            radius={5}
            pathOptions={{ color: FOUND_POI_COLOR, fillColor: FOUND_POI_COLOR, fillOpacity: 1 }}
          >
            <Popup>
              <strong>{poi.name || POI_LABELS[poi.category] || poi.category}</strong>
              <br />
              {POI_LABELS[poi.category] || poi.category}
              <br />
              <button type="button" onClick={() => removeFoundPoi(i)}>
                Retirer
              </button>
            </Popup>
          </CircleMarker>
        ))}
        {hoveredPoint && (
          <CircleMarker
            center={[hoveredPoint.lat, hoveredPoint.lon]}
            radius={8}
            pathOptions={{ color: "#ff8f00", fillColor: "#ff8f00", fillOpacity: 1, weight: 2 }}
          />
        )}
      </MapContainer>

      {hike.elevation_profile && hike.elevation_profile.length > 0 && (
        <>
          <h3>Profil topologique</h3>
          <ElevationChart
            profile={hike.elevation_profile}
            onHover={(p) => setHoveredPoint(p ? { lat: p.lat, lon: p.lon } : null)}
          />
        </>
      )}

      <h3>Points d'intérêt</h3>
      {hike.pois.length === 0 && <p>Aucun point d'intérêt pour l'instant.</p>}
      <ul>
        {hike.pois.map((poi, i) => (
          <li key={i}>
            {poi.name || POI_LABELS[poi.category] || poi.category} ({POI_LABELS[poi.category] || poi.category}){" "}
            {email && (
              <button type="button" onClick={() => handleDeleteSavedPoi(poi.id)}>
                Retirer
              </button>
            )}
          </li>
        ))}
      </ul>

      {poiSearchOpen ? (
        <>
          <PoiSearchControls
            radius={poiRadius}
            setRadius={setPoiRadius}
            categories={poiCategories}
            toggleCategory={togglePoiCategory}
            onSearch={handleSearchPoi}
            loading={poiSearching}
            foundCount={foundPois.length}
            onClearFound={() => setFoundPois([])}
          />
          {poiError && <p style={{ color: "red" }}>{poiError}</p>}
          {!email && foundPois.length > 0 && (
            <p>
              <Link to="/connexion">Connecte-toi</Link> pour enregistrer ces points d'intérêt.
            </p>
          )}
          <p>
            {email && foundPois.length > 0 && (
              <button type="button" onClick={handleAddFoundPois} disabled={poiAdding}>
                {poiAdding ? "Ajout…" : `Ajouter ces ${foundPois.length} point(s) d'intérêt`}
              </button>
            )}{" "}
            <button
              type="button"
              onClick={() => {
                setPoiSearchOpen(false);
                setFoundPois([]);
              }}
            >
              Fermer la recherche
            </button>
          </p>
        </>
      ) : (
        <p>
          <button type="button" onClick={() => setPoiSearchOpen(true)}>
            Rechercher des points d'intérêt
          </button>
        </p>
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

      {!editing && email && (
        <p>
          <button onClick={startEditing}>Modifier</button>{" "}
          <button onClick={handleDelete}>Supprimer cette randonnée</button>
        </p>
      )}
      {!editing && !email && (
        <p>
          <Link to="/connexion">Connecte-toi</Link> pour modifier ou supprimer cette randonnée.
        </p>
      )}
    </div>
  );
}
