import type { HikeDetail, HikeSummary, HikeUpdatePayload } from "./types";

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

export function getHikes(): Promise<HikeSummary[]> {
  return fetch(`${API_BASE}/hikes`).then((r) => handle(r));
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
