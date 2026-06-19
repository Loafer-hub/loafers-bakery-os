import {
  Box,
  CalendarDays,
  CircleDollarSign,
  LineChart,
  Package,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeading } from "../components/AppChrome";
import { EmptyState, Modal } from "../components/Primitives";

const emptyInventoryItem = {
  id: "",
  name: "",
  amount: 0,
  unit: "kg",
  target: 1,
  unitCost: 0,
};

function weekKey(date) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() - value.getDay());
  value.setHours(0, 0, 0, 0);
  return value.toISOString().slice(0, 10);
}

function spendingSeries(expenses) {
  const weeks = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (5 - index) * 7);
    const key = weekKey(date.toISOString().slice(0, 10));
    return {
      key,
      label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      total: 0,
    };
  });
  const byWeek = new Map(weeks.map((week) => [week.key, week]));
  expenses.forEach((expense) => {
    const week = byWeek.get(weekKey(expense.date));
    if (week) week.total += Number(expense.totalCost || 0);
  });
  return weeks;
}

export default function MorePage({
  expenses,
  inventory,
  orders,
  onDeleteExpense,
  onDeleteInventoryItem,
  onLogExpense,
  onSaveInventoryItem,
}) {
  const [inventoryForm, setInventoryForm] = useState(null);
  const [purchaseForm, setPurchaseForm] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const repeatCustomers = new Set(orders.map((order) => order.customer)).size;
  const revenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.totalCost || 0), 0);
  const inventoryValue = inventory.reduce((sum, item) => (
    sum + Number(item.amount || 0) * Number(item.unitCost || 0)
  ), 0);
  const weeks = useMemo(() => spendingSeries(expenses), [expenses]);
  const maximumSpend = Math.max(1, ...weeks.map((week) => week.total));
  const recentSpend = weeks.reduce((sum, week) => sum + week.total, 0);

  function editInventory(item) {
    setInventoryForm(item ? { ...item, isNew: false } : {
      ...emptyInventoryItem,
      id: `inventory-${Date.now()}`,
      isNew: true,
    });
    setConfirmDeleteId(null);
  }

  function openPurchase(item) {
    setPurchaseForm({
      inventoryId: item?.id || inventory[0]?.id || "",
      date: new Date().toISOString().slice(0, 10),
      quantity: 1,
      totalCost: Number(item?.unitCost || inventory[0]?.unitCost || 0),
      note: "",
    });
  }

  return (
    <main className="page">
      <PageHeading title="Trends" subtitle="Costs, stock, sales, and the pulse of your one-person bakery." />

      <section className="trend-card">
        <div className="section-title-line">
          <div><span className="eyebrow-label">Current order book</span><h2>Revenue and spend</h2></div>
          <LineChart size={23} />
        </div>
        <div className="trend-number"><strong>${revenue.toFixed(2)}</strong><span>${totalExpenses.toFixed(2)} recorded expenses</span></div>
        <div className="finance-summary-line"><span>Net before unlogged costs</span><strong>${(revenue - totalExpenses).toFixed(2)}</strong></div>
      </section>

      <section className="quick-metrics">
        <div><CircleDollarSign /><strong>${inventoryValue.toFixed(0)}</strong><span>stock value</span></div>
        <div><Box /><strong>{orders.reduce((sum, order) => sum + Number(order.quantity || 0), 0)}</strong><span>loaves ordered</span></div>
        <div><UsersRound /><strong>{repeatCustomers}</strong><span>active customers</span></div>
      </section>

      <section className="spending-card">
        <div className="section-title-line">
          <div><span className="eyebrow-label dark">6-week expenditure</span><h2>Purchases</h2></div>
          <button type="button" className="small-action-button" onClick={() => openPurchase()} disabled={!inventory.length}><Receipt size={15} /> Log purchase</button>
        </div>
        <div className="spending-total"><strong>${recentSpend.toFixed(2)}</strong><span>last six weeks</span></div>
        <div className="spending-bars" role="img" aria-label={`Six week expenditure totaling $${recentSpend.toFixed(2)}`}>
          {weeks.map((week) => (
            <div key={week.key}>
              <span className="spending-bar-value">{week.total ? `$${week.total.toFixed(0)}` : ""}</span>
              <i style={{ height: `${Math.max(4, week.total / maximumSpend * 100)}%` }} />
              <small>{week.label}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="inventory-section">
        <div className="section-title-line">
          <div><h2>Inventory</h2><small>${inventoryValue.toFixed(2)} estimated on hand</small></div>
          <button type="button" className="round-action small" onClick={() => editInventory()} aria-label="Add inventory item"><Plus size={18} /></button>
        </div>
        <div className="inventory-list">
          {inventory.map((item) => (
            <button className="inventory-row" key={item.id} type="button" onClick={() => editInventory(item)}>
              <Package size={18} />
              <span><strong>{item.name}</strong><small>Target {item.target} {item.unit} · ${Number(item.unitCost || 0).toFixed(2)} / {item.unit}</small></span>
              <span className={Number(item.amount) < Number(item.target) ? "inventory-low" : ""}>{item.amount} {item.unit}<small>${(Number(item.amount || 0) * Number(item.unitCost || 0)).toFixed(2)}</small></span>
              <Pencil size={14} />
            </button>
          ))}
          {!inventory.length ? <EmptyState title="No inventory yet" body="Add ingredients, packaging, and supplies to begin tracking cost." /> : null}
        </div>
      </section>

      <section className="expense-history">
        <div className="section-title-line"><h2>Purchase history</h2><CalendarDays size={18} /></div>
        {expenses.length ? expenses.slice(0, 12).map((expense) => (
          <div className="expense-row" key={expense.id}>
            <span><strong>{expense.itemName}</strong><small>{new Date(`${expense.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {expense.quantity} {expense.unit}</small></span>
            <strong>${Number(expense.totalCost || 0).toFixed(2)}</strong>
            <button type="button" aria-label={`Delete ${expense.itemName} expense`} onClick={() => onDeleteExpense(expense.id)}><Trash2 size={14} /></button>
          </div>
        )) : <EmptyState title="No purchases logged" body="Purchase logs create your expenditure chart and update inventory quantities." />}
      </section>

      {inventoryForm ? (
        <Modal title={inventoryForm.isNew ? "Add inventory item" : `Edit ${inventoryForm.name}`} onClose={() => setInventoryForm(null)}>
          <form className="form-stack" onSubmit={(event) => {
            event.preventDefault();
            onSaveInventoryItem({
              ...inventoryForm,
              name: inventoryForm.name.trim(),
              amount: Number(inventoryForm.amount),
              target: Number(inventoryForm.target),
              unitCost: Number(inventoryForm.unitCost),
            });
            setInventoryForm(null);
          }}>
            <label>Item name<input autoFocus required value={inventoryForm.name} onChange={(event) => setInventoryForm({ ...inventoryForm, name: event.target.value })} placeholder="Bread flour" /></label>
            <div className="form-grid">
              <label>Amount on hand<input type="number" min="0" step="0.01" value={inventoryForm.amount} onChange={(event) => setInventoryForm({ ...inventoryForm, amount: event.target.value })} /></label>
              <label>Unit<input value={inventoryForm.unit} onChange={(event) => setInventoryForm({ ...inventoryForm, unit: event.target.value })} placeholder="kg" /></label>
            </div>
            <div className="form-grid">
              <label>Restock target<input type="number" min="0" step="0.01" value={inventoryForm.target} onChange={(event) => setInventoryForm({ ...inventoryForm, target: event.target.value })} /></label>
              <label>Cost per {inventoryForm.unit || "unit"}<input type="number" min="0" step="0.01" value={inventoryForm.unitCost} onChange={(event) => setInventoryForm({ ...inventoryForm, unitCost: event.target.value })} /></label>
            </div>
            <button className="primary-button" type="submit">Save inventory item</button>
            {!inventoryForm.isNew ? (
              confirmDeleteId === inventoryForm.id ? (
                <div className="delete-confirmation">
                  <span>Remove this inventory item?</span>
                  <div>
                    <button type="button" className="text-button" onClick={() => setConfirmDeleteId(null)}>Keep item</button>
                    <button type="button" className="danger-button" onClick={() => {
                      onDeleteInventoryItem(inventoryForm.id);
                      setInventoryForm(null);
                    }}>Remove item</button>
                  </div>
                </div>
              ) : (
                <button className="delete-order-button" type="button" onClick={() => setConfirmDeleteId(inventoryForm.id)}><Trash2 size={15} /> Remove inventory item</button>
              )
            ) : null}
          </form>
        </Modal>
      ) : null}

      {purchaseForm ? (
        <Modal title="Log a purchase" onClose={() => setPurchaseForm(null)}>
          <form className="form-stack" onSubmit={(event) => {
            event.preventDefault();
            const item = inventory.find((entry) => entry.id === purchaseForm.inventoryId);
            if (!item) return;
            onLogExpense({
              ...purchaseForm,
              itemName: item.name,
              unit: item.unit,
              quantity: Number(purchaseForm.quantity),
              totalCost: Number(purchaseForm.totalCost),
            });
            setPurchaseForm(null);
          }}>
            <label>Inventory item<select value={purchaseForm.inventoryId} onChange={(event) => {
              const item = inventory.find((entry) => entry.id === event.target.value);
              setPurchaseForm({
                ...purchaseForm,
                inventoryId: event.target.value,
                totalCost: Number(item?.unitCost || 0) * Number(purchaseForm.quantity || 1),
              });
            }}>{inventory.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
            <label>Purchase date<input type="date" value={purchaseForm.date} onChange={(event) => setPurchaseForm({ ...purchaseForm, date: event.target.value })} /></label>
            <div className="form-grid">
              <label>Quantity purchased<input type="number" min="0.01" step="0.01" value={purchaseForm.quantity} onChange={(event) => setPurchaseForm({ ...purchaseForm, quantity: event.target.value })} /></label>
              <label>Total cost<input type="number" min="0" step="0.01" value={purchaseForm.totalCost} onChange={(event) => setPurchaseForm({ ...purchaseForm, totalCost: event.target.value })} /></label>
            </div>
            <label>Note<input value={purchaseForm.note} onChange={(event) => setPurchaseForm({ ...purchaseForm, note: event.target.value })} placeholder="Supplier, receipt, or sale price" /></label>
            <p className="form-help">Saving adds the purchased quantity to stock and updates its current cost per {inventory.find((item) => item.id === purchaseForm.inventoryId)?.unit || "unit"}.</p>
            <button className="primary-button" type="submit">Log purchase</button>
          </form>
        </Modal>
      ) : null}
    </main>
  );
}
