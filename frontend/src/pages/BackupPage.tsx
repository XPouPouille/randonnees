import { useState } from "react";
import { Link } from "react-router-dom";
import { exportBackup, importBackup } from "../api";
import { useAuth } from "../auth";

export function BackupPage() {
  const { email } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const blob = await exportBackup();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `randonnees-backup-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  }

  async function handleImportFile(file: File) {
    if (
      !confirm(
        "Restaurer cette sauvegarde va REMPLACER toutes les randonnées et tout le matériel actuels. Continuer ?"
      )
    ) {
      return;
    }
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      const res = await importBackup(file);
      setResult(
        `${res.hikes_imported} randonnée(s) restaurée(s)` +
          (res.hikes_skipped ? ` (${res.hikes_skipped} ignorée(s), GPX manquant)` : "") +
          `, ${res.equipment_items} article(s) de matériel.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  }

  if (!email) {
    return (
      <div>
        <h2>Sauvegarde</h2>
        <p>
          <Link to="/connexion">Connecte-toi</Link> pour accéder à la sauvegarde/restauration.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2>Sauvegarde</h2>

      <p>
        <button type="button" onClick={handleExport} disabled={exporting}>
          {exporting ? "Préparation…" : "💾 Télécharger la sauvegarde"}
        </button>
      </p>
      <p>
        <small>
          Fichier .zip : randonnées (GPX, POI, liens) et matériel, dans deux fichiers séparés (hikes.json /
          equipment.json).
        </small>
      </p>

      <p>
        <label>
          📤 Restaurer une sauvegarde (.zip)
          <br />
          <input
            type="file"
            accept=".zip"
            disabled={importing}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportFile(file);
              e.target.value = "";
            }}
          />
        </label>
      </p>
      <p>
        <small style={{ color: "#b71c1c" }}>
          Attention : la restauration remplace toutes les randonnées et tout le matériel actuels.
        </small>
      </p>

      {importing && <p><em>Restauration en cours…</em></p>}
      {result && <p style={{ color: "green" }}>{result}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
