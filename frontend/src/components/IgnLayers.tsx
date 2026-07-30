import { LayersControl, TileLayer } from "react-leaflet";

const IGN_MODE = import.meta.env.VITE_IGN_MODE || "geoplateforme";
const IGN_API_KEY = import.meta.env.VITE_IGN_API_KEY || "";

function ignUrl(layer: string): string {
  const base = `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer}&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png`;
  return IGN_MODE === "key" && IGN_API_KEY ? `${base}&apikey=${IGN_API_KEY}` : base;
}

/** Couches de fond de carte : OSM par défaut + IGN Plan/Photos aériennes. */
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
          url={ignUrl("ORTHOIMAGERY.ORTHOPHOTOS")}
          maxZoom={19}
        />
      </LayersControl.BaseLayer>
      <LayersControl.BaseLayer name="IGN - Cartes topo (SCAN)">
        <TileLayer
          attribution='&copy; <a href="https://www.ign.fr">IGN</a> - Géoplateforme'
          url={ignUrl("GEOGRAPHICALGRIDSYSTEMS.MAPS")}
          maxZoom={18}
        />
      </LayersControl.BaseLayer>
    </LayersControl>
  );
}
