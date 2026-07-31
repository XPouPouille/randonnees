import { useMemo, useState } from "react";
import type { ActivityType, HikeSummary } from "./types";

export type ActivityFilter = "all" | ActivityType;

export function useHikeFilters(hikes: HikeSummary[]) {
  const [activity, setActivity] = useState<ActivityFilter>("all");
  const [minDistance, setMinDistance] = useState(0);
  // Illimité par défaut : le slider "max" s'affiche donc d'emblée à fond,
  // sans attendre le chargement des randos pour connaître la vraie borne.
  const [maxDistance, setMaxDistance] = useState(Infinity);

  const distanceBoundMax = useMemo(() => {
    const max = hikes.reduce((acc, h) => (h.distance_km != null && h.distance_km > acc ? h.distance_km : acc), 0);
    return Math.max(10, Math.ceil(max / 10) * 10);
  }, [hikes]);

  const filtered = useMemo(
    () =>
      hikes.filter((h) => {
        if (activity !== "all" && h.activity_type !== activity) return false;
        if (h.distance_km != null && (h.distance_km < minDistance || h.distance_km > maxDistance)) return false;
        return true;
      }),
    [hikes, activity, minDistance, maxDistance]
  );

  return {
    filtered,
    activity,
    setActivity,
    minDistance,
    setMinDistance,
    maxDistance,
    setMaxDistance,
    distanceBoundMax,
  };
}
