import { POI_CATEGORIES } from "../poi";

interface Props {
  radius: number;
  setRadius: (n: number) => void;
  categories: Set<string>;
  toggleCategory: (key: string) => void;
  onSearch: () => void;
  loading: boolean;
  searchDisabled?: boolean;
  foundCount: number;
  onClearFound: () => void;
}

export function PoiSearchControls({
  radius,
  setRadius,
  categories,
  toggleCategory,
  onSearch,
  loading,
  searchDisabled,
  foundCount,
  onClearFound,
}: Props) {
  return (
    <div style={{ marginBottom: 8, padding: 8, border: "1px solid #ddd", borderRadius: 6 }}>
      <strong>Points d'intérêt</strong> — recherche façon OnRouteMap (données OpenStreetMap) le long du tracé.
      <br />
      <label>
        Rayon de recherche : {radius} m
        <br />
        <input
          type="range"
          min={100}
          max={3000}
          step={100}
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
        />
      </label>
      <div style={{ margin: "8px 0" }}>
        {POI_CATEGORIES.map((c) => (
          <label key={c.key} style={{ display: "inline-block", width: 220 }}>
            <input type="checkbox" checked={categories.has(c.key)} onChange={() => toggleCategory(c.key)} /> {c.label}
          </label>
        ))}
      </div>
      <button type="button" onClick={onSearch} disabled={searchDisabled || categories.size === 0 || loading}>
        {loading ? "Recherche…" : "Rechercher les points d'intérêt"}
      </button>{" "}
      {foundCount > 0 && (
        <>
          {foundCount} trouvé(s).{" "}
          <button type="button" onClick={onClearFound}>
            Tout retirer
          </button>
        </>
      )}
    </div>
  );
}
