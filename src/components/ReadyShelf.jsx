import {
  Cloud,
  PackageCheck,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  deleteReadyShelfItem,
  listReadyShelfItems,
  saveReadyShelfItem,
} from "../lib/cloud";
import { shelfAgeLabel } from "../lib/pickupHours";
import { EmptyState, Modal } from "./Primitives";

function todayKey() {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function blankShelfItem() {
  return {
    name: "",
    description: "",
    baked_on: todayKey(),
    quantity: 1,
    price: 13,
    active: true,
    isNew: true,
  };
}

export function ReadyShelf({ cloudAccount, enabled = true, onShelfChange }) {
  const bakeryId = cloudAccount.workspace?.bakeryId;
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadShelf = useCallback(async () => {
    if (!bakeryId) {
      setItems([]);
      onShelfChange?.([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const nextItems = await listReadyShelfItems(bakeryId);
      setItems(nextItems);
      onShelfChange?.(nextItems);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setLoading(false);
    }
  }, [bakeryId, onShelfChange]);

  useEffect(() => {
    loadShelf();
  }, [loadShelf]);

  async function submitShelfItem(event) {
    event.preventDefault();
    setError("");
    try {
      await saveReadyShelfItem(bakeryId, {
        ...form,
        name: form.name.trim(),
        description: form.description.trim(),
        quantity: Number(form.quantity),
        price_cents: Math.round(Number(form.price) * 100),
      });
      setForm(null);
      await loadShelf();
    } catch (nextError) {
      setError(nextError.message);
    }
  }

  async function removeShelfItem(item) {
    setError("");
    try {
      await deleteReadyShelfItem(item.id);
      await loadShelf();
    } catch (nextError) {
      setError(nextError.message);
    }
  }

  return (
    <section className="ready-shelf-panel">
      <div className="section-title-line">
        <div>
          <span className="eyebrow-label dark">Prebaked inventory</span>
          <h2>Ready-to-go shelf</h2>
          <small>Fresh stock customers can reserve without using bake capacity.</small>
        </div>
        <button
          type="button"
          className="round-action small"
          disabled={!bakeryId || !enabled}
          onClick={() => setForm(blankShelfItem())}
          aria-label="Add a loaf to the ready shelf"
        >
          <Plus size={18} />
        </button>
      </div>

      {!enabled ? (
        <div className="shelf-cloud-note"><PackageCheck size={17} /><span>The customer shelf is hidden. Turn it on in Bakery Settings when you have prebaked stock.</span></div>
      ) : null}
      {!bakeryId ? (
        <div className="shelf-cloud-note"><Cloud size={17} /><span>Sign in to your bakery cloud account to stock the public shelf.</span></div>
      ) : null}
      {loading ? <p className="shelf-loading">Checking the shelf…</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <div className={enabled ? "ready-shelf-list" : "ready-shelf-list feature-hidden"}>
        {items.map((item) => (
          <article className={item.active && item.quantity > 0 ? "ready-shelf-row" : "ready-shelf-row inactive"} key={item.id}>
            <span className="shelf-icon"><PackageCheck size={20} /></span>
            <span className="shelf-copy">
              <strong>{item.name}</strong>
              <small>{shelfAgeLabel(item.baked_on)} · {item.quantity} ready · {item.active ? "Visible to customers" : "Hidden"}</small>
            </span>
            <strong>${(Number(item.price_cents || 0) / 100).toFixed(2)}</strong>
            <button type="button" onClick={() => setForm({ ...item, price: Number(item.price_cents || 0) / 100, isNew: false })} aria-label={`Edit ${item.name}`}><Pencil size={15} /></button>
          </article>
        ))}
        {!loading && bakeryId && !items.length ? <EmptyState title="The shelf is empty" body="Add baked loaves, their bake date, quantity, and current shelf price." /> : null}
      </div>

      {form ? (
        <Modal title={form.isNew ? "Stock the ready shelf" : `Edit ${form.name}`} onClose={() => setForm(null)}>
          <form className="form-stack" onSubmit={submitShelfItem}>
            <label>Item name<input autoFocus required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Country sourdough" /></label>
            <label>Description<input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Crackly crust, mild tang" /></label>
            <div className="form-grid">
              <label>Baked on<input required type="date" value={form.baked_on} onChange={(event) => setForm({ ...form, baked_on: event.target.value })} /></label>
              <label>Quantity ready<input required min="0" max="24" type="number" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label>
            </div>
            <label>Price per item<input required min="0" step="0.01" type="number" value={form.price ?? Number(form.price_cents || 0) / 100} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label>
            <label className="checkbox-line"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /><span>Show this item on the customer shelf</span></label>
            <p className="form-help">{shelfAgeLabel(form.baked_on)}. Setting quantity to zero will mark it sold out.</p>
            <button className="primary-button" type="submit">Save shelf item</button>
            {!form.isNew ? <button className="delete-order-button" type="button" onClick={() => {
              removeShelfItem(form);
              setForm(null);
            }}><Trash2 size={15} /> Remove from shelf</button> : null}
          </form>
        </Modal>
      ) : null}
    </section>
  );
}
