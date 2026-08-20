import { useEffect, useState } from "react";
import { GeoJSON, LayersControl, TileLayer, useMap } from "react-leaflet";
import type { GeoJsonObject } from "geojson";

const IGN_MODE = import.meta.env.VITE_IGN_MODE || "geoplateforme";
const IGN_API_KEY = import.meta.env.VITE_IGN_API_KEY || "";

// OpenCycleMap (Thunderforest) exige une clé API (gratuite, thunderforest.com/docs/apikeys)
// contrairement aux couches IGN ci-dessus : sans clé configurée les tuiles ne se chargent pas.
const THUNDERFOREST_API_KEY = import.meta.env.VITE_THUNDERFOREST_API_KEY || "";

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

/** Couches de fond de carte : OSM par défaut + IGN Plan/Photos aériennes/SCAN. */
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
      <LayersControl.BaseLayer name="IGN - TOP25">
        <TileLayer
          attribution='&copy; <a href="https://www.ign.fr">IGN</a> - Géoplateforme'
          url={ignUrl("GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN25TOUR", { format: "jpeg", useScanKey: true })}
          maxZoom={17}
        />
      </LayersControl.BaseLayer>
      <LayersControl.BaseLayer name="OpenCycleMap">
        <TileLayer
          attribution='&copy; <a href="https://www.thunderforest.com">Thunderforest</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url={`https://{s}.tile.thunderforest.com/cycle/{z}/{x}/{y}.png${THUNDERFOREST_API_KEY ? `?apikey=${THUNDERFOREST_API_KEY}` : ""}`}
          maxZoom={22}
        />
      </LayersControl.BaseLayer>
    </LayersControl>
  );
}

interface ParkLayerToggleProps {
  label: string;
  geojsonUrl: string;
  color: string;
  fillOpacity: number;
  marginTop: number;
}

/** Bouton visible (coin haut-gauche de la carte) pour afficher/masquer une
 * couche de zones de parc national (vert semi-transparent), à placer comme
 * enfant direct d'un MapContainer, à côté de BaseLayers. */
function ParkLayerToggle({ label, geojsonUrl, color, fillOpacity, marginTop }: ParkLayerToggleProps) {
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState<GeoJsonObject | null>(null);

  useEffect(() => {
    if (!visible || data) return;
    fetch(geojsonUrl)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, [visible, data, geojsonUrl]);

  return (
    <>
      <div className="leaflet-top leaflet-left" style={{ marginTop }}>
        <div className="leaflet-control leaflet-bar">
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            style={{
              padding: "6px 10px",
              background: visible ? color : "#fff",
              color: visible ? "#fff" : "#000",
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              whiteSpace: "nowrap",
            }}
          >
            🌳 {label}
          </button>
        </div>
      </div>
      {visible && data && (
        <GeoJSON
          data={data}
          style={{ color, weight: 1.5, fillColor: color, fillOpacity }}
          onEachFeature={(feature, layer) => {
            if (feature.properties?.name) layer.bindTooltip(feature.properties.name);
          }}
        />
      )}
    </>
  );
}

/** Cœur des parcs nationaux (zone terrestre + marine, protection stricte). */
export function NationalParksToggle() {
  return (
    <ParkLayerToggle
      label="Parcs nationaux"
      geojsonUrl="/parcs-nationaux.geojson"
      color="#1b5e20"
      fillOpacity={0.3}
      marginTop={70}
    />
  );
}

/** Aires d'adhésion (zone périphérique, réglementation plus légère) - vert
 * plus clair que le cœur de parc pour bien les distinguer. */
export function NationalParksAdhesionToggle() {
  return (
    <ParkLayerToggle
      label="Aires d'adhésion"
      geojsonUrl="/parcs-nationaux-adhesion.geojson"
      color="#8bc34a"
      fillOpacity={0.25}
      marginTop={104}
    />
  );
}

/** Bouton plein écran (API Fullscreen native du navigateur) sur le conteneur
 * de la carte, à placer comme enfant direct d'un MapContainer. */
export function FullscreenToggle() {
  const map = useMap();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const container = map.getContainer();
    function handleChange() {
      const active = document.fullscreenElement === container;
      setIsFullscreen(active);
      // La carte doit recalculer sa taille une fois la transition terminée.
      setTimeout(() => map.invalidateSize(), 100);
    }
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, [map]);

  function toggle() {
    const container = map.getContainer();
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen();
    }
  }

  return (
    <div className="leaflet-top leaflet-left" style={{ marginTop: 172 }}>
      <div className="leaflet-control leaflet-bar">
        <button
          type="button"
          onClick={toggle}
          style={{
            padding: "6px 10px",
            background: "#fff",
            color: "#000",
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            whiteSpace: "nowrap",
          }}
        >
          {isFullscreen ? "⛶ Quitter le plein écran" : "⛶ Plein écran"}
        </button>
      </div>
    </div>
  );
}
