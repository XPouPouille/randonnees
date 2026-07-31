// Catégories de points d'intérêt, alignées sur celles d'OnRouteMap
// (onroutemap.de), qui puise ses données dans OpenStreetMap comme notre
// backend (API Overpass). Les clés correspondent à app/services.py
// (POI_CATEGORIES) côté backend.

export interface PoiCategoryDef {
  key: string;
  label: string;
  defaultOn: boolean;
}

export const POI_CATEGORIES: PoiCategoryDef[] = [
  { key: "supermarket", label: "Supermarché", defaultOn: true },
  { key: "gas_station", label: "Station essence", defaultOn: true },
  { key: "bakery", label: "Boulangerie", defaultOn: true },
  { key: "cafe", label: "Café", defaultOn: true },
  { key: "ice_cream", label: "Glacier", defaultOn: true },
  { key: "drinking_water", label: "Eau potable", defaultOn: true },
  { key: "beverages", label: "Magasin de boissons", defaultOn: true },
  { key: "cemetery", label: "Cimetière", defaultOn: true },
  { key: "kiosk", label: "Kiosque", defaultOn: true },
  { key: "vending_machine", label: "Distributeur automatique", defaultOn: true },
  { key: "toilets", label: "Toilettes", defaultOn: true },
  { key: "fast_food", label: "Fast-food", defaultOn: true },
  { key: "restaurant", label: "Restaurant", defaultOn: false },
  { key: "mountain_hut", label: "Refuge de montagne", defaultOn: false },
  { key: "bicycle_service", label: "Réparation vélo", defaultOn: false },
  { key: "hotel", label: "Hôtel / chambre d'hôtes", defaultOn: false },
  { key: "camp_site", label: "Camping", defaultOn: false },
  { key: "shelter", label: "Abri", defaultOn: false },
];

export const POI_LABELS: Record<string, string> = Object.fromEntries(
  POI_CATEGORIES.map((c) => [c.key, c.label])
);

export const DEFAULT_POI_CATEGORIES = POI_CATEGORIES.filter((c) => c.defaultOn).map((c) => c.key);
