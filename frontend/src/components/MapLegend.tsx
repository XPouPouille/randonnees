import { useState } from "react";
import { useMapEvent } from "react-leaflet";

interface LegendDef {
  items: { color: string; label: string }[];
  officialUrl?: string;
  officialLabel?: string;
}

// Légendes simplifiées (conventions cartographiques bien établies pour
// chaque source) ; le lien officiel donne le détail complet et à jour.
const LEGENDS: Record<string, LegendDef> = {
  OpenStreetMap: {
    items: [
      { color: "#8bc34a", label: "Espaces verts, forêts, parcs" },
      { color: "#7fc1e3", label: "Cours d'eau, plans d'eau" },
      { color: "#e8dfc8", label: "Zones bâties" },
      { color: "#f6a94a", label: "Routes principales" },
    ],
    officialUrl: "https://wiki.openstreetmap.org/wiki/FR:Standard_tile_layer",
    officialLabel: "Légende complète (wiki OpenStreetMap)",
  },
  "IGN - Plan": {
    items: [
      { color: "#8bc34a", label: "Végétation" },
      { color: "#7fc1e3", label: "Hydrographie" },
      { color: "#b0b0b0", label: "Bâti" },
      { color: "#e05a3a", label: "Routes (selon importance)" },
    ],
    officialUrl: "https://www.ign.fr/publications-de-l-ign/institut/Ressources_pedagogiques/legende_cartes_1.pdf",
    officialLabel: "Légende officielle IGN (PDF)",
  },
  "IGN - Photos aériennes": {
    items: [],
  },
  "IGN - Cartes topo (SCAN)": {
    items: [
      { color: "#a9673f", label: "Courbes de niveau (relief)" },
      { color: "#8bc34a", label: "Forêt, végétation" },
      { color: "#7fc1e3", label: "Hydrographie" },
      { color: "#333333", label: "Bâti, éléments culturels" },
      { color: "#e05a3a", label: "Routes et sentiers (selon catégorie)" },
    ],
    officialUrl: "https://www.ign.fr/publications-de-l-ign/institut/Ressources_pedagogiques/legende_cartes_1.pdf",
    officialLabel: "Légende officielle IGN (PDF)",
  },
  OpenCycleMap: {
    items: [
      { color: "#a9673f", label: "Courbes de niveau (relief)" },
      { color: "#c0392b", label: "Itinéraire cyclable national" },
      { color: "#2980b9", label: "Itinéraire cyclable régional" },
      { color: "#8e44ad", label: "Itinéraire cyclable local" },
    ],
    officialUrl: "https://www.opencyclemap.org/docs/",
    officialLabel: "Légende complète (opencyclemap.org)",
  },
};

/** Bouton + panneau légende (coin haut-gauche), affiche le code couleur du
 * fond de carte actuellement sélectionné. À placer comme enfant direct d'un
 * MapContainer, à côté de BaseLayers. */
export function MapLegend() {
  const [activeLayer, setActiveLayer] = useState("OpenStreetMap");
  const [open, setOpen] = useState(false);

  useMapEvent("baselayerchange", (e) => setActiveLayer(e.name));

  const legend = LEGENDS[activeLayer];

  return (
    <div className="leaflet-top leaflet-left" style={{ marginTop: 138 }}>
      <div className="leaflet-control leaflet-bar">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            padding: "6px 10px",
            background: open ? "#455a64" : "#fff",
            color: open ? "#fff" : "#000",
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            whiteSpace: "nowrap",
          }}
        >
          📖 Légende
        </button>
        {open && (
          <div style={{ background: "#fff", padding: 10, minWidth: 220, color: "#000", fontSize: 13 }}>
            <strong>{activeLayer}</strong>
            {legend && legend.items.length > 0 ? (
              <ul style={{ listStyle: "none", margin: "6px 0", padding: 0 }}>
                {legend.items.map((item) => (
                  <li key={item.label} style={{ marginBottom: 4 }}>
                    <span
                      style={{
                        display: "inline-block",
                        width: 12,
                        height: 12,
                        background: item.color,
                        marginRight: 6,
                        verticalAlign: "middle",
                      }}
                    />
                    {item.label}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: "6px 0" }}>
                <em>Photo aérienne : pas de code couleur cartographique.</em>
              </p>
            )}
            {legend?.officialUrl && (
              <a href={legend.officialUrl} target="_blank" rel="noreferrer">
                {legend.officialLabel} →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
