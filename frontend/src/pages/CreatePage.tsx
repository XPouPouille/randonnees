import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Polyline, Tooltip, useMapEvents } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import { createDrawnHike, getElevationProfile, getRoute } from "../api";
import { BaseLayers } from "../components/IgnLayers";
import { ElevationChart } from "../components/ElevationChart";
import { ACTIVITY_COLORS } from "../activity";
import { haversineKm, type LatLon } from "../geo";
import type { ActivityType, ElevationResultPoint } from "../types";

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
  const [name, setName] = useState("");
  const [activityType, setActivityType] = useState<ActivityType>("rando");
  const [difficulty, setDifficulty] = useState("");
  const [description, setDescription] = useState("");
  const [adminToken, setAdminToken] = useState(localStorage.getItem("admin_token") || "");

  const [points, setPoints] = useState<LatLon[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [insertMode, setInsertMode] = useState<InsertMode>("append");

  const [profile, setProfile] = useState<ElevationResultPoint[] | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [routedPath, setRoutedPath] = useState<LatLon[] | null>(null);
  const [routing, setRouting] = useState(false);

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

  async function handlePreview() {
    if (points.length < 2) return;
    setProfileLoading(true);
    setError(null);
    try {
      const forProfile = routedPath && routedPath.length >= 2 ? routedPath : points;
      const result = await getElevationProfile(forProfile);
      setProfile(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProfileLoading(false);
    }
  }

  async function handleSave() {
    if (!name.trim() || points.length < 2) return;
    localStorage.setItem("admin_token", adminToken);
    setSaving(true);
    setError(null);
    try {
      const hike = await createDrawnHike({
        name: name.trim(),
        activity_type: activityType,
        difficulty: difficulty || null,
        description: description || null,
        points,
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

  return (
    <div>
      <h2>Créer un tracé</h2>

      <p>
        <label>
          Token admin
          <br />
          <input type="password" value={adminToken} onChange={(e) => setAdminToken(e.target.value)} required />
        </label>
      </p>

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

      <p>
        <button type="button" onClick={handlePreview} disabled={points.length < 2 || profileLoading}>
          {profileLoading ? "Calcul…" : "Aperçu du dénivelé"}
        </button>
      </p>

      {elevationProfileForChart && (
        <>
          <h3>Profil topologique (aperçu)</h3>
          <ElevationChart profile={elevationProfileForChart} />
        </>
      )}

      {error && <p style={{ color: "red" }}>{error}</p>}

      <p>
        <button type="button" onClick={handleSave} disabled={saving || !name.trim() || points.length < 2}>
          {saving ? "Enregistrement…" : "Enregistrer le tracé"}
        </button>
      </p>
    </div>
  );
}
