import { useEffect, useState } from "react";
import { createEquipmentItem, deleteEquipmentItem, getEquipment, updateEquipmentItem } from "../api";
import type { EquipmentItem } from "../types";

export function EquipmentPage() {
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newQuantity, setNewQuantity] = useState(1);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    getEquipment().then(setItems).catch((e) => setError(e.message));
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const item = await createEquipmentItem(newName.trim(), newQuantity);
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
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function changeQuantity(item: EquipmentItem, quantity: number) {
    if (quantity < 1) return;
    try {
      const updated = await updateEquipmentItem(item.id, { quantity });
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
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

  return (
    <div>
      <h2>Matériel</h2>

      <form onSubmit={handleAdd} style={{ marginBottom: 16 }}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Désignation"
          style={{ width: 250, marginRight: 8 }}
        />
        <input
          type="number"
          min={1}
          value={newQuantity}
          onChange={(e) => setNewQuantity(Math.max(1, Number(e.target.value)))}
          style={{ width: 70, marginRight: 8 }}
        />
        <button type="submit" disabled={adding || !newName.trim()}>
          {adding ? "Ajout…" : "Ajouter"}
        </button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {items.length === 0 ? (
        <p>Aucun item pour l'instant.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
              <th></th>
              <th>Désignation</th>
              <th>Quantité</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} style={{ borderBottom: "1px solid #eee" }}>
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
}
