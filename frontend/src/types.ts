export type ActivityType = "rando" | "velo";

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
  activity_type: ActivityType;
  difficulty?: string | null;
  duration_hint?: string | null;
  distance_km?: number | null;
  elevation_gain_m?: number | null;
  start_lat?: number | null;
  start_lon?: number | null;
  track_geojson?: { type: string; coordinates: [number, number][] } | null;
}

export interface HikeDetail extends HikeSummary {
  description?: string | null;
  notes?: string | null;
  elevation_loss_m?: number | null;
  elevation_profile?: ElevationPoint[] | null;
  gpx_filename?: string | null;
  created_at: string;
  links: ExternalLink[];
}

export interface HikeUpdatePayload {
  name?: string;
  description?: string | null;
  notes?: string | null;
  difficulty?: string | null;
  duration_hint?: string | null;
  activity_type?: ActivityType;
}

export interface ElevationResultPoint {
  lat: number;
  lon: number;
  elevation_m: number;
}

export interface DrawHikePayload {
  name: string;
  activity_type: ActivityType;
  difficulty?: string | null;
  duration_hint?: string | null;
  description?: string | null;
  points: { lat: number; lon: number }[];
}
