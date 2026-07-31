import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getHikes } from "../api";
import { HikeFilters } from "../components/HikeFilters";
import { useHikeFilters } from "../filters";
import { ACTIVITY_COLORS, ACTIVITY_LABELS } from "../activity";
import type { HikeSummary } from "../types";

export function ListPage() {
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
    getHikes().then(setHikes).catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h2>Liste des randonnées</h2>
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

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
            <th>Nom</th>
            <th>Catégorie</th>
            <th>Distance</th>
            <th>D+</th>
            <th>Difficulté</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((hike) => (
            <tr key={hike.id} style={{ borderBottom: "1px solid #eee" }}>
              <td>
                <Link to={`/hikes/${hike.id}`}>{hike.name}</Link>
              </td>
              <td style={{ color: ACTIVITY_COLORS[hike.activity_type] }}>■ {ACTIVITY_LABELS[hike.activity_type]}</td>
              <td>{hike.distance_km != null ? `${hike.distance_km} km` : "—"}</td>
              <td>{hike.elevation_gain_m != null ? `+${Math.round(hike.elevation_gain_m)} m` : "—"}</td>
              <td>{hike.difficulty || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
