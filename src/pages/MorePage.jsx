import {
  Barcode,
  BellRing,
  Box,
  CalendarDays,
  Camera,
  ChevronRight,
  CircleDollarSign,
  Clipboard,
  FileUp,
  Heart,
  LineChart,
  Mail,
  MapPin,
  Package,
  Pencil,
  Phone,
  Plus,
  Receipt,
  Search,
  Settings2,
  Trash2,
  Upload,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeading } from "../components/AppChrome";
import { EmptyState, Modal } from "../components/Primitives";

const emptyInventoryItem = {
  id: "",
  name: "",
  barcode: "",
  amount: 0,
  unit: "kg",
  target: 1,
  unitCost: 0,
};

const OPEN_FOOD_FACTS_FIELDS = [
  "product_name",
  "generic_name",
  "brands",
  "quantity",
  "categories",
  "allergens_tags",
  "traces_tags",
  "ingredients_text",
  "image_front_small_url",
  "image_url",
].join(",");

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

function findInventoryByName(inventory, name) {
  const target = String(name || "").trim().toLowerCase();
  if (!target) return null;
  return inventory.find((item) => String(item.name || "").trim().toLowerCase() === target) || null;
}

function parsePackQuantity(quantityLabel) {
  const match = String(quantityLabel || "").match(/([\d.]+)\s*(kg|g|lb|lbs|oz|ml|l|liter|liters|each|ct|count|bag|bags)/i);
  if (!match) return null;
  const unitMap = {
    lbs: "lb",
    liter: "l",
    liters: "l",
    ct: "each",
    count: "each",
    bags: "bag",
  };
  return {
    quantity: Number(match[1]) || 1,
    unit: unitMap[match[2].toLowerCase()] || match[2].toLowerCase(),
  };
}

function openFoodFactsProductName(product) {
  const name = product?.product_name || product?.generic_name || "";
  const brand = String(product?.brands || "").split(",")[0]?.trim();
  return [brand, name].filter(Boolean).join(" · ") || "";
}

function formatTags(tags = []) {
  return tags
    .map((tag) => String(tag).replace(/^en:/, "").replaceAll("-", " "))
    .filter(Boolean)
    .slice(0, 6)
    .join(", ");
}

function productLookupNote(product) {
  if (!product) return "";
  const lines = [
    product.quantity ? `Package: ${product.quantity}` : "",
    product.categories ? `Category: ${product.categories}` : "",
    product.ingredients_text ? `Ingredients: ${product.ingredients_text}` : "",
    product.allergens_tags?.length ? `Allergens: ${formatTags(product.allergens_tags)}` : "",
    product.traces_tags?.length ? `Traces: ${formatTags(product.traces_tags)}` : "",
    "Source: Open Food Facts",
  ];
  return lines.filter(Boolean).join(" · ");
}

async function lookupOpenFoodFactsProduct(barcode) {
  const target = cleanBarcode(barcode);
  if (!target) throw new Error("Enter or scan a barcode first.");
  const params = new URLSearchParams({
    fields: OPEN_FOOD_FACTS_FIELDS,
    app_name: "LoafersBakeryOS",
    app_version: "1.0",
  });
  const response = await fetch(`https://world.openfoodfacts.org/api/v3.6/product/${encodeURIComponent(target)}.json?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("Open Food Facts lookup failed. Try again or enter the item manually.");
  const data = await response.json();
  const product = data.product;
  if (!product || (!product.product_name && !product.generic_name && !product.brands)) {
    throw new Error("No food product found for this barcode yet.");
  }
  return product;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const source = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n" && !quoted) {
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ""));
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
}

function csvValue(row, keys) {
  const normalizedKeys = keys.map((key) => key.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const foundKey = normalizedKeys.find((key) => row[key]);
  return foundKey ? row[foundKey] : "";
}

function numberFromCsv(value, fallback = 0) {
  const cleaned = String(value || "").replace(/[^0-9.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function importedPurchaseRows(records, inventory) {
  return records.map((row, index) => {
    const barcode = cleanBarcode(csvValue(row, ["barcode", "code", "upc", "ean", "sku", "item id"]));
    const itemName = csvValue(row, ["name", "item", "product", "description", "title"]) || (barcode ? `Barcode ${barcode}` : `Imported item ${index + 1}`);
    const matched = findInventoryByBarcode(inventory, barcode) || findInventoryByName(inventory, itemName);
    const quantity = numberFromCsv(csvValue(row, ["quantity", "qty", "count", "stock", "amount"]), 1) || 1;
    const totalCost = numberFromCsv(csvValue(row, ["total cost", "total", "cost", "price", "value"]), 0);
    const unit = csvValue(row, ["unit", "uom", "measure"]) || matched?.unit || "each";
    const date = csvValue(row, ["date", "scanned at", "created at", "time"]) || new Date().toISOString().slice(0, 10);
    return {
      id: `csv-${Date.now()}-${index}`,
      selected: true,
      barcode,
      inventoryId: matched?.id || "",
      itemName: matched?.name || itemName,
      unit,
      quantity,
      totalCost,
      date: String(date).slice(0, 10),
      target: matched?.target || 1,
      note: csvValue(row, ["note", "notes", "comment", "supplier", "location"]),
    };
  });
}

const CLOSED_ORDER_STATUSES = new Set(["completed", "rejected", "cancelled", "canceled"]);

function customerIdFromName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function orderTimestamp(order) {
  const candidates = [order.pickupAt, order.createdAt, order.date, order.due];
  for (const value of candidates) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.getTime();
  }
  return 0;
}

function dateTimeLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isActiveOrder(order) {
  return !CLOSED_ORDER_STATUSES.has(String(order.status || "").toLowerCase());
}

function orderItemsLabel(order) {
  if (order.items?.length) {
    return order.items.map((item) => (
      `${item.quantity || 1} × ${item.sale_option_label || item.product_name || "Item"}`
    )).join(" · ");
  }
  return order.itemSummary || `${order.quantity || 1} × ${order.product || "Order"}`;
}

function orderProgressLabel(order) {
  const progress = order.bakeProgress || {};
  const entries = Object.entries(progress);
  if (!entries.length) return "";
  const complete = entries.filter(([, value]) => Boolean(value)).length;
  return `${complete}/${entries.length} bake phases complete`;
}

function blankCustomerProfile(name = "") {
  const id = customerIdFromName(name) || `customer-${Date.now()}`;
  return {
    id,
    name,
    email: "",
    phone: "",
    allergies: "",
    preferences: "",
    address: "",
    pickupNotes: "",
    paymentNotes: "",
    favoriteItems: "",
    notes: "",
  };
}

function buildCustomerRecords(orders, profiles) {
  const byId = new Map();
  profiles.forEach((profile) => {
    const id = profile.id || customerIdFromName(profile.name);
    if (!id) return;
    byId.set(id, {
      ...blankCustomerProfile(profile.name),
      ...profile,
      id,
      orders: [],
    });
  });
  orders.forEach((order) => {
    const id = customerIdFromName(order.customer) || `order-customer-${order.id}`;
    const existing = byId.get(id) || {
      ...blankCustomerProfile(order.customer),
      id,
      orders: [],
    };
    byId.set(id, {
      ...existing,
      name: existing.name || order.customer || "Customer",
      email: existing.email || order.customerEmail || "",
      phone: existing.phone || order.customerPhone || "",
      allergies: existing.allergies || order.allergies || "",
      orders: [...existing.orders, order],
    });
  });
  return Array.from(byId.values()).map((customer) => {
    const sortedOrders = [...customer.orders].sort((a, b) => orderTimestamp(b) - orderTimestamp(a));
    const activeOrders = sortedOrders.filter(isActiveOrder);
    const totalSpent = sortedOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const products = [...new Set(sortedOrders.map((order) => order.product).filter(Boolean))].slice(0, 4);
    return {
      ...customer,
      orders: sortedOrders,
      activeOrders,
      isActive: activeOrders.length > 0,
      lastOrderAt: sortedOrders[0] ? orderTimestamp(sortedOrders[0]) : 0,
      totalSpent,
      favoriteItems: customer.favoriteItems || products.join(", "),
    };
  }).sort((a, b) => (
    Number(b.isActive) - Number(a.isActive)
    || b.lastOrderAt - a.lastOrderAt
    || a.name.localeCompare(b.name)
  ));
}

function BarcodeImportPanel({
  barcode,
  inventory,
  lookupMessage,
  lookupProduct,
  lookupStatus,
  onDetected,
  onLookup,
  onManualChange,
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const [pasteMessage, setPasteMessage] = useState("");
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

  async function pasteBarcode() {
    setPasteMessage("");
    if (!navigator.clipboard?.readText) {
      setPasteMessage("Clipboard paste is not available here. Tap the barcode field and paste manually.");
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      const value = cleanBarcode(text).match(/[A-Za-z0-9-]{5,}/)?.[0] || cleanBarcode(text);
      if (!value) {
        setPasteMessage("Clipboard did not contain a barcode.");
        return;
      }
      onDetected(value);
      setPasteMessage("Barcode pasted.");
    } catch (error) {
      setPasteMessage(error.message || "Clipboard permission was blocked.");
    }
  }

  const matchedItem = findInventoryByBarcode(inventory, barcode);

  return (
    <section className="barcode-import-panel">
      <div className="barcode-import-heading">
        <span><Barcode size={17} /> Barcode import</span>
        <div className="barcode-action-row">
          {scannerState.scanning ? (
            <button type="button" className="text-button" onClick={stopScanner}>Stop camera</button>
          ) : (
            <button type="button" className="small-action-button" onClick={startScanner}>
              <Camera size={14} /> Scan
            </button>
          )}
          <button type="button" className="small-action-button subtle" onClick={pasteBarcode}>
            <Clipboard size={14} /> Paste
          </button>
        </div>
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
      {pasteMessage ? <p className="barcode-match-note success">{pasteMessage}</p> : null}
      {!scannerState.supported ? <p className="barcode-match-note warning">Tip: manual entry still works and will save the barcode to the item.</p> : null}
      <div className="barcode-lookup-card">
        <button type="button" className="small-action-button" onClick={onLookup} disabled={!barcode || lookupStatus === "loading"}>
          <Search size={14} /> {lookupStatus === "loading" ? "Looking up…" : "Lookup food facts"}
        </button>
        <small>For packaged food, this can auto-fill the name, size, ingredients, and allergen note when Open Food Facts has a match.</small>
      </div>
      {lookupMessage ? (
        <p className={`barcode-match-note ${lookupStatus === "error" ? "warning" : "success"}`}>{lookupMessage}</p>
      ) : null}
      {lookupProduct ? (
        <div className="product-lookup-preview">
          {lookupProduct.image_front_small_url || lookupProduct.image_url ? (
            <img src={lookupProduct.image_front_small_url || lookupProduct.image_url} alt="" />
          ) : null}
          <span>
            <strong>{openFoodFactsProductName(lookupProduct)}</strong>
            <small>{[lookupProduct.quantity, lookupProduct.categories].filter(Boolean).join(" · ") || "Food product match"}</small>
          </span>
        </div>
      ) : null}
    </section>
  );
}

export default function MorePage({
  customerProfiles = [],
  expenses,
  inventory,
  orders,
  onDeleteExpense,
  onDeleteInventoryItem,
  onLogExpense,
  onOpenOrder,
  onSaveCustomerProfile,
  onSaveInventoryItem,
  setActive,
}) {
  const [orderHistoryOpen, setOrderHistoryOpen] = useState(false);
  const [customerDirectoryOpen, setCustomerDirectoryOpen] = useState(false);
  const [customerView, setCustomerView] = useState("active");
  const [customerDraft, setCustomerDraft] = useState(null);
  const [inventoryForm, setInventoryForm] = useState(null);
  const [purchaseForm, setPurchaseForm] = useState(null);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [csvRows, setCsvRows] = useState([]);
  const [csvImportMessage, setCsvImportMessage] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const customerRecords = useMemo(() => buildCustomerRecords(orders, customerProfiles), [orders, customerProfiles]);
  const activeCustomerRecords = useMemo(() => customerRecords.filter((customer) => customer.isActive), [customerRecords]);
  const pastCustomerRecords = useMemo(() => customerRecords.filter((customer) => customer.orders.length && !customer.isActive), [customerRecords]);
  const visibleCustomers = customerView === "active"
    ? activeCustomerRecords
    : customerView === "past"
      ? pastCustomerRecords
      : customerRecords;
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

  function openCustomerDirectory(view = "active") {
    setCustomerView(view);
    setCustomerDirectoryOpen(true);
    const firstCustomer = view === "active"
      ? activeCustomerRecords[0]
      : view === "past"
        ? pastCustomerRecords[0]
        : customerRecords[0];
    setCustomerDraft(firstCustomer ? { ...firstCustomer, orders: undefined, activeOrders: undefined } : null);
  }

  function editCustomer(customer) {
    setCustomerDraft({ ...customer, orders: undefined, activeOrders: undefined });
  }

  function addCustomerProfile() {
    setCustomerDraft({
      ...blankCustomerProfile(""),
      id: `customer-${Date.now()}`,
      name: "",
    });
    setCustomerView("all");
    setCustomerDirectoryOpen(true);
  }

  function saveCustomerProfile(event) {
    event.preventDefault();
    if (!customerDraft || !onSaveCustomerProfile) return;
    onSaveCustomerProfile({
      ...customerDraft,
      name: customerDraft.name?.trim() || "Customer",
    });
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
      lookupMessage: "",
      lookupProduct: null,
      lookupStatus: "idle",
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
      lookupMessage: "",
      lookupProduct: null,
      lookupStatus: "idle",
    }));
  }

  async function lookupBarcodeForPurchase() {
    const barcode = cleanBarcode(purchaseForm?.barcode);
    if (!barcode) return;
    setPurchaseForm((current) => ({
      ...current,
      lookupMessage: "Checking Open Food Facts…",
      lookupStatus: "loading",
    }));
    try {
      const product = await lookupOpenFoodFactsProduct(barcode);
      const productName = openFoodFactsProductName(product);
      const pack = parsePackQuantity(product.quantity);
      setPurchaseForm((current) => {
        if (cleanBarcode(current.barcode) !== barcode) return current;
        const matched = findInventoryByBarcode(inventory, barcode);
        return {
          ...current,
          inventoryId: matched?.id || current.inventoryId,
          lookupMessage: "Food details found. Review the name, quantity, and cost before saving.",
          lookupProduct: product,
          lookupStatus: "found",
          newItemMode: !matched,
          newItemName: matched ? current.newItemName : (current.newItemName || productName),
          newItemUnit: matched?.unit || pack?.unit || current.newItemUnit || "each",
          note: [current.note, productLookupNote(product)].filter(Boolean).join(" · "),
          quantity: pack?.quantity && Number(current.quantity || 0) === 1 ? pack.quantity : current.quantity,
        };
      });
    } catch (error) {
      setPurchaseForm((current) => ({
        ...current,
        lookupMessage: error.message || "Lookup failed. You can still enter this item manually.",
        lookupStatus: "error",
      }));
    }
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

  function openCsvImport() {
    setCsvRows([]);
    setCsvImportMessage("Choose an Orca Scan CSV export, or paste CSV text below.");
    setCsvImportOpen(true);
  }

  function loadCsvText(text) {
    const parsed = importedPurchaseRows(parseCsv(text), inventory);
    setCsvRows(parsed);
    setCsvImportMessage(parsed.length
      ? `${parsed.length} purchase row${parsed.length === 1 ? "" : "s"} ready. Fill any missing costs or quantities before importing.`
      : "I could not find rows in that CSV. Make sure the export includes headers like Barcode, Name, Quantity, and Cost.");
  }

  function updateCsvRow(id, changes) {
    setCsvRows((current) => current.map((row) => (
      row.id === id ? { ...row, ...changes } : row
    )));
  }

  function importCsvRows(event) {
    event.preventDefault();
    const selected = csvRows.filter((row) => row.selected);
    const knownItems = [...inventory];
    selected.forEach((row, index) => {
      const quantity = Number(row.quantity);
      const totalCost = Number(row.totalCost);
      if (!row.itemName || !(quantity > 0) || !(totalCost >= 0)) return;
      let item = row.inventoryId
        ? knownItems.find((entry) => entry.id === row.inventoryId)
        : null;
      item = item || findInventoryByBarcode(knownItems, row.barcode) || findInventoryByName(knownItems, row.itemName);
      if (!item) {
        item = {
          id: `inventory-${Date.now()}-${index}`,
          name: row.itemName.trim(),
          amount: 0,
          unit: row.unit || "each",
          target: Number(row.target || 1),
          unitCost: quantity > 0 ? totalCost / quantity : 0,
          barcode: cleanBarcode(row.barcode),
          isNew: true,
        };
        knownItems.unshift(item);
        onSaveInventoryItem(item);
      } else if (row.barcode && cleanBarcode(item.barcode) !== cleanBarcode(row.barcode)) {
        const updatedItem = { ...item, barcode: cleanBarcode(row.barcode), isNew: false };
        const itemIndex = knownItems.findIndex((entry) => entry.id === item.id);
        if (itemIndex >= 0) knownItems[itemIndex] = updatedItem;
        item = updatedItem;
        onSaveInventoryItem(updatedItem);
      }
      onLogExpense({
        id: `expense-${Date.now()}-${index}`,
        date: row.date || new Date().toISOString().slice(0, 10),
        barcode: cleanBarcode(row.barcode),
        inventoryId: item.id,
        itemName: item.name,
        note: [row.note, row.barcode ? `Barcode: ${row.barcode}` : "", "Imported from scanner CSV"].filter(Boolean).join(" · "),
        quantity,
        totalCost,
        unit: item.unit || row.unit || "each",
      });
    });
    setCsvImportOpen(false);
    setCsvRows([]);
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
        <button type="button" className="metric-button" onClick={() => setOrderHistoryOpen(true)}><Box /><strong>{orders.length}</strong><span>orders</span></button>
        <button type="button" className="metric-button" onClick={() => openCustomerDirectory("active")}><UsersRound /><strong>{activeCustomerRecords.length}</strong><span>active customers</span></button>
      </section>

      <section className="spending-card">
        <div className="section-title-line">
          <div><span className="eyebrow-label dark">6-week expenditure</span><h2>Purchases</h2></div>
          <div className="purchase-card-actions">
            <button type="button" className="small-action-button subtle" onClick={openCsvImport}><FileUp size={15} /> Import CSV</button>
            <button type="button" className="small-action-button" onClick={() => openPurchase()}><Receipt size={15} /> Scan / log</button>
          </div>
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

      {orderHistoryOpen ? (
        <Modal title="Order history" onClose={() => setOrderHistoryOpen(false)}>
          <div className="order-history-panel">
            <p className="form-help">Every order record with customer, pickup, payment, allergy, notes, item, and bake progress details.</p>
            {orders.length ? [...orders].sort((a, b) => orderTimestamp(b) - orderTimestamp(a)).map((order) => (
              <section className="order-history-card" key={order.id}>
                <div className="order-history-heading">
                  <span>
                    <strong>{order.customer || "Customer"}</strong>
                    <small>{order.product || order.itemSummary || "Order"} · {order.status || "New"}</small>
                  </span>
                  <strong>${Number(order.total || 0).toFixed(2)}</strong>
                </div>
                <div className="order-history-facts">
                  <span><CalendarDays size={13} /> Ordered {dateTimeLabel(order.createdAt) || "Unknown"}</span>
                  <span><BellRing size={13} /> {orderProgressLabel(order) || "Bake progress not started"}</span>
                  <span><MapPin size={13} /> {order.pickupAt ? dateTimeLabel(order.pickupAt) : order.due || "Pickup not set"}</span>
                  <span><Receipt size={13} /> {order.paymentMethod || "Payment not recorded"}</span>
                </div>
                <div className="order-history-detail-grid">
                  <span><strong>Items</strong><small>{orderItemsLabel(order)}</small></span>
                  <span><strong>Quantity</strong><small>{order.totalUnits || order.quantity || 1} unit{Number(order.totalUnits || order.quantity || 1) === 1 ? "" : "s"}</small></span>
                  <span><strong>Contact</strong><small>{[order.customerEmail, order.customerPhone].filter(Boolean).join(" · ") || "No contact saved"}</small></span>
                  <span><strong>Allergies</strong><small>{order.allergies || "None listed"}</small></span>
                  <span><strong>Pickup</strong><small>{order.pickupLocation || "Pickup location not saved"}</small></span>
                  <span><strong>Record</strong><small>{order.requestCode ? `Request ${order.requestCode}` : `ID ${order.id}`}</small></span>
                </div>
                {order.notes ? <p className="order-history-notes">{order.notes}</p> : null}
                {onOpenOrder ? (
                  <button type="button" className="text-button order-history-open" onClick={() => {
                    setOrderHistoryOpen(false);
                    onOpenOrder(order.id);
                  }}>Open in Orders <ChevronRight size={14} /></button>
                ) : null}
              </section>
            )) : <EmptyState title="No orders yet" body="Customer order records will appear here." />}
          </div>
        </Modal>
      ) : null}

      {customerDirectoryOpen ? (
        <Modal title="Customer directory" onClose={() => setCustomerDirectoryOpen(false)}>
          <div className="customer-directory-panel">
            <div className="customer-directory-toolbar">
              <div className="segmented-control customer-filter">
                <button type="button" className={customerView === "active" ? "selected" : ""} onClick={() => setCustomerView("active")}>Active <span>{activeCustomerRecords.length}</span></button>
                <button type="button" className={customerView === "past" ? "selected" : ""} onClick={() => setCustomerView("past")}>Past <span>{pastCustomerRecords.length}</span></button>
                <button type="button" className={customerView === "all" ? "selected" : ""} onClick={() => setCustomerView("all")}>All <span>{customerRecords.length}</span></button>
              </div>
              <button type="button" className="small-action-button" onClick={addCustomerProfile}><Plus size={14} /> Add customer</button>
            </div>
            <div className="customer-directory-layout">
              <div className="customer-directory-list">
                {visibleCustomers.length ? visibleCustomers.map((customer) => (
                  <button type="button" className={`customer-directory-row ${customerDraft?.id === customer.id ? "selected" : ""}`} key={customer.id} onClick={() => editCustomer(customer)}>
                    <UserRound size={17} />
                    <span>
                      <strong>{customer.name || "Customer"}</strong>
                      <small>{customer.orders.length} order{customer.orders.length === 1 ? "" : "s"} · ${customer.totalSpent.toFixed(2)} lifetime</small>
                    </span>
                    <ChevronRight size={14} />
                  </button>
                )) : <EmptyState title="No customers in this view" body="Switch to All or add a customer profile." />}
              </div>
              {customerDraft ? (
                <form className="form-stack customer-profile-form" onSubmit={saveCustomerProfile}>
                  <div className="customer-profile-summary">
                    <UserRound size={19} />
                    <span>
                      <strong>{customerDraft.name || "New customer"}</strong>
                      <small>{customerDraft.orders?.length || customerRecords.find((customer) => customer.id === customerDraft.id)?.orders.length || 0} linked order records</small>
                    </span>
                  </div>
                  <label>Name<input required value={customerDraft.name || ""} onChange={(event) => setCustomerDraft({ ...customerDraft, name: event.target.value })} placeholder="Customer name" /></label>
                  <div className="form-grid">
                    <label>Email<input type="email" value={customerDraft.email || ""} onChange={(event) => setCustomerDraft({ ...customerDraft, email: event.target.value })} placeholder="name@example.com" /></label>
                    <label>Phone<input value={customerDraft.phone || ""} onChange={(event) => setCustomerDraft({ ...customerDraft, phone: event.target.value })} placeholder="907…" /></label>
                  </div>
                  <label>Address<textarea value={customerDraft.address || ""} onChange={(event) => setCustomerDraft({ ...customerDraft, address: event.target.value })} placeholder="Street, city, delivery notes…" /></label>
                  <label>Allergies / safety notes<textarea value={customerDraft.allergies || ""} onChange={(event) => setCustomerDraft({ ...customerDraft, allergies: event.target.value })} placeholder="Wheat, sesame, dairy, nut allergies, cross-contact notes…" /></label>
                  <label>Preferences<textarea value={customerDraft.preferences || ""} onChange={(event) => setCustomerDraft({ ...customerDraft, preferences: event.target.value })} placeholder="Crust darkness, slicing, add-ins, pickup habits…" /></label>
                  <div className="form-grid">
                    <label>Favorite items<input value={customerDraft.favoriteItems || ""} onChange={(event) => setCustomerDraft({ ...customerDraft, favoriteItems: event.target.value })} placeholder="Country, bagels, hot sauce…" /></label>
                    <label>Payment notes<input value={customerDraft.paymentNotes || ""} onChange={(event) => setCustomerDraft({ ...customerDraft, paymentNotes: event.target.value })} placeholder="Venmo, cash, invoice…" /></label>
                  </div>
                  <label>Pickup / delivery notes<textarea value={customerDraft.pickupNotes || ""} onChange={(event) => setCustomerDraft({ ...customerDraft, pickupNotes: event.target.value })} placeholder="Porch box, text on arrival, gate code…" /></label>
                  <label>Private notes<textarea value={customerDraft.notes || ""} onChange={(event) => setCustomerDraft({ ...customerDraft, notes: event.target.value })} placeholder="Anything useful for future orders…" /></label>
                  <div className="customer-profile-chips">
                    <span><Mail size={13} /> {customerDraft.email || "No email"}</span>
                    <span><Phone size={13} /> {customerDraft.phone || "No phone"}</span>
                    <span><Heart size={13} /> {customerDraft.favoriteItems || "No favorites yet"}</span>
                  </div>
                  <button className="primary-button" type="submit">Save customer profile</button>
                </form>
              ) : (
                <EmptyState title="Pick a customer" body="Choose a customer or add a new profile to save details." />
              )}
            </div>
          </div>
        </Modal>
      ) : null}

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
              lookupMessage={purchaseForm.lookupMessage}
              lookupProduct={purchaseForm.lookupProduct}
              lookupStatus={purchaseForm.lookupStatus}
              onDetected={applyBarcodeToPurchase}
              onLookup={lookupBarcodeForPurchase}
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

      {csvImportOpen ? (
        <Modal title="Import scanner CSV" onClose={() => setCsvImportOpen(false)}>
          <form className="form-stack" onSubmit={importCsvRows}>
            <p className="form-help">Works with Orca Scan-style CSV exports. Match columns like Barcode, Name, Quantity, Unit, Cost, Date, and Notes. You can edit every row before it touches inventory.</p>
            <label>
              Scanner CSV file
              <input
                accept=".csv,text/csv"
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  file.text().then(loadCsvText).catch(() => setCsvImportMessage("I could not read that CSV file."));
                }}
              />
            </label>
            <label>
              Or paste CSV text
              <textarea
                placeholder={"Barcode,Name,Quantity,Unit,Cost,Date,Notes\n012345678905,Bread flour,10,kg,16.50,2026-06-29,Costco"}
                onChange={(event) => loadCsvText(event.target.value)}
              />
            </label>
            {csvImportMessage ? <p className="barcode-match-note">{csvImportMessage}</p> : null}
            {csvRows.length ? (
              <div className="csv-import-list">
                {csvRows.map((row) => {
                  const matched = findInventoryByBarcode(inventory, row.barcode) || findInventoryByName(inventory, row.itemName);
                  return (
                    <section className="csv-import-row" key={row.id}>
                      <label className="csv-row-check">
                        <input type="checkbox" checked={row.selected} onChange={(event) => updateCsvRow(row.id, { selected: event.target.checked })} />
                        Import
                      </label>
                      <label>Barcode<input value={row.barcode} onChange={(event) => updateCsvRow(row.id, { barcode: event.target.value })} /></label>
                      <label>Item<input value={row.itemName} onChange={(event) => updateCsvRow(row.id, { itemName: event.target.value })} /></label>
                      <div className="form-grid">
                        <label>Quantity<input type="number" min="0.01" step="0.01" value={row.quantity} onChange={(event) => updateCsvRow(row.id, { quantity: event.target.value })} /></label>
                        <label>Unit<input value={row.unit} onChange={(event) => updateCsvRow(row.id, { unit: event.target.value })} /></label>
                      </div>
                      <div className="form-grid">
                        <label>Total cost<input type="number" min="0" step="0.01" value={row.totalCost} onChange={(event) => updateCsvRow(row.id, { totalCost: event.target.value })} /></label>
                        <label>Date<input type="date" value={row.date} onChange={(event) => updateCsvRow(row.id, { date: event.target.value })} /></label>
                      </div>
                      <label>Note<input value={row.note} onChange={(event) => updateCsvRow(row.id, { note: event.target.value })} /></label>
                      <small>{matched ? `Will update ${matched.name}` : "Will create a new inventory item if imported."}</small>
                    </section>
                  );
                })}
              </div>
            ) : null}
            <button className="primary-button" type="submit" disabled={!csvRows.some((row) => row.selected)}>
              <Upload size={16} /> Import selected purchases
            </button>
          </form>
        </Modal>
      ) : null}
    </main>
  );
}
