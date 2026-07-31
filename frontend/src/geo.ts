export interface LatLon {
  lat: number;
  lon: number;
}

/** Distance approximative en km entre deux points (formule de haversine). */
export function haversineKm(a: LatLon, b: LatLon): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Sous-échantillonne une liste de points pour limiter la taille d'une requête
 * (un tracé routé peut compter plusieurs milliers de points ; pas besoin de
 * cette densité pour un aperçu dénivelé ou une recherche de POI). */
export function samplePoints<T>(points: T[], maxPoints: number): T[] {
  if (points.length <= maxPoints) return points;
  const step = points.length / maxPoints;
  return Array.from({ length: maxPoints }, (_, i) => points[Math.floor(i * step)]);
}
