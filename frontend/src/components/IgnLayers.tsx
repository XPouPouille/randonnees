import { useEffect, useState } from "react";
import { GeoJSON, LayersControl, TileLayer } from "react-leaflet";
import type { GeoJsonObject } from "geojson";

const IGN_MODE = import.meta.env.VITE_IGN_MODE || "geoplateforme";
const IGN_API_KEY = import.meta.env.VITE_IGN_API_KEY || "";

// Clé publique historique de l'IGN pour les cartes SCAN (pas de compte
// requis, distribuée officiellement pour un usage libre depuis des années -
// la couche "GEOGRAPHICALGRIDSYSTEMS.MAPS" n'est pas exposée sur l'endpoint
// "Essentiels" sans clé, contrairement au Plan et aux photos aériennes).
const IGN_SCAN_KEY = "ign_scan_ws";

interface IgnLayerOptions {
  format?: "png" | "jpeg";
  useScanKey?: boolean;
}

function ignUrl(layer: string, { format = "png", useScanKey = false }: IgnLayerOptions = {}): string {
  const host = useScanKey ? "https://data.geopf.fr/private/wmts" : "https://data.geopf.fr/wmts";
  const params = new URLSearchParams({
    SERVICE: "WMTS",
    REQUEST: "GetTile",
    VERSION: "1.0.0",
    LAYER: layer,
    STYLE: "normal",
    TILEMATRIXSET: "PM",
    FORMAT: `image/${format}`,
  });
  if (useScanKey) {
    params.set("apikey", IGN_SCAN_KEY);
  } else if (IGN_MODE === "key" && IGN_API_KEY) {
    params.set("apikey", IGN_API_KEY);
  }
  return `${host}?${params.toString()}&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}`;
}

function NationalParksOverlay() {
  const [data, setData] = useState<GeoJsonObject | null>(null);

  useEffect(() => {
    fetch("/parcs-nationaux.geojson")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data) return null;
  return (
    <LayersControl.Overlay name="Parcs nationaux">
      <GeoJSON
        data={data}
        style={{ color: "#2e7d32", weight: 1.5, fillColor: "#2e7d32", fillOpacity: 0.25 }}
        onEachFeature={(feature, layer) => {
          if (feature.properties?.name) layer.bindTooltip(feature.properties.name);
        }}
      />
    </LayersControl.Overlay>
  );
}

/** Couches de fond de carte : OSM par défaut + IGN Plan/Photos aériennes/SCAN,
 * plus la couche superposable des parcs nationaux (case à cocher). */
export function BaseLayers() {
  return (
    <LayersControl position="topright">
      <LayersControl.BaseLayer checked name="OpenStreetMap">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      </LayersControl.BaseLayer>
      <LayersControl.BaseLayer name="IGN - Plan">
        <TileLayer
          attribution='&copy; <a href="https://www.ign.fr">IGN</a> - Géoplateforme'
          url={ignUrl("GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2")}
          maxZoom={19}
        />
      </LayersControl.BaseLayer>
      <LayersControl.BaseLayer name="IGN - Photos aériennes">
        <TileLayer
          attribution='&copy; <a href="https://www.ign.fr">IGN</a> - Géoplateforme'
          url={ignUrl("ORTHOIMAGERY.ORTHOPHOTOS", { format: "jpeg" })}
          maxZoom={19}
        />
      </LayersControl.BaseLayer>
      <LayersControl.BaseLayer name="IGN - Cartes topo (SCAN)">
        <TileLayer
          attribution='&copy; <a href="https://www.ign.fr">IGN</a> - Géoplateforme'
          url={ignUrl("GEOGRAPHICALGRIDSYSTEMS.MAPS", { format: "jpeg", useScanKey: true })}
          maxZoom={18}
        />
      </LayersControl.BaseLayer>
      <NationalParksOverlay />
    </LayersControl>
  );
}
