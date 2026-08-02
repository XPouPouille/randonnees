import type {
  ActivityType,
  DrawHikePayload,
  ElevationResultPoint,
  EquipmentCategory,
  EquipmentItem,
  HikeDetail,
  HikeSummary,
  HikeUpdatePayload,
  PoiResult,
} from "./types";
import type { LatLon } from "./geo";

const API_BASE = "/api";

function adminHeaders(): HeadersInit {
  const token = localStorage.getItem("admin_token");
  return token ? { "X-Admin-Token": token } : {};
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Erreur ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function getHikes(includeTrack = false): Promise<HikeSummary[]> {
  return fetch(`${API_BASE}/hikes?include_track=${includeTrack}`).then((r) => handle(r));
}

export function getHike(id: number): Promise<HikeDetail> {
  return fetch(`${API_BASE}/hikes/${id}`).then((r) => handle(r));
}

export function createHike(formData: FormData): Promise<HikeDetail> {
  return fetch(`${API_BASE}/hikes`, {
    method: "POST",
    headers: adminHeaders(),
    body: formData,
  }).then((r) => handle(r));
}

export function updateHike(id: number, payload: HikeUpdatePayload): Promise<HikeDetail> {
  return fetch(`${API_BASE}/hikes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...adminHeaders() },
    body: JSON.stringify(payload),
  }).then((r) => handle(r));
}

export function deleteHike(id: number): Promise<void> {
  return fetch(`${API_BASE}/hikes/${id}`, {
    method: "DELETE",
    headers: adminHeaders(),
  }).then((r) => handle(r));
}

export function addLink(
  hikeId: number,
  payload: { platform: string; url: string; label?: string }
): Promise<void> {
  return fetch(`${API_BASE}/hikes/${hikeId}/links`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...adminHeaders() },
    body: JSON.stringify(payload),
  }).then((r) => handle(r));
}

export function deleteLink(linkId: number): Promise<void> {
  return fetch(`${API_BASE}/links/${linkId}`, {
    method: "DELETE",
    headers: adminHeaders(),
  }).then((r) => handle(r));
}

export function getElevationProfile(points: LatLon[]): Promise<ElevationResultPoint[]> {
  return fetch(`${API_BASE}/elevation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points }),
  }).then((r) => handle(r));
}

export function createDrawnHike(payload: DrawHikePayload): Promise<HikeDetail> {
  return fetch(`${API_BASE}/hikes/draw`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...adminHeaders() },
    body: JSON.stringify(payload),
  }).then((r) => handle(r));
}

export function getRoute(points: LatLon[], activityType: ActivityType): Promise<LatLon[]> {
  return fetch(`${API_BASE}/route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points, activity_type: activityType }),
  }).then((r) => handle(r));
}

export function getPoi(points: LatLon[], radiusM: number, categories: string[]): Promise<PoiResult[]> {
  return fetch(`${API_BASE}/poi`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points, radius_m: radiusM, categories }),
  }).then((r) => handle(r));
}

export function addPoisToHike(hikeId: number, pois: PoiResult[]): Promise<HikeDetail> {
  return fetch(`${API_BASE}/hikes/${hikeId}/pois`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...adminHeaders() },
    body: JSON.stringify(pois),
  }).then((r) => handle(r));
}

export function deletePoi(poiId: number): Promise<void> {
  return fetch(`${API_BASE}/pois/${poiId}`, {
    method: "DELETE",
    headers: adminHeaders(),
  }).then((r) => handle(r));
}

// Matériel : pas de token admin, ouvert à tous (à la demande).
export function getEquipment(): Promise<EquipmentItem[]> {
  return fetch(`${API_BASE}/equipment`).then((r) => handle(r));
}

export function createEquipmentItem(
  name: string,
  quantity: number,
  categoryId: number | null
): Promise<EquipmentItem> {
  return fetch(`${API_BASE}/equipment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, quantity, category_id: categoryId }),
  }).then((r) => handle(r));
}

export function updateEquipmentItem(
  id: number,
  payload: { name?: string; quantity?: number; checked?: boolean; category_id?: number | null }
): Promise<EquipmentItem> {
  return fetch(`${API_BASE}/equipment/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then((r) => handle(r));
}

export function deleteEquipmentItem(id: number): Promise<void> {
  return fetch(`${API_BASE}/equipment/${id}`, { method: "DELETE" }).then((r) => handle(r));
}

export function reorderEquipment(categoryId: number | null, ids: number[]): Promise<EquipmentItem[]> {
  return fetch(`${API_BASE}/equipment/reorder`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category_id: categoryId, ids }),
  }).then((r) => handle(r));
}

export function getEquipmentCategories(): Promise<EquipmentCategory[]> {
  return fetch(`${API_BASE}/equipment/categories`).then((r) => handle(r));
}

export function createEquipmentCategory(name: string): Promise<EquipmentCategory> {
  return fetch(`${API_BASE}/equipment/categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  }).then((r) => handle(r));
}

export function renameEquipmentCategory(id: number, name: string): Promise<EquipmentCategory> {
  return fetch(`${API_BASE}/equipment/categories/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  }).then((r) => handle(r));
}

export function deleteEquipmentCategory(id: number): Promise<void> {
  return fetch(`${API_BASE}/equipment/categories/${id}`, { method: "DELETE" }).then((r) => handle(r));
}

export function reorderEquipmentCategories(ids: number[]): Promise<EquipmentCategory[]> {
  return fetch(`${API_BASE}/equipment/categories/reorder`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  }).then((r) => handle(r));
}
