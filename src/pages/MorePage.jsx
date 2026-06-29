import {
  Barcode,
  Box,
  CalendarDays,
  Camera,
  CircleDollarSign,
  LineChart,
  Package,
  Pencil,
  Plus,
  Receipt,
  Settings2,
  Trash2,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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

function cleanBarcode(value) {
  return String(value || "").trim();
}

function findInventoryByBarcode(inventory, barcode) {
  const target = cleanBarcode(barcode);
  if (!target) return null;
  return inventory.find((item) => cleanBarcode(item.barcode) === target) || null;
}

function BarcodeImportPanel({ barcode, inventory, onDetected, onManualChange }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const [scannerState, setScannerState] = useState({
    error: "",
    scanning: false,
    supported: typeof window !== "undefined" && Boolean(window.BarcodeDetector),
  });

  useEffect(() => () => {
    if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
  }, []);

  function stopScanner() {
    if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    streamRef.current = null;
    setScannerState((current) => ({ ...current, scanning: false }));
  }

  async function startScanner() {
    if (!window.BarcodeDetector) {
      setScannerState({
        error: "Camera barcode scanning is not available in this browser. Type the barcode or use a Bluetooth scanner.",
        scanning: false,
        supported: false,
      });
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerState({
        error: "Camera access is not available here. Type the barcode instead.",
        scanning: false,
        supported: false,
      });
      return;
    }
    try {
      setScannerState({ error: "", scanning: true, supported: true });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const formats = await window.BarcodeDetector.getSupportedFormats?.();
      const detector = new window.BarcodeDetector({
        formats: formats?.length ? formats : ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "qr_code"],
      });
      const scan = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const results = await detector.detect(videoRef.current);
          const value = cleanBarcode(results[0]?.rawValue);
          if (value) {
            onDetected(value);
            stopScanner();
            return;
          }
        } catch (error) {
          setScannerState({
            error: error.message || "Barcode scanner could not read this frame.",
            scanning: false,
            supported: true,
          });
          stopScanner();
          return;
        }
        frameRef.current = window.requestAnimationFrame(scan);
      };
      frameRef.current = window.requestAnimationFrame(scan);
    } catch (error) {
      setScannerState({
        error: error.message || "Camera permission was blocked.",
        scanning: false,
        supported: true,
      });
    }
  }

  const matchedItem = findInventoryByBarcode(inventory, barcode);

  return (
    <section className="barcode-import-panel">
      <div className="barcode-import-heading">
        <span><Barcode size={17} /> Barcode import</span>
        {scannerState.scanning ? (
          <button type="button" className="text-button" onClick={stopScanner}>Stop camera</button>
        ) : (
          <button type="button" className="small-action-button" onClick={startScanner}>
            <Camera size={14} /> Scan
          </button>
        )}
      </div>
      {scannerState.scanning ? (
        <div className="barcode-camera-box">
          <video ref={videoRef} muted playsInline aria-label="Barcode scanner camera preview" />
          <span>Center the barcode in the camera view.</span>
        </div>
      ) : null}
      <label>
        Barcode number
        <input
          inputMode="numeric"
          value={barcode}
          onChange={(event) => onManualChange(event.target.value)}
          placeholder="Scan or type UPC / EAN / QR value"
        />
      </label>
      {matchedItem ? (
        <p className="barcode-match-note success">Matched inventory item: {matchedItem.name}</p>
      ) : barcode ? (
        <p className="barcode-match-note">No saved inventory item uses this barcode yet. Add it below once, then future scans will match it.</p>
      ) : (
        <p className="barcode-match-note">Use the camera if supported, or tap this field and scan with a Bluetooth/USB barcode reader.</p>
      )}
      {scannerState.error ? <p className="barcode-match-note warning">{scannerState.error}</p> : null}
      {!scannerState.supported ? <p className="barcode-match-note warning">Tip: manual entry still works and will save the barcode to the item.</p> : null}
    </section>
  );
}

export default function MorePage({
  expenses,
  inventory,
  orders,
  onDeleteExpense,
  onDeleteInventoryItem,
  onLogExpense,
  onSaveInventoryItem,
  setActive,
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
    const starterItem = item || inventory[0] || null;
    setPurchaseForm({
      barcode: cleanBarcode(starterItem?.barcode),
      inventoryId: starterItem?.id || "",
      date: new Date().toISOString().slice(0, 10),
      newItemMode: !starterItem,
      newItemName: "",
      newItemTarget: 1,
      newItemUnit: starterItem?.unit || "kg",
      quantity: 1,
      totalCost: Number(starterItem?.unitCost || 0),
      note: "",
    });
  }

  function applyBarcodeToPurchase(value) {
    const barcode = cleanBarcode(value);
    const matched = findInventoryByBarcode(inventory, barcode);
    setPurchaseForm((current) => ({
      ...current,
      barcode,
      inventoryId: matched?.id || current.inventoryId,
      newItemMode: barcode ? !matched : current.newItemMode,
      newItemUnit: matched?.unit || current.newItemUnit || "kg",
      totalCost: matched ? Number(matched.unitCost || 0) * Number(current.quantity || 1) : current.totalCost,
    }));
  }

  function updatePurchaseQuantity(value) {
    setPurchaseForm((current) => {
      const item = inventory.find((entry) => entry.id === current.inventoryId);
      return {
        ...current,
        quantity: value,
        totalCost: item && !current.newItemMode ? Number(item.unitCost || 0) * Number(value || 0) : current.totalCost,
      };
    });
  }

  return (
    <main className="page">
      <PageHeading
        title="Trends"
        subtitle="Costs, stock, sales, and the pulse of your one-person bakery."
        action={<button className="round-action" type="button" onClick={() => setActive("settings")} aria-label="Open bakery settings"><Settings2 size={20} /></button>}
      />

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
          <button type="button" className="small-action-button" onClick={() => openPurchase()}><Receipt size={15} /> Scan / log</button>
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
            {expense.barcode ? <small className="expense-barcode">#{expense.barcode}</small> : null}
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
              barcode: cleanBarcode(inventoryForm.barcode),
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
            <label>Barcode<input inputMode="numeric" value={inventoryForm.barcode || ""} onChange={(event) => setInventoryForm({ ...inventoryForm, barcode: event.target.value })} placeholder="UPC / EAN / QR value" /></label>
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
            const quantity = Number(purchaseForm.quantity);
            const totalCost = Number(purchaseForm.totalCost);
            const barcode = cleanBarcode(purchaseForm.barcode);
            let item = inventory.find((entry) => entry.id === purchaseForm.inventoryId);
            if (purchaseForm.newItemMode) {
              const itemId = `inventory-${Date.now()}`;
              item = {
                id: itemId,
                name: purchaseForm.newItemName.trim() || (barcode ? `Barcode ${barcode}` : "New scanned item"),
                amount: 0,
                unit: purchaseForm.newItemUnit || "each",
                target: Number(purchaseForm.newItemTarget || 1),
                unitCost: quantity > 0 ? totalCost / quantity : 0,
                barcode,
                isNew: true,
              };
              onSaveInventoryItem(item);
            } else if (barcode && item && cleanBarcode(item.barcode) !== barcode) {
              onSaveInventoryItem({
                ...item,
                barcode,
                isNew: false,
              });
            }
            if (!item) return;
            const barcodeNote = barcode ? `Barcode: ${barcode}` : "";
            onLogExpense({
              ...purchaseForm,
              barcode,
              inventoryId: item.id,
              itemName: item.name,
              unit: item.unit,
              quantity,
              totalCost,
              note: [purchaseForm.note, barcodeNote].filter(Boolean).join(" · "),
            });
            setPurchaseForm(null);
          }}>
            <BarcodeImportPanel
              barcode={purchaseForm.barcode}
              inventory={inventory}
              onDetected={applyBarcodeToPurchase}
              onManualChange={applyBarcodeToPurchase}
            />
            <div className="purchase-mode-row">
              <button type="button" className={!purchaseForm.newItemMode ? "selected" : ""} onClick={() => setPurchaseForm({ ...purchaseForm, newItemMode: false })} disabled={!inventory.length}>Existing item</button>
              <button type="button" className={purchaseForm.newItemMode ? "selected" : ""} onClick={() => setPurchaseForm({ ...purchaseForm, newItemMode: true })}>Add new item</button>
            </div>
            {!purchaseForm.newItemMode ? (
              <label>Inventory item<select value={purchaseForm.inventoryId} onChange={(event) => {
              const item = inventory.find((entry) => entry.id === event.target.value);
              setPurchaseForm({
                ...purchaseForm,
                inventoryId: event.target.value,
                barcode: cleanBarcode(item?.barcode) || purchaseForm.barcode,
                totalCost: Number(item?.unitCost || 0) * Number(purchaseForm.quantity || 1),
              });
            }}>{inventory.map((item) => <option value={item.id} key={item.id}>{item.name}{item.barcode ? ` · ${item.barcode}` : ""}</option>)}</select></label>
            ) : (
              <>
                <label>New item name<input autoFocus required value={purchaseForm.newItemName} onChange={(event) => setPurchaseForm({ ...purchaseForm, newItemName: event.target.value })} placeholder="Organic rye flour, jar lids, labels…" /></label>
                <div className="form-grid">
                  <label>Unit<input required value={purchaseForm.newItemUnit} onChange={(event) => setPurchaseForm({ ...purchaseForm, newItemUnit: event.target.value })} placeholder="kg, each, bag" /></label>
                  <label>Restock target<input type="number" min="0" step="0.01" value={purchaseForm.newItemTarget} onChange={(event) => setPurchaseForm({ ...purchaseForm, newItemTarget: event.target.value })} /></label>
                </div>
              </>
            )}
            <label>Purchase date<input type="date" value={purchaseForm.date} onChange={(event) => setPurchaseForm({ ...purchaseForm, date: event.target.value })} /></label>
            <div className="form-grid">
              <label>Quantity purchased<input type="number" min="0.01" step="0.01" value={purchaseForm.quantity} onChange={(event) => updatePurchaseQuantity(event.target.value)} /></label>
              <label>Total cost<input type="number" min="0" step="0.01" value={purchaseForm.totalCost} onChange={(event) => setPurchaseForm({ ...purchaseForm, totalCost: event.target.value })} /></label>
            </div>
            <label>Note<input value={purchaseForm.note} onChange={(event) => setPurchaseForm({ ...purchaseForm, note: event.target.value })} placeholder="Supplier, receipt, or sale price" /></label>
            <p className="form-help">Saving adds the purchased quantity to stock, stores the barcode for future scans, and updates purchase trends.</p>
            <button className="primary-button" type="submit">Log purchase</button>
          </form>
        </Modal>
      ) : null}
    </main>
  );
}
