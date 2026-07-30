export interface ExternalLink {
  id: number;
  platform: string;
  url: string;
  label?: string | null;
}

export interface ElevationPoint {
  distance_km: number;
  elevation_m: number;
  lat: number;
  lon: number;
}

export interface HikeSummary {
  id: number;
  name: string;
  difficulty?: string | null;
  duration_hint?: string | null;
  distance_km?: number | null;
  elevation_gain_m?: number | null;
  start_lat?: number | null;
  start_lon?: number | null;
}

export interface HikeDetail extends HikeSummary {
  description?: string | null;
  elevation_loss_m?: number | null;
  elevation_profile?: ElevationPoint[] | null;
  gpx_filename?: string | null;
  created_at: string;
  links: ExternalLink[];
  track_geojson?: { type: string; coordinates: [number, number][] } | null;
}
