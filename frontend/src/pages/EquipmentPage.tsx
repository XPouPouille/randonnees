import { useEffect, useMemo, useState } from "react";
import {
  createEquipmentCategory,
  createEquipmentItem,
  deleteEquipmentCategory,
  deleteEquipmentItem,
  getEquipment,
  getEquipmentCategories,
  renameEquipmentCategory,
  reorderEquipment,
  reorderEquipmentCategories,
  updateEquipmentItem,
} from "../api";
import type { EquipmentCategory, EquipmentItem } from "../types";

const UNCATEGORIZED = "uncategorized";

export function EquipmentPage() {
  const [categories, setCategories] = useState<EquipmentCategory[]>([]);
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newQuantity, setNewQuantity] = useState(1);
  const [newCategoryId, setNewCategoryId] = useState<string>(UNCATEGORIZED);
  const [adding, setAdding] = useState(false);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);

  useEffect(() => {
    Promise.all([getEquipmentCategories(), getEquipment()])
      .then(([cats, its]) => {
        setCategories(cats);
        setItems(its);
      })
      .catch((e) => setError(e.message));
  }, []);

  function itemsFor(categoryId: number | null): EquipmentItem[] {
    return items.filter((i) => i.category_id === categoryId).sort((a, b) => a.position - b.position);
  }

  function mergeItems(updated: EquipmentItem[]) {
    const byId = new Map(updated.map((i) => [i.id, i]));
    setItems((prev) => prev.map((i) => byId.get(i.id) ?? i));
  }

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setAddingCategory(true);
    setError(null);
    try {
      const cat = await createEquipmentCategory(newCategoryName.trim());
      setCategories((prev) => [...prev, cat]);
      setNewCategoryName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAddingCategory(false);
    }
  }

  async function handleRenameCategory(cat: EquipmentCategory) {
    const name = window.prompt("Nouveau nom de la catégorie", cat.name);
    if (!name || !name.trim() || name.trim() === cat.name) return;
    try {
      const updated = await renameEquipmentCategory(cat.id, name.trim());
      setCategories((prev) => prev.map((c) => (c.id === cat.id ? updated : c)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDeleteCategory(cat: EquipmentCategory) {
    if (!confirm(`Supprimer la catégorie "${cat.name}" ? Les items repasseront sans catégorie.`)) return;
    try {
      await deleteEquipmentCategory(cat.id);
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      setItems((prev) => prev.map((i) => (i.category_id === cat.id ? { ...i, category_id: null } : i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function moveCategory(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= categories.length) return;
    const reordered = [...categories];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setCategories(reordered);
    try {
      await reorderEquipmentCategories(reordered.map((c) => c.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setCategories(categories);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const categoryId = newCategoryId === UNCATEGORIZED ? null : Number(newCategoryId);
      const item = await createEquipmentItem(newName.trim(), newQuantity, categoryId);
      setItems((prev) => [...prev, item]);
      setNewName("");
      setNewQuantity(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAdding(false);
    }
  }

  async function toggleChecked(item: EquipmentItem) {
    try {
      const updated = await updateEquipmentItem(item.id, { checked: !item.checked });
      mergeItems([updated]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function changeQuantity(item: EquipmentItem, quantity: number) {
    if (quantity < 1) return;
    try {
      const updated = await updateEquipmentItem(item.id, { quantity });
      mergeItems([updated]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function changeItemCategory(item: EquipmentItem, categoryValue: string) {
    const categoryId = categoryValue === UNCATEGORIZED ? null : Number(categoryValue);
    if (categoryId === item.category_id) return;
    try {
      const updated = await updateEquipmentItem(item.id, { category_id: categoryId });
      mergeItems([updated]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteEquipmentItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function moveItem(categoryId: number | null, list: EquipmentItem[], index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    const reordered = [...list];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    mergeItems(reordered);
    try {
      const updated = await reorderEquipment(categoryId, reordered.map((i) => i.id));
      mergeItems(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      mergeItems(list);
    }
  }

  const groups = useMemo(
    () => [...categories.map((c) => ({ category: c as EquipmentCategory | null })), { category: null }],
    [categories]
  );

  return (
    <div>
      <h2>Matériel</h2>

      <form onSubmit={handleAddCategory} style={{ marginBottom: 16 }}>
        <input
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          placeholder="Nouvelle catégorie"
          style={{ width: 200, marginRight: 8 }}
        />
        <button type="submit" disabled={addingCategory || !newCategoryName.trim()}>
          {addingCategory ? "Création…" : "Créer une catégorie"}
        </button>
      </form>

      <form onSubmit={handleAdd} style={{ marginBottom: 16 }}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Désignation"
          style={{ width: 220, marginRight: 8 }}
        />
        <input
          type="number"
          min={1}
          value={newQuantity}
          onChange={(e) => setNewQuantity(Math.max(1, Number(e.target.value)))}
          style={{ width: 70, marginRight: 8 }}
        />
        <select value={newCategoryId} onChange={(e) => setNewCategoryId(e.target.value)} style={{ marginRight: 8 }}>
          <option value={UNCATEGORIZED}>Sans catégorie</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="submit" disabled={adding || !newName.trim()}>
          {adding ? "Ajout…" : "Ajouter"}
        </button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {groups.map(({ category }, catIndex) => {
        const list = itemsFor(category ? category.id : null);
        return (
          <div key={category ? category.id : "none"} style={{ marginBottom: 24 }}>
            <h3>
              {category ? category.name : "Sans catégorie"}
              {category && (
                <>
                  {" "}
                  <button type="button" onClick={() => moveCategory(catIndex, -1)} disabled={catIndex === 0}>
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveCategory(catIndex, 1)}
                    disabled={catIndex === categories.length - 1}
                  >
                    ↓
                  </button>{" "}
                  <button type="button" onClick={() => handleRenameCategory(category)}>
                    ✏️
                  </button>{" "}
                  <button type="button" onClick={() => handleDeleteCategory(category)}>
                    🗑️ catégorie
                  </button>
                </>
              )}
            </h3>

            {list.length === 0 ? (
              <p>
                <em>Aucun item.</em>
              </p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                    <th></th>
                    <th></th>
                    <th>Désignation</th>
                    <th>Quantité</th>
                    <th>Catégorie</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((item, index) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          onClick={() => moveItem(category ? category.id : null, list, index, -1)}
                          disabled={index === 0}
                          aria-label="Monter"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveItem(category ? category.id : null, list, index, 1)}
                          disabled={index === list.length - 1}
                          aria-label="Descendre"
                        >
                          ↓
                        </button>
                      </td>
                      <td>
                        <input type="checkbox" checked={item.checked} onChange={() => toggleChecked(item)} />
                      </td>
                      <td style={{ textDecoration: item.checked ? "line-through" : undefined }}>{item.name}</td>
                      <td>
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => changeQuantity(item, Number(e.target.value))}
                          style={{ width: 60 }}
                        />
                      </td>
                      <td>
                        <select
                          value={item.category_id ?? UNCATEGORIZED}
                          onChange={(e) => changeItemCategory(item, e.target.value)}
                        >
                          <option value={UNCATEGORIZED}>Sans catégorie</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button type="button" onClick={() => handleDelete(item.id)} aria-label="Supprimer">
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}
