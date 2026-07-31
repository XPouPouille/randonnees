import { ACTIVITY_COLORS, ACTIVITY_LABELS } from "../activity";
import type { ActivityFilter } from "../filters";

interface Props {
  activity: ActivityFilter;
  setActivity: (a: ActivityFilter) => void;
  minDistance: number;
  setMinDistance: (n: number) => void;
  maxDistance: number;
  setMaxDistance: (n: number) => void;
  distanceBoundMax: number;
}

export function HikeFilters({
  activity,
  setActivity,
  minDistance,
  setMinDistance,
  maxDistance,
  setMaxDistance,
  distanceBoundMax,
}: Props) {
  return (
    <div style={{ marginBottom: 12, padding: 8, border: "1px solid #ddd", borderRadius: 6 }}>
      <div style={{ marginBottom: 8 }}>
        <label style={{ marginRight: 12 }}>
          <input type="radio" checked={activity === "all"} onChange={() => setActivity("all")} /> Toutes
        </label>
        <label style={{ marginRight: 12 }}>
          <input type="radio" checked={activity === "rando"} onChange={() => setActivity("rando")} />{" "}
          <span style={{ color: ACTIVITY_COLORS.rando }}>■</span> {ACTIVITY_LABELS.rando}
        </label>
        <label>
          <input type="radio" checked={activity === "velo"} onChange={() => setActivity("velo")} />{" "}
          <span style={{ color: ACTIVITY_COLORS.velo }}>■</span> {ACTIVITY_LABELS.velo}
        </label>
      </div>

      <div>
        Distance : {minDistance} – {maxDistance} km
        <br />
        <label>
          Min{" "}
          <input
            type="range"
            min={0}
            max={distanceBoundMax}
            value={minDistance}
            onChange={(e) => setMinDistance(Math.min(Number(e.target.value), maxDistance))}
          />
        </label>
        <br />
        <label>
          Max{" "}
          <input
            type="range"
            min={0}
            max={distanceBoundMax}
            value={maxDistance}
            onChange={(e) => setMaxDistance(Math.max(Number(e.target.value), minDistance))}
          />
        </label>
      </div>
    </div>
  );
}
