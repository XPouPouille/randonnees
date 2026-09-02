import { useEffect, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Carte topo officielle IGAC (institut géographique colombien), en vector
// tiles (pas de raster keyless équivalent TOP25 trouvé côté IGAC - leur
// service raster détaillé est verrouillé). maplibre-gl + son plugin Leaflet
// sont chargés à la demande (import dynamique) pour ne pas alourdir le
// bundle principal pour une fonctionnalité que la plupart des visiteurs
// n'utiliseront jamais.
const IGAC_VECTOR_TILE_SERVER =
  "https://tiles.arcgis.com/tiles/RVvWzU3lgJISqdke/arcgis/rest/services/Mapa_base_topografico/VectorTileServer";
const IGAC_STYLE_URL = `${IGAC_VECTOR_TILE_SERVER}/resources/styles/root.json`;

// Le style publié par Esri utilise un pointeur "url": "../../" vers le
// service pour sa source vectorielle - une convention propre aux clients
// ArcGIS (Esri JS API, esri-leaflet-vector), que MapLibre GL ne sait pas
// résoudre tel quel (testé : erreur "Invalid sprite URL" / 404 sur "../../").
// On remplace la source par une définition vectorielle standard (tiles +
// bounds) et on passe sprite/glyphs en URLs absolues.
async function loadIgacStyle(): Promise<StyleSpecification> {
  const res = await fetch(IGAC_STYLE_URL);
  if (!res.ok) throw new Error(`Style IGAC indisponible (${res.status})`);
  const style = await res.json();
  style.sources.esri = {
    type: "vector",
    tiles: [`${IGAC_VECTOR_TILE_SERVER}/tile/{z}/{y}/{x}.pbf`],
    minzoom: 0,
    maxzoom: 20,
    bounds: [-180, -85.0511, 180, 85.0511],
  };
  style.sprite = `${IGAC_VECTOR_TILE_SERVER}/resources/sprites/sprite`;
  style.glyphs = `${IGAC_VECTOR_TILE_SERVER}/resources/fonts/{fontstack}/{range}.pbf`;
  return style as StyleSpecification;
}

/** Bouton "🇨🇴 Colombie (IGAC)" : charge/affiche à la demande la carte
 * topographique vectorielle officielle IGAC, en supplément des autres
 * fonds de carte (ne remplace rien). */
export function ColombiaVectorToggle() {
  const map = useMap();
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const layerRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    return () => {
      layerRef.current?.remove();
      layerRef.current = null;
    };
  }, [map]);

  async function toggle() {
    if (active) {
      layerRef.current?.remove();
      layerRef.current = null;
      setActive(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [{ maplibreGL }, style] = await Promise.all([
        import("@maplibre/maplibre-gl-leaflet"),
        loadIgacStyle(),
      ]);
      const layer = maplibreGL({ style }).addTo(map);
      layerRef.current = layer;
      setActive(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="leaflet-top leaflet-left" style={{ marginTop: 240 }}>
      <div className="leaflet-control leaflet-bar">
        <button
          type="button"
          onClick={toggle}
          disabled={loading}
          style={{
            padding: "6px 10px",
            background: active ? "#fcc419" : "#fff",
            color: "#000",
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            whiteSpace: "nowrap",
          }}
        >
          {loading ? "Chargement…" : `🇨🇴 Colombie (IGAC)${active ? " ✓" : ""}`}
        </button>
      </div>
      {error && (
        <div
          style={{
            background: "#fff",
            color: "#b71c1c",
            padding: "4px 8px",
            fontSize: 12,
            maxWidth: 220,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
