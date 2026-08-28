import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, Tooltip, useMapEvents } from "react-leaflet";
import { Link, useNavigate } from "react-router-dom";
import { createDrawnHike, getElevationProfile, getPoi, getRoute } from "../api";
import { useAuth } from "../auth";
import { BaseLayers, CountryLayerPicker, FullscreenToggle, NationalParksAdhesionToggle, NationalParksToggle } from "../components/IgnLayers";
import { MapLegend } from "../components/MapLegend";
import { ElevationChart } from "../components/ElevationChart";
import { PoiSearchControls } from "../components/PoiSearchControls";
import { ACTIVITY_COLORS } from "../activity";
import { DEFAULT_POI_CATEGORIES, POI_LABELS } from "../poi";
import { haversineKm, samplePoints, type LatLon } from "../geo";
import type { ActivityType, ElevationResultPoint, PoiResult } from "../types";

// Un tracé routé peut compter plusieurs milliers de points : inutile d'envoyer
// cette densité pour un aperçu dénivelé ou une recherche de POI.
const PREVIEW_SAMPLE_MAX = 300

const POI_COLOR = "#e07b00";

type InsertMode = "append" | "before" | "after";

function ClickHandler({ onClick }: { onClick: (latlng: LatLon) => void }) {
  useMapEvents({
    click(e) {
      onClick({ lat: e.latlng.lat, lon: e.latlng.lng });
    },
  });
  return null;
}

export function CreatePage() {
  const navigate = useNavigate();
  const { email } = useAuth();
  const [name, setName] = useState("");
  const [activityType, setActivityType] = useState<ActivityType>("rando");
  const [difficulty, setDifficulty] = useState("");
  const [description, setDescription] = useState("");

  const [points, setPoints] = useState<LatLon[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [insertMode, setInsertMode] = useState<InsertMode>("append");

  const [profile, setProfile] = useState<ElevationResultPoint[] | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<{ lat: number; lon: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [routedPath, setRoutedPath] = useState<LatLon[] | null>(null);
  const [routing, setRouting] = useState(false);

  const [poiRadius, setPoiRadius] = useState(1000);
  const [poiCategories, setPoiCategories] = useState<Set<string>>(new Set(DEFAULT_POI_CATEGORIES));
  const [pois, setPois] = useState<PoiResult[]>([]);
  const [poiLoading, setPoiLoading] = useState(false);

  const color = ACTIVITY_COLORS[activityType];
  const straightLine = useMemo(() => points.map((p) => [p.lat, p.lon] as [number, number]), [points]);

  // Recalcule l'itinéraire routier (suit les routes/chemins IGN) à chaque
  // changement des points, avec un léger debounce pour ne pas spammer
  // l'API à chaque clic rapide.
  useEffect(() => {
    if (points.length < 2) {
      setRoutedPath(null);
      return;
    }
    setRouting(true);
    const timeout = setTimeout(() => {
      getRoute(points, activityType)
        .then(setRoutedPath)
        .catch(() => setRoutedPath(null))
        .finally(() => setRouting(false));
    }, 500);
    return () => clearTimeout(timeout);
  }, [points, activityType]);

  const displayLine = useMemo(() => {
    if (routedPath && routedPath.length >= 2) return routedPath.map((p) => [p.lat, p.lon] as [number, number]);
    return straightLine;
  }, [routedPath, straightLine]);

  // Recalcule le profil altimétrique automatiquement à chaque changement de
  // tracé (attend la fin du routage pour éviter un double calcul).
  useEffect(() => {
    if (points.length < 2 || routing) {
      if (points.length < 2) setProfile(null);
      return;
    }
    setProfileLoading(true);
    const forProfile = routedPath && routedPath.length >= 2 ? routedPath : points;
    const timeout = setTimeout(() => {
      getElevationProfile(samplePoints(forProfile, PREVIEW_SAMPLE_MAX))
        .then(setProfile)
        .catch((err) => setError(err instanceof Error ? err.message : String(err)))
        .finally(() => setProfileLoading(false));
    }, 400);
    return () => clearTimeout(timeout);
  }, [points, routedPath, routing]);

  function handleMapClick(latlng: LatLon) {
    setProfile(null);
    setPoints((prev) => {
      if (insertMode === "append" || selectedIndex === null) {
        const next = [...prev, latlng];
        setSelectedIndex(next.length - 1);
        return next;
      }
      const insertAt = insertMode === "before" ? selectedIndex : selectedIndex + 1;
      const next = [...prev.slice(0, insertAt), latlng, ...prev.slice(insertAt)];
      setSelectedIndex(insertAt);
      return next;
    });
    setInsertMode("append");
  }

  function selectPoint(i: number) {
    setSelectedIndex(i);
    setInsertMode("append");
  }

  function deleteSelected() {
    if (selectedIndex === null) return;
    setPoints((prev) => prev.filter((_, i) => i !== selectedIndex));
    setSelectedIndex(null);
    setInsertMode("append");
    setProfile(null);
  }

  function deletePoint(i: number) {
    setPoints((prev) => prev.filter((_, idx) => idx !== i));
    setSelectedIndex(null);
    setInsertMode("append");
    setProfile(null);
  }

  function toggleCategory(key: string) {
    setPoiCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSearchPoi() {
    if (points.length < 1 || poiCategories.size === 0) return;
    setPoiLoading(true);
    setError(null);
    try {
      const path = routedPath && routedPath.length >= 2 ? routedPath : points;
      const result = await getPoi(samplePoints(path, PREVIEW_SAMPLE_MAX), poiRadius, Array.from(poiCategories));
      setPois(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPoiLoading(false);
    }
  }

  function removePoi(index: number) {
    setPois((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!name.trim() || points.length < 2 || !email) return;
    setSaving(true);
    setError(null);
    try {
      const hike = await createDrawnHike({
        name: name.trim(),
        activity_type: activityType,
        difficulty: difficulty || null,
        description: description || null,
        points,
        pois,
      });
      navigate(`/hikes/${hike.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const elevationProfileForChart = useMemo(() => {
    if (!profile) return null;
    let cumulative = 0;
    return profile.map((p, i) => {
      if (i > 0) cumulative += haversineKm(profile[i - 1], p);
      return { distance_km: cumulative, elevation_m: p.elevation_m, lat: p.lat, lon: p.lon };
    });
  }, [profile]);

  const elevationGainM = useMemo(() => {
    if (!elevationProfileForChart) return null;
    let gain = 0;
    for (let i = 1; i < elevationProfileForChart.length; i++) {
      const delta = elevationProfileForChart[i].elevation_m - elevationProfileForChart[i - 1].elevation_m;
      if (delta > 0) gain += delta;
    }
    return gain;
  }, [elevationProfileForChart]);

  return (
    <div>
      <h2>Créer un tracé</h2>

      {!email && (
        <p style={{ padding: 8, border: "1px solid #ddd", borderRadius: 6 }}>
          <Link to="/connexion">Connecte-toi</Link> pour pouvoir enregistrer ce tracé (tu peux quand même le
          dessiner et prévisualiser le dénivelé sans être connecté).
        </p>
      )}

      <p>
        <label>
          Nom de l'itinéraire
          <br />
          <input value={name} onChange={(e) => setName(e.target.value)} required style={{ width: 300 }} />
        </label>
      </p>

      <p>
        <label>
          Catégorie
          <br />
          <select value={activityType} onChange={(e) => setActivityType(e.target.value as ActivityType)}>
            <option value="rando">Rando</option>
            <option value="velo">Vélo</option>
          </select>
        </label>
      </p>

      <p>
        <label>
          Difficulté
          <br />
          <input value={difficulty} onChange={(e) => setDifficulty(e.target.value)} />
        </label>
      </p>

      <p>
        <label>
          Description
          <br />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </label>
      </p>

      <div style={{ marginBottom: 8, padding: 8, border: "1px solid #ddd", borderRadius: 6 }}>
        <strong>Outils de tracé</strong> — cliquez sur la carte pour ajouter un point. Le tracé suit
        automatiquement les routes/chemins IGN entre les points.
        {routing && <em> Calcul de l'itinéraire…</em>}
        <br />
        {selectedIndex !== null ? (
          <>
            Point sélectionné : #{selectedIndex + 1}.{" "}
            <button type="button" onClick={() => setInsertMode("before")}>
              Insérer un point avant
            </button>{" "}
            <button type="button" onClick={() => setInsertMode("after")}>
              Insérer un point après
            </button>{" "}
            <button type="button" onClick={deleteSelected}>
              Supprimer ce point
            </button>{" "}
            <button type="button" onClick={() => setSelectedIndex(null)}>
              Désélectionner
            </button>
            {insertMode !== "append" && (
              <p>
                <em>
                  Cliquez sur la carte pour placer le nouveau point {insertMode === "before" ? "avant" : "après"} le
                  point #{selectedIndex + 1}.
                </em>
              </p>
            )}
          </>
        ) : (
          <em>Cliquez sur un point existant pour le sélectionner (insérer avant/après, supprimer).</em>
        )}
      </div>

      <MapContainer center={[46.6, 2.4]} zoom={6} style={{ height: "60vh", width: "100%" }}>
        <BaseLayers />
        <NationalParksToggle />
        <NationalParksAdhesionToggle />
        <MapLegend />
        <FullscreenToggle />
        <CountryLayerPicker />
        <ClickHandler onClick={handleMapClick} />
        {displayLine.length >= 2 && <Polyline positions={displayLine} pathOptions={{ color, weight: 3 }} />}
        {points.map((p, i) => (
          <CircleMarker
            key={i}
            center={[p.lat, p.lon]}
            radius={selectedIndex === i ? 8 : 5}
            pathOptions={{
              color: selectedIndex === i ? "#d3242a" : color,
              fillColor: selectedIndex === i ? "#d3242a" : color,
              fillOpacity: 1,
            }}
            eventHandlers={{ click: () => selectPoint(i) }}
          >
            <Tooltip>#{i + 1}</Tooltip>
          </CircleMarker>
        ))}
        {pois.map((poi, i) => (
          <CircleMarker
            key={`poi-${i}`}
            center={[poi.lat, poi.lon]}
            radius={5}
            pathOptions={{ color: POI_COLOR, fillColor: POI_COLOR, fillOpacity: 1 }}
          >
            <Popup>
              <strong>{poi.name || POI_LABELS[poi.category] || poi.category}</strong>
              <br />
              {POI_LABELS[poi.category] || poi.category}
              <br />
              <button type="button" onClick={() => removePoi(i)}>
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

      <h3>Points ({points.length})</h3>
      {points.length === 0 ? (
        <p>Aucun point pour l'instant.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
              <th>#</th>
              <th>Latitude</th>
              <th>Longitude</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr
                key={i}
                style={{
                  borderBottom: "1px solid #eee",
                  background: selectedIndex === i ? "#fee" : undefined,
                  cursor: "pointer",
                }}
                onClick={() => selectPoint(i)}
              >
                <td>{i + 1}</td>
                <td>{p.lat.toFixed(5)}</td>
                <td>{p.lon.toFixed(5)}</td>
                <td>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePoint(i);
                    }}
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <PoiSearchControls
        radius={poiRadius}
        setRadius={setPoiRadius}
        categories={poiCategories}
        toggleCategory={toggleCategory}
        onSearch={handleSearchPoi}
        loading={poiLoading}
        searchDisabled={points.length < 1}
        foundCount={pois.length}
        onClearFound={() => setPois([])}
      />

      {profileLoading && <p><em>Calcul du profil altimétrique…</em></p>}

      {elevationProfileForChart && (
        <>
          <h3>
            Profil topologique (aperçu)
            {elevationGainM != null && <> — D+ : +{Math.round(elevationGainM)} m</>}
          </h3>
          <ElevationChart
            profile={elevationProfileForChart}
            onHover={(p) => setHoveredPoint(p ? { lat: p.lat, lon: p.lon } : null)}
          />
        </>
      )}

      {error && <p style={{ color: "red" }}>{error}</p>}

      <p>
        <button type="button" onClick={handleSave} disabled={saving || !name.trim() || points.length < 2 || !email}>
          {saving ? "Enregistrement…" : "Enregistrer le tracé"}
        </button>
      </p>
    </div>
  );
}
