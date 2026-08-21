import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { addLink, createHike } from "../api";
import { useAuth } from "../auth";
import type { ActivityType } from "../types";

interface LinkRow {
  platform: string;
  url: string;
  label: string;
}

const PLATFORMS = ["komoot", "alltrails", "garmin", "visorando", "other"];

export function AddHikePage() {
  const navigate = useNavigate();
  const { email } = useAuth();
  const [name, setName] = useState("");
  const [activityType, setActivityType] = useState<ActivityType>("rando");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [durationHint, setDurationHint] = useState("");
  const [gpxFile, setGpxFile] = useState<File | null>(null);
  const [links, setLinks] = useState<LinkRow[]>([{ platform: "komoot", url: "", label: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateLink(index: number, patch: Partial<LinkRow>) {
    setLinks((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addLinkRow() {
    setLinks((rows) => [...rows, { platform: "komoot", url: "", label: "" }]);
  }

  function removeLinkRow(index: number) {
    setLinks((rows) => rows.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setError(null);

    const formData = new FormData();
    formData.set("name", name);
    formData.set("activity_type", activityType);
    if (description) formData.set("description", description);
    if (difficulty) formData.set("difficulty", difficulty);
    if (durationHint) formData.set("duration_hint", durationHint);
    if (gpxFile) formData.set("gpx_file", gpxFile);

    setSubmitting(true);
    try {
      const hike = await createHike(formData);
      for (const link of links) {
        if (link.url.trim()) {
          await addLink(hike.id, { platform: link.platform, url: link.url.trim(), label: link.label || undefined });
        }
      }
      navigate(`/hikes/${hike.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h2>Ajouter une randonnée</h2>

      {!email && (
        <p style={{ padding: 8, border: "1px solid #ddd", borderRadius: 6 }}>
          <Link to="/connexion">Connecte-toi</Link> pour pouvoir publier une randonnée.
        </p>
      )}

      <form onSubmit={handleSubmit}>
        <p>
          <label>
            Nom
            <br />
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
        </p>

        <p>
          <label>
            Description
            <br />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
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
            <input value={difficulty} onChange={(e) => setDifficulty(e.target.value)} placeholder="facile / moyen / difficile" />
          </label>
        </p>

        <p>
          <label>
            Durée estimée
            <br />
            <input value={durationHint} onChange={(e) => setDurationHint(e.target.value)} placeholder="ex: 3h30" />
          </label>
        </p>

        <p>
          <label>
            Fichier GPX (calcule automatiquement distance, dénivelé et profil)
            <br />
            <input type="file" accept=".gpx" onChange={(e) => setGpxFile(e.target.files?.[0] || null)} />
          </label>
        </p>

        <h3>Liens externes (Komoot, AllTrails, Garmin…)</h3>
        {links.map((link, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <select value={link.platform} onChange={(e) => updateLink(i, { platform: e.target.value })}>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>{" "}
            <input
              type="url"
              placeholder="https://..."
              value={link.url}
              onChange={(e) => updateLink(i, { url: e.target.value })}
              style={{ width: 300 }}
            />{" "}
            <input
              placeholder="libellé (optionnel)"
              value={link.label}
              onChange={(e) => updateLink(i, { label: e.target.value })}
            />{" "}
            <button type="button" onClick={() => removeLinkRow(i)}>
              ✕
            </button>
          </div>
        ))}
        <p>
          <button type="button" onClick={addLinkRow}>
            + Ajouter un lien
          </button>
        </p>

        {error && <p style={{ color: "red" }}>{error}</p>}

        <p>
          <button type="submit" disabled={submitting || !email}>
            {submitting ? "Envoi…" : "Publier la randonnée"}
          </button>
        </p>
      </form>
    </div>
  );
}
