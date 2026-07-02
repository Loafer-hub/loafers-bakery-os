import {
  AlertTriangle,
  Barcode,
  BellRing,
  Box,
  CalendarDays,
  Camera,
  ChevronRight,
  CircleDollarSign,
  CheckCircle2,
  Clipboard,
  ClipboardCheck,
  FileUp,
  Gauge,
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
  ShieldCheck,
  TrendingUp,
  Trash2,
  Upload,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeading } from "../components/AppChrome";
import { EmptyState, Modal } from "../components/Primitives";
import { usePersistentState } from "../hooks/usePersistentState";
import { estimateRecipeEconomics } from "../lib/productCosting";
import { batchCodeFor, recipeVersionLabel } from "../lib/recipeVersions";

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
const READY_ORDER_STATUSES = new Set(["accepted", "paid", "deposit", "deposit paid", "new", "requested", "pending"]);
const PAID_ORDER_MARKERS = ["paid in full", "paid", "complete"];
const LIQUID_SAFETY_TYPES = new Set(["hot_sauce", "vinegar", "infused_oil"]);

function customerIdFromName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function customerEmailKey(value) {
  return String(value || "").trim().toLowerCase();
}

function customerPhoneKey(value) {
  return String(value || "").replace(/\D/g, "");
}

function customerAliasKeys({ customerId, customerUserId, email, phone, name }) {
  return [
    customerUserId ? `account:${customerUserId}` : "",
    customerId ? `cloud:${customerId}` : "",
    customerEmailKey(email) ? `email:${customerEmailKey(email)}` : "",
    customerPhoneKey(phone) ? `phone:${customerPhoneKey(phone)}` : "",
    customerIdFromName(name) ? `name:${customerIdFromName(name)}` : "",
  ].filter(Boolean);
}

function customerIdFromAliases(aliases, fallback = "") {
  const preferred = aliases.find((alias) => !alias.startsWith("name:")) || aliases[0];
  return preferred
    ? preferred.replace(":", "-").replace(/[^a-z0-9-]+/gi, "-").toLowerCase()
    : fallback;
}

function rememberCustomerAliases(aliasMap, aliases, id) {
  aliases.forEach((alias) => aliasMap.set(alias, id));
}

function orderProductNames(order) {
  const itemNames = (order.items || [])
    .map((item) => item.product_name)
    .filter(Boolean);
  return itemNames.length ? itemNames : [order.product].filter(Boolean);
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

function statusKey(value) {
  return String(value || "").trim().toLowerCase();
}

function dateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function isReadyOrder(order) {
  const status = statusKey(order.status);
  return isActiveOrder(order) && (!status || READY_ORDER_STATUSES.has(status));
}

function hasPickupTarget(order) {
  return Boolean(order.pickupAt || order.due);
}

function isPaidOrder(order) {
  const paymentText = [order.paymentStatus, order.status, order.paymentNotes]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return PAID_ORDER_MARKERS.some((marker) => paymentText.includes(marker));
}

function isDepositOrder(order) {
  return [order.paymentStatus, order.status].filter(Boolean).join(" ").toLowerCase().includes("deposit");
}

function activeProductName(order) {
  if (order.items?.length) {
    return order.items.map((item) => item.product_name).filter(Boolean).join(", ");
  }
  return order.product || order.itemSummary || "Order";
}

function productStatsFromOrders(orders) {
  const stats = new Map();
  orders.forEach((order) => {
    const names = order.items?.length
      ? order.items.map((item) => ({
        name: item.product_name || order.product || "Order",
        quantity: Number(item.quantity || 1) * Number(item.units_per_pack || 1),
      }))
      : [{ name: order.product || "Order", quantity: Number(order.totalUnits || order.quantity || 1) }];
    const revenueShare = Number(order.total || 0) / Math.max(1, names.length);
    names.forEach(({ name, quantity }) => {
      const key = String(name || "Order").trim() || "Order";
      const current = stats.get(key) || {
        name: key,
        orders: 0,
        quantity: 0,
        revenue: 0,
      };
      current.orders += 1;
      current.quantity += Number(quantity || 0);
      current.revenue += revenueShare;
      stats.set(key, current);
    });
  });
  return [...stats.values()].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue);
}

function topBy(list, key) {
  return [...list].sort((a, b) => Number(b[key] || 0) - Number(a[key] || 0))[0] || null;
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
    customerId: "",
    customerUserId: "",
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
  const aliasesById = new Map();
  profiles.forEach((profile) => {
    const aliases = customerAliasKeys({
      customerId: profile.customerId,
      customerUserId: profile.customerUserId,
      email: profile.email,
      phone: profile.phone,
      name: profile.name,
    });
    const id = profile.id || customerIdFromAliases(aliases, customerIdFromName(profile.name));
    if (!id) return;
    byId.set(id, {
      ...blankCustomerProfile(profile.name),
      ...profile,
      id,
      orders: [],
    });
    rememberCustomerAliases(aliasesById, aliases, id);
  });
  orders.forEach((order) => {
    const aliases = customerAliasKeys({
      customerId: order.customerId,
      customerUserId: order.customerUserId,
      email: order.customerEmail,
      phone: order.customerPhone,
      name: order.customer,
    });
    const matchedId = aliases.map((alias) => aliasesById.get(alias)).find(Boolean);
    const id = matchedId || customerIdFromAliases(aliases, `order-customer-${order.id}`);
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
      customerId: existing.customerId || order.customerId || "",
      customerUserId: existing.customerUserId || order.customerUserId || "",
      allergies: existing.allergies || order.allergies || "",
      orders: [...existing.orders, order],
    });
    rememberCustomerAliases(aliasesById, aliases, id);
  });
  return Array.from(byId.values()).map((customer) => {
    const sortedOrders = [...customer.orders].sort((a, b) => orderTimestamp(b) - orderTimestamp(a));
    const activeOrders = sortedOrders.filter(isActiveOrder);
    const totalSpent = sortedOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const products = [...new Set(sortedOrders.flatMap(orderProductNames))].slice(0, 4);
    return {
      ...customer,
      orders: sortedOrders,
      activeOrders,
      isActive: activeOrders.length > 0,
      lastOrderAt: sortedOrders[0] ? orderTimestamp(sortedOrders[0]) : 0,
      firstOrderAt: sortedOrders.length ? orderTimestamp(sortedOrders[sortedOrders.length - 1]) : 0,
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
  batchTraceRecords = [],
  customerProfiles = [],
  expenses,
  inventory,
  kitchenBakes = [],
  liquidSafetyLogs = [],
  orders,
  onDeleteExpense,
  onDeleteBatchTraceRecord,
  onDeleteInventoryItem,
  onLogExpense,
  onOpenOrder,
  onSaveBatchTraceRecord,
  onSaveCustomerProfile,
  onSaveInventoryItem,
  recipes = [],
  starterLogs = [],
  setActive,
  businessFocus,
}) {
  const [orderHistoryOpen, setOrderHistoryOpen] = useState(false);
  const [customerDirectoryOpen, setCustomerDirectoryOpen] = useState(false);
  const [businessArea, setBusinessArea] = useState("reports");
  const [customerView, setCustomerView] = useState("active");
  const [customerDraft, setCustomerDraft] = useState(null);
  const [inventoryForm, setInventoryForm] = useState(null);
  const [purchaseForm, setPurchaseForm] = useState(null);
  const [traceForm, setTraceForm] = useState(null);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [csvRows, setCsvRows] = useState([]);
  const [csvImportMessage, setCsvImportMessage] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const todayKey = new Date().toISOString().slice(0, 10);
  const [qualityLog, setQualityLog] = usePersistentState("loafers-owner-quality-checks-v1", {
    checked: {},
    date: todayKey,
  });
  const manualQualityChecks = qualityLog?.date === todayKey ? qualityLog.checked || {} : {};
  const customerRecords = useMemo(() => buildCustomerRecords(orders, customerProfiles), [orders, customerProfiles]);
  const activeCustomerRecords = useMemo(() => customerRecords.filter((customer) => customer.isActive), [customerRecords]);
  const pastCustomerRecords = useMemo(() => customerRecords.filter((customer) => customer.orders.length && !customer.isActive), [customerRecords]);
  const accountCustomerRecords = useMemo(() => customerRecords.filter((customer) => customer.customerUserId), [customerRecords]);
  const visibleCustomers = customerView === "active"
    ? activeCustomerRecords
    : customerView === "past"
      ? pastCustomerRecords
      : customerView === "accounts"
        ? accountCustomerRecords
        : customerRecords;
  const linkedCustomer = customerDraft
    ? customerRecords.find((customer) => customer.id === customerDraft.id)
    : null;
  const revenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.totalCost || 0), 0);
  const inventoryValue = inventory.reduce((sum, item) => (
    sum + Number(item.amount || 0) * Number(item.unitCost || 0)
  ), 0);
  const weeks = useMemo(() => spendingSeries(expenses), [expenses]);
  const maximumSpend = Math.max(1, ...weeks.map((week) => week.total));
  const recentSpend = weeks.reduce((sum, week) => sum + week.total, 0);
  const activeOrders = useMemo(() => orders.filter(isActiveOrder), [orders]);
  const readyOrders = useMemo(() => orders.filter(isReadyOrder), [orders]);
  const lowStockItems = useMemo(() => inventory.filter((item) => (
    Number(item.amount || 0) < Number(item.target || 0)
  )), [inventory]);
  const unpaidOrders = useMemo(() => activeOrders.filter((order) => (
    !isPaidOrder(order) || isDepositOrder(order)
  )), [activeOrders]);
  const missingPickupOrders = useMemo(() => activeOrders.filter((order) => !hasPickupTarget(order)), [activeOrders]);
  const todayPickupOrders = useMemo(() => activeOrders.filter((order) => (
    dateKey(order.pickupAt) === todayKey || (!order.pickupAt && String(order.due || "").toLowerCase() === "today")
  )), [activeOrders, todayKey]);
  const productStats = useMemo(() => productStatsFromOrders(orders), [orders]);
  const bestSeller = productStats[0] || null;
  const revenueLeader = topBy(productStats, "revenue");
  const repeatCustomers = customerRecords.filter((customer) => customer.orders.length > 1);
  const averageOrderValue = orders.length ? revenue / orders.length : 0;
  const restockCost = lowStockItems.reduce((sum, item) => (
    sum + Math.max(0, Number(item.target || 0) - Number(item.amount || 0)) * Number(item.unitCost || 0)
  ), 0);
  const hiddenProductOrders = useMemo(() => {
    const restrictedRecipes = recipes.filter((recipe) => (
      recipe.hiddenThisWeek || recipe.soldOut || recipe.unavailableThisWeek
    ));
    if (!restrictedRecipes.length) return [];
    return activeOrders.filter((order) => restrictedRecipes.some((recipe) => (
      String(activeProductName(order)).toLowerCase().includes(String(recipe.name || "").toLowerCase())
    )));
  }, [activeOrders, recipes]);
  const starterLoggedToday = starterLogs.some((log) => dateKey(log.dateTime || log.createdAt) === todayKey);
  const hasLiquidSafetyProducts = recipes.some((recipe) => LIQUID_SAFETY_TYPES.has(recipe.productType));
  const recentLiquidSafetyLog = liquidSafetyLogs.some((log) => {
    const date = new Date(log.updatedAt || log.batchDate || log.createdAt);
    if (Number.isNaN(date.getTime())) return false;
    return Date.now() - date.getTime() < 30 * 24 * 60 * 60 * 1000;
  });
  const ownerAlerts = useMemo(() => {
    const alerts = [];
    if (lowStockItems.length) {
      alerts.push({
        id: "low-stock",
        tone: "warning",
        title: `${lowStockItems.length} inventory item${lowStockItems.length === 1 ? "" : "s"} below target`,
        body: lowStockItems.slice(0, 3).map((item) => item.name).join(", "),
        action: () => editInventory(lowStockItems[0]),
        actionLabel: "Open stock",
      });
    }
    if (unpaidOrders.length) {
      alerts.push({
        id: "unpaid-orders",
        tone: "danger",
        title: `${unpaidOrders.length} active order${unpaidOrders.length === 1 ? "" : "s"} need payment review`,
        body: unpaidOrders.slice(0, 3).map((order) => order.customer).join(", "),
        action: () => setOrderHistoryOpen(true),
        actionLabel: "Review orders",
      });
    }
    if (missingPickupOrders.length) {
      alerts.push({
        id: "missing-pickups",
        tone: "warning",
        title: `${missingPickupOrders.length} active order${missingPickupOrders.length === 1 ? "" : "s"} missing pickup timing`,
        body: "Add pickup dates so capacity, feed timing, and production flow stay accurate.",
        action: () => setOrderHistoryOpen(true),
        actionLabel: "Open history",
      });
    }
    if (hiddenProductOrders.length) {
      alerts.push({
        id: "hidden-product-orders",
        tone: "danger",
        title: "Weekly product status conflicts with open orders",
        body: `${hiddenProductOrders.length} open order${hiddenProductOrders.length === 1 ? "" : "s"} match sold-out, hidden, or unavailable products.`,
        action: () => setActive("settings"),
        actionLabel: "Product settings",
      });
    }
    if (hasLiquidSafetyProducts && !recentLiquidSafetyLog) {
      alerts.push({
        id: "liquid-safety",
        tone: "warning",
        title: "Liquid safety logs need a recent entry",
        body: "Hot sauce, vinegar, and infused-oil products should have pH/salt/batch notes before sale.",
        action: () => setActive("production"),
        actionLabel: "Open production",
      });
    }
    return alerts;
  }, [hasLiquidSafetyProducts, hiddenProductOrders, lowStockItems, missingPickupOrders, recentLiquidSafetyLog, setActive, unpaidOrders]);
  const workflowCards = [
    {
      id: "today",
      label: "Today",
      title: "Command center",
      note: `${todayPickupOrders.length} pickup${todayPickupOrders.length === 1 ? "" : "s"} today · ${kitchenBakes.length} kitchen bake${kitchenBakes.length === 1 ? "" : "s"}`,
    },
    {
      id: "orders",
      label: "Orders",
      title: "Requests + customers",
      note: `${activeOrders.length} active · ${customerRecords.length} customer record${customerRecords.length === 1 ? "" : "s"}`,
    },
    {
      id: "production",
      label: "Production",
      title: "Bread + liquid work",
      note: `${readyOrders.length} schedulable order${readyOrders.length === 1 ? "" : "s"} · ${liquidSafetyLogs.length} safety log${liquidSafetyLogs.length === 1 ? "" : "s"}`,
    },
    {
      id: "menu",
      label: "Menu",
      title: "Products + shelf",
      note: `${recipes.length} product${recipes.length === 1 ? "" : "s"} · weekly availability lives in settings`,
    },
    {
      id: "business",
      label: "Business",
      title: "Money + records",
      note: "Reports, stock, purchases, customer records, and bakery settings.",
    },
  ];
  const qualityTasks = [
    {
      id: "orders",
      title: "Review today’s order book",
      note: todayPickupOrders.length
        ? `${todayPickupOrders.length} pickup${todayPickupOrders.length === 1 ? "" : "s"} staged for today.`
        : "No pickups due today.",
      autoDone: todayPickupOrders.length === 0,
    },
    {
      id: "inventory",
      title: "Check shortages before mixing",
      note: lowStockItems.length
        ? `${lowStockItems.slice(0, 3).map((item) => item.name).join(", ")} below target.`
        : "Inventory targets are clear.",
      autoDone: lowStockItems.length === 0,
    },
    {
      id: "starter",
      title: "Starter / preferment health checked",
      note: starterLoggedToday ? "Starter log recorded today." : "Log a feed or rise check if sourdough is on deck.",
      autoDone: starterLoggedToday,
    },
    {
      id: "labels",
      title: "Labels and pickup notes ready",
      note: todayPickupOrders.length ? "Print labels or stage pickup notes before handoff." : "Nothing to label for today yet.",
      autoDone: todayPickupOrders.length === 0,
    },
    {
      id: "customers",
      title: "Customer messages reviewed",
      note: unpaidOrders.length ? `${unpaidOrders.length} payment/status follow-up${unpaidOrders.length === 1 ? "" : "s"} to review.` : "No payment follow-ups flagged.",
      autoDone: unpaidOrders.length === 0,
    },
    {
      id: "safety",
      title: "Food safety notes current",
      note: hasLiquidSafetyProducts
        ? (recentLiquidSafetyLog ? "Recent liquid safety batch log found." : "Add pH/salt/storage notes for liquid goods.")
        : "No liquid safety products active.",
      autoDone: !hasLiquidSafetyProducts || recentLiquidSafetyLog,
    },
  ];
  const completedQualityCount = qualityTasks.filter((task) => task.autoDone || manualQualityChecks[task.id]).length;
  const reportCards = [
    {
      label: "Best seller",
      value: bestSeller?.name || "No sales yet",
      note: bestSeller ? `${bestSeller.quantity} unit${bestSeller.quantity === 1 ? "" : "s"} across ${bestSeller.orders} order${bestSeller.orders === 1 ? "" : "s"}` : "Orders will rank here.",
    },
    {
      label: "Revenue leader",
      value: revenueLeader?.name || "No revenue yet",
      note: revenueLeader ? `$${revenueLeader.revenue.toFixed(2)} booked` : "Booked revenue by product.",
    },
    {
      label: "Average order",
      value: `$${averageOrderValue.toFixed(2)}`,
      note: `${orders.length} order${orders.length === 1 ? "" : "s"} tracked`,
    },
    {
      label: "Repeat customers",
      value: `${repeatCustomers.length}`,
      note: customerRecords.length ? `${Math.round(repeatCustomers.length / customerRecords.length * 100)}% of customer records` : "Customer history will build this.",
    },
    {
      label: "Restock exposure",
      value: `$${restockCost.toFixed(2)}`,
      note: lowStockItems.length ? "Estimated spend to reach targets" : "No restock gap right now.",
    },
    {
      label: "Unpaid exposure",
      value: `$${unpaidOrders.reduce((sum, order) => sum + Number(order.total || 0), 0).toFixed(2)}`,
      note: `${unpaidOrders.length} active order${unpaidOrders.length === 1 ? "" : "s"} need payment attention`,
    },
  ];
  const traceabilityStats = [
    { label: "Order codes", value: orders.filter((order) => order.requestCode || order.cloudOrderId).length },
    { label: "Inventory-deducted", value: orders.filter((order) => order.inventoryDeductedAt).length },
    { label: "Batch traces", value: batchTraceRecords.length },
    { label: "Safety logs", value: liquidSafetyLogs.length },
  ];
  const productCostRows = useMemo(() => recipes.map((recipe) => {
    const costing = estimateRecipeEconomics(recipe, inventory);
    return {
      recipe,
      costing,
      bestOption: costing.bestProfitOption || costing.lowestPriceOption,
      lowestOption: costing.lowestPriceOption,
    };
  }).sort((a, b) => (
    Number(b.bestOption?.profitPerBakeSlot || 0) - Number(a.bestOption?.profitPerBakeSlot || 0)
  )), [inventory, recipes]);
  const underpricedRows = productCostRows.filter((row) => row.costing.underpriced);
  const bestProfitPerSlot = productCostRows[0];

  function editInventory(item) {
    setInventoryForm(item ? { ...item, isNew: false } : {
      ...emptyInventoryItem,
      id: `inventory-${Date.now()}`,
      isNew: true,
    });
    setConfirmDeleteId(null);
  }

  function openTraceForm(record = null) {
    const recipe = record?.recipeId
      ? recipes.find((item) => item.id === record.recipeId)
      : recipes[0];
    setTraceForm(record ? {
      ...record,
      orderIdsText: (record.orderIds || []).join(", "),
      customerNamesText: (record.customerNames || []).join(", "),
      ingredientLotsText: (record.ingredientLots || []).map((lot) => `${lot.name}: ${lot.lot}`).join("\n"),
    } : {
      id: "",
      batchCode: batchCodeFor(recipe?.name || "Batch"),
      batchDate: new Date().toISOString().slice(0, 10),
      recipeId: recipe?.id || "",
      recipeName: recipe?.name || "",
      producedUnits: recipe?.yield || 1,
      unitName: recipe?.unitName || "item",
      orderIdsText: "",
      customerNamesText: "",
      ingredientLotsText: "",
      qualityNotes: "",
      outcomeNotes: "",
      source: "manual",
      status: "completed",
    });
  }

  function updateTraceRecipe(recipeId) {
    const recipe = recipes.find((item) => item.id === recipeId);
    setTraceForm((current) => ({
      ...current,
      recipeId,
      recipeName: recipe?.name || current.recipeName,
      producedUnits: current.producedUnits || recipe?.yield || 1,
      unitName: recipe?.unitName || current.unitName || "item",
      batchCode: current.batchCode || batchCodeFor(recipe?.name || "Batch"),
    }));
  }

  function saveTraceRecord(event) {
    event.preventDefault();
    if (!traceForm || !onSaveBatchTraceRecord) return;
    const recipe = recipes.find((item) => item.id === traceForm.recipeId);
    const ingredientLots = String(traceForm.ingredientLotsText || "")
      .split("\n")
      .map((line) => {
        const [name, ...rest] = line.split(":");
        return { name: name?.trim(), lot: rest.join(":").trim() };
      })
      .filter((lot) => lot.name || lot.lot);
    onSaveBatchTraceRecord({
      ...traceForm,
      batchCode: traceForm.batchCode?.trim(),
      recipeId: recipe?.id || traceForm.recipeId || "",
      recipeName: recipe?.name || traceForm.recipeName || "Manual batch",
      recipeVersions: recipe ? [{
        id: recipe.id,
        name: recipe.name,
        version: Number(recipe.currentVersion || 1),
        versionLabel: recipeVersionLabel(recipe),
        productType: recipe.productType || "bread",
        yield: recipe.yield,
        unitName: recipe.unitName,
      }] : traceForm.recipeVersions || [],
      producedUnits: Number(traceForm.producedUnits || 0),
      orderIds: String(traceForm.orderIdsText || "").split(",").map((value) => value.trim()).filter(Boolean),
      customerNames: String(traceForm.customerNamesText || "").split(",").map((value) => value.trim()).filter(Boolean),
      ingredientLots,
      qualityNotes: traceForm.qualityNotes || "",
      outcomeNotes: traceForm.outcomeNotes || "",
    });
    setTraceForm(null);
  }

  function toggleQualityTask(id) {
    setQualityLog((current) => {
      const checked = current?.date === todayKey ? current.checked || {} : {};
      return {
        checked: {
          ...checked,
          [id]: !checked[id],
        },
        date: todayKey,
      };
    });
  }

  function openCustomerDirectory(view = "active", options = {}) {
    setCustomerView(view);
    if (options.modal !== false) setCustomerDirectoryOpen(true);
    const firstCustomer = view === "active"
      ? activeCustomerRecords[0]
      : view === "past"
        ? pastCustomerRecords[0]
        : view === "accounts"
          ? accountCustomerRecords[0]
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
    if (businessArea !== "customers") setCustomerDirectoryOpen(true);
  }

  useEffect(() => {
    if (!businessFocus?.area) return;
    if (businessFocus.area === "logbook") {
      setBusinessArea("logbook");
      setCustomerDirectoryOpen(false);
      setOrderHistoryOpen(false);
      document.querySelector(".scroll-view")?.scrollTo({ top: 0, left: 0 });
      return;
    }
    if (businessFocus.area === "customers") {
      setBusinessArea("customers");
      setOrderHistoryOpen(false);
      setCustomerDirectoryOpen(false);
      openCustomerDirectory("active", { modal: false });
      return;
    }
    if (businessFocus.area === "reports") {
      setBusinessArea("reports");
      setOrderHistoryOpen(false);
      setCustomerDirectoryOpen(false);
      document.querySelector(".scroll-view")?.scrollTo({ top: 0, left: 0 });
    }
  }, [businessFocus?.area, businessFocus?.nonce]);

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

  function renderOrderHistoryPanel(pageMode = false) {
    return (
      <div className={`order-history-panel ${pageMode ? "business-page-panel" : ""}`}>
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
    );
  }

  function renderCustomerDirectoryPanel(pageMode = false) {
    return (
      <div className={`customer-directory-panel ${pageMode ? "business-page-panel" : ""}`}>
        <div className="customer-directory-toolbar">
          <div className="segmented-control customer-filter">
            <button type="button" className={customerView === "active" ? "selected" : ""} onClick={() => setCustomerView("active")}>Active <span>{activeCustomerRecords.length}</span></button>
            <button type="button" className={customerView === "past" ? "selected" : ""} onClick={() => setCustomerView("past")}>Past <span>{pastCustomerRecords.length}</span></button>
            <button type="button" className={customerView === "accounts" ? "selected" : ""} onClick={() => setCustomerView("accounts")}>Accounts <span>{accountCustomerRecords.length}</span></button>
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
                  {customer.customerUserId ? <em>Customer account</em> : null}
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
                  <small>{linkedCustomer?.orders.length || 0} linked order record{(linkedCustomer?.orders.length || 0) === 1 ? "" : "s"}</small>
                </span>
              </div>
              <div className="customer-profile-stats">
                <span><strong>{linkedCustomer?.orders.length || 0}</strong><small>Lifetime orders</small></span>
                <span><strong>${Number(linkedCustomer?.totalSpent || 0).toFixed(2)}</strong><small>Total spent</small></span>
                <span><strong>{linkedCustomer?.lastOrderAt ? dateTimeLabel(linkedCustomer.lastOrderAt) : "—"}</strong><small>Last order</small></span>
                {customerDraft.customerUserId || linkedCustomer?.customerUserId ? (
                  <span><strong>{dateTimeLabel(customerDraft.lastAccountProfileAt || linkedCustomer?.lastAccountProfileAt) || "Linked"}</strong><small>Account saved</small></span>
                ) : null}
              </div>
              {customerDraft.customerUserId || linkedCustomer?.customerUserId ? (
                <p className="customer-account-link-note"><UserRound size={13} /> Customer account linked</p>
              ) : null}
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
    );
  }

  if (businessArea === "logbook") {
    return (
      <main className="page business-page business-subpage">
        <PageHeading
          title="Logbook"
          subtitle="A full order record trail with pickup, payment, allergy, customer notes, and bake-progress details."
          action={<button className="small-action-button" type="button" onClick={() => setBusinessArea("reports")}><LineChart size={15} /> Reports</button>}
        />
        <section className="business-subpage-card">
          {renderOrderHistoryPanel(true)}
        </section>
      </main>
    );
  }

  if (businessArea === "customers") {
    return (
      <main className="page business-page business-subpage customer-directory-page">
        <PageHeading
          title="Customers"
          subtitle="Customer profiles, allergies, preferences, contact info, pickup notes, payment notes, and linked order history."
          action={<button className="small-action-button" type="button" onClick={() => setBusinessArea("reports")}><LineChart size={15} /> Reports</button>}
        />
        <section className="business-subpage-card customer-subpage-card">
          {renderCustomerDirectoryPanel(true)}
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <PageHeading
        title="Business"
        subtitle="Money, stock, purchases, customers, and the pulse of your one-person bakery."
        action={<button className="round-action" type="button" onClick={() => setActive("settings")} aria-label="Open bakery settings"><Settings2 size={20} /></button>}
      />

      <section className="owner-flow-card">
        <div className="section-title-line">
          <div><span className="eyebrow-label dark">Professional flow</span><h2>Where work belongs</h2></div>
          <Gauge size={22} />
        </div>
        <div className="owner-flow-grid">
          {workflowCards.map((card) => (
            <button
              type="button"
              className={`owner-flow-step ${card.id === "business" ? "current" : ""}`}
              key={card.id}
              onClick={() => setActive(card.id)}
            >
              <span>{card.label}</span>
              <strong>{card.title}</strong>
              <small>{card.note}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="owner-command-grid" aria-label="Owner command center">
        <div className="owner-alerts-card">
          <div className="section-title-line">
            <div><span className="eyebrow-label dark">Smart alerts</span><h2>What changed?</h2></div>
            <AlertTriangle size={21} />
          </div>
          <div className="owner-alert-list">
            {ownerAlerts.length ? ownerAlerts.map((alert) => (
              <button type="button" className={`owner-alert-row ${alert.tone}`} key={alert.id} onClick={alert.action}>
                {alert.tone === "danger" ? <AlertTriangle size={18} /> : <BellRing size={18} />}
                <span><strong>{alert.title}</strong><small>{alert.body}</small></span>
                <em>{alert.actionLabel}</em>
              </button>
            )) : (
              <article className="owner-alert-row clear">
                <CheckCircle2 size={18} />
                <span><strong>No major conflicts</strong><small>Orders, availability, payment, stock, and safety logs look calm.</small></span>
                <em>Clear</em>
              </article>
            )}
          </div>
        </div>

        <div className="owner-quality-card">
          <div className="section-title-line">
            <div><span className="eyebrow-label dark">Owner quality</span><h2>Daily checklist</h2></div>
            <ClipboardCheck size={21} />
          </div>
          <div className="quality-progress">
            <strong>{completedQualityCount}/{qualityTasks.length}</strong>
            <span>checks complete for {new Date(`${todayKey}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
          </div>
          <div className="quality-check-list">
            {qualityTasks.map((task) => {
              const checked = task.autoDone || Boolean(manualQualityChecks[task.id]);
              return (
                <label className={`quality-check-row ${checked ? "complete" : ""} ${task.autoDone ? "auto" : ""}`} key={task.id}>
                  <input type="checkbox" checked={checked} disabled={task.autoDone} onChange={() => toggleQualityTask(task.id)} />
                  <span><strong>{task.title}</strong><small>{task.note}</small></span>
                  <em>{task.autoDone ? "Auto" : checked ? "Checked" : "Review"}</em>
                </label>
              );
            })}
          </div>
        </div>
      </section>

      <section className="owner-reports-card">
        <div className="section-title-line">
          <div><span className="eyebrow-label dark">Better reporting</span><h2>Owner answers</h2></div>
          <TrendingUp size={22} />
        </div>
        <div className="owner-report-grid">
          {reportCards.map((card) => (
            <article key={card.label}>
              <small>{card.label}</small>
              <strong>{card.value}</strong>
              <span>{card.note}</span>
            </article>
          ))}
        </div>
        <div className="owner-traceability-strip">
          <ShieldCheck size={18} />
          <span><strong>Batch trail foundation</strong><small>These counts show which records already connect orders, batches, safety, and inventory.</small></span>
          <div>
            {traceabilityStats.map((stat) => (
              <em key={stat.label}>{stat.value} {stat.label}</em>
            ))}
          </div>
        </div>
        {productStats.length ? (
          <div className="owner-product-rank">
            <strong>Product ranking</strong>
            {productStats.slice(0, 4).map((product, index) => (
              <span key={product.name}>
                <small>{index + 1}</small>
                <b>{product.name}</b>
                <em>{product.quantity} units · ${product.revenue.toFixed(2)}</em>
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <section className="pricing-intelligence-card">
        <div className="section-title-line">
          <div><span className="eyebrow-label dark">Pricing intelligence</span><h2>Cost, margin, and oven-slot value</h2></div>
          <CircleDollarSign size={22} />
        </div>
        <div className="pricing-intelligence-summary">
          <article>
            <small>Best per bake slot</small>
            <strong>{bestProfitPerSlot?.recipe.name || "No recipes yet"}</strong>
            <span>{bestProfitPerSlot?.bestOption ? `$${bestProfitPerSlot.bestOption.profitPerBakeSlot.toFixed(2)} profit / slot` : "Add recipe pricing and inventory costs."}</span>
          </article>
          <article className={underpricedRows.length ? "warning" : ""}>
            <small>Underpriced flags</small>
            <strong>{underpricedRows.length}</strong>
            <span>{underpricedRows.length ? "One or more packages are under 35% margin." : "No low-margin packages flagged."}</span>
          </article>
          <article>
            <small>Recipes costed</small>
            <strong>{productCostRows.length}</strong>
            <span>Uses inventory, labor, overhead, and packaging estimates.</span>
          </article>
        </div>
        <div className="pricing-intelligence-list">
          {productCostRows.length ? productCostRows.slice(0, 8).map(({ recipe, costing, bestOption, lowestOption }) => (
            <article className={costing.underpriced ? "pricing-product-row warning" : "pricing-product-row"} key={recipe.id}>
              <span>
                <strong>{recipe.name}</strong>
                <small>{recipeVersionLabel(recipe)} · batch cost ${costing.baseCost.toFixed(2)} · unit cost ${costing.costPerUnit.toFixed(2)}</small>
              </span>
              <span>
                <strong>{bestOption ? `$${bestOption.profitPerBakeSlot.toFixed(2)}` : "—"}</strong>
                <small>profit / bake slot</small>
              </span>
              <span>
                <strong>{lowestOption ? `${lowestOption.margin.toFixed(0)}%` : "—"}</strong>
                <small>lowest package margin</small>
              </span>
              <button type="button" className="text-button" onClick={() => setActive("menu")}>Open recipe</button>
            </article>
          )) : <EmptyState title="No product costing yet" body="Add recipes, inventory unit costs, and package prices to rank products by margin." />}
        </div>
      </section>

      <section className="batch-trace-card">
        <div className="section-title-line">
          <div><span className="eyebrow-label dark">Traceability</span><h2>Batch records</h2></div>
          <button type="button" className="small-action-button" onClick={() => openTraceForm()}><Plus size={15} /> Trace</button>
        </div>
        <div className="batch-trace-list">
          {batchTraceRecords.length ? batchTraceRecords.slice(0, 8).map((record) => (
            <article className="batch-trace-row" key={record.id}>
              <span>
                <strong>{record.batchCode || "Batch"}</strong>
                <small>{record.recipeName || "Recipe"} · {(record.recipeVersions || []).map((version) => version.versionLabel || `v${version.version}`).join(", ") || "version not linked"}</small>
              </span>
              <span><strong>{record.producedUnits || 0}</strong><small>{record.unitName || "items"}</small></span>
              <span><strong>{(record.customerNames || []).length}</strong><small>customer links</small></span>
              <span><strong>{record.batchDate || "No date"}</strong><small>{record.source || "manual"}</small></span>
              <button type="button" className="text-button" onClick={() => openTraceForm(record)}>Open</button>
            </article>
          )) : <EmptyState title="No batch traces yet" body="Completing orders and Kitchen bakes will create records automatically, or add a manual trace here." />}
        </div>
      </section>

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

      {traceForm ? (
        <Modal title={traceForm.id ? `Batch ${traceForm.batchCode}` : "Add batch trace"} onClose={() => setTraceForm(null)}>
          <form className="form-stack" onSubmit={saveTraceRecord}>
            <div className="form-grid">
              <label>Batch / lot code<input required value={traceForm.batchCode || ""} onChange={(event) => setTraceForm({ ...traceForm, batchCode: event.target.value })} /></label>
              <label>Batch date<input type="date" value={traceForm.batchDate || ""} onChange={(event) => setTraceForm({ ...traceForm, batchDate: event.target.value })} /></label>
            </div>
            <label>
              Recipe
              <select value={traceForm.recipeId || ""} onChange={(event) => updateTraceRecipe(event.target.value)}>
                <option value="">Manual / no recipe</option>
                {recipes.map((recipe) => <option value={recipe.id} key={recipe.id}>{recipe.name} · {recipeVersionLabel(recipe)}</option>)}
              </select>
            </label>
            <div className="form-grid">
              <label>Units made<input type="number" min="0" step="1" value={traceForm.producedUnits || 0} onChange={(event) => setTraceForm({ ...traceForm, producedUnits: event.target.value })} /></label>
              <label>Unit name<input value={traceForm.unitName || ""} onChange={(event) => setTraceForm({ ...traceForm, unitName: event.target.value })} /></label>
            </div>
            <label>Linked order IDs<input value={traceForm.orderIdsText || ""} onChange={(event) => setTraceForm({ ...traceForm, orderIdsText: event.target.value })} placeholder="1001, 1002, online request code…" /></label>
            <label>Customers who received this batch<input value={traceForm.customerNamesText || ""} onChange={(event) => setTraceForm({ ...traceForm, customerNamesText: event.target.value })} placeholder="Joshua, Sarah, market table…" /></label>
            <label>Ingredient lots<textarea value={traceForm.ingredientLotsText || ""} onChange={(event) => setTraceForm({ ...traceForm, ingredientLotsText: event.target.value })} placeholder={"Bread flour: Costco 06/30\nSalt: Morton box A"} /></label>
            <label>Quality notes<textarea value={traceForm.qualityNotes || ""} onChange={(event) => setTraceForm({ ...traceForm, qualityNotes: event.target.value })} placeholder="Overproofed, great crumb, weak rise, reduce hydration next time…" /></label>
            <label>Outcome / recall notes<textarea value={traceForm.outcomeNotes || ""} onChange={(event) => setTraceForm({ ...traceForm, outcomeNotes: event.target.value })} placeholder="Who got it, what to pull, what changed, customer feedback…" /></label>
            <button className="primary-button" type="submit">Save batch trace</button>
            {traceForm.id && onDeleteBatchTraceRecord ? (
              <button type="button" className="delete-order-button" onClick={() => {
                onDeleteBatchTraceRecord(traceForm.id);
                setTraceForm(null);
              }}><Trash2 size={15} /> Delete trace</button>
            ) : null}
          </form>
        </Modal>
      ) : null}

      {customerDirectoryOpen ? (
        <Modal title="Customer directory" onClose={() => setCustomerDirectoryOpen(false)}>
          <div className="customer-directory-panel">
            <div className="customer-directory-toolbar">
              <div className="segmented-control customer-filter">
                <button type="button" className={customerView === "active" ? "selected" : ""} onClick={() => setCustomerView("active")}>Active <span>{activeCustomerRecords.length}</span></button>
                <button type="button" className={customerView === "past" ? "selected" : ""} onClick={() => setCustomerView("past")}>Past <span>{pastCustomerRecords.length}</span></button>
                <button type="button" className={customerView === "accounts" ? "selected" : ""} onClick={() => setCustomerView("accounts")}>Accounts <span>{accountCustomerRecords.length}</span></button>
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
                      {customer.customerUserId ? <em>Customer account</em> : null}
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
                      <small>{linkedCustomer?.orders.length || 0} linked order record{(linkedCustomer?.orders.length || 0) === 1 ? "" : "s"}</small>
                    </span>
                  </div>
                  <div className="customer-profile-stats">
                    <span><strong>{linkedCustomer?.orders.length || 0}</strong><small>Lifetime orders</small></span>
                    <span><strong>${Number(linkedCustomer?.totalSpent || 0).toFixed(2)}</strong><small>Total spent</small></span>
                    <span><strong>{linkedCustomer?.lastOrderAt ? dateTimeLabel(linkedCustomer.lastOrderAt) : "—"}</strong><small>Last order</small></span>
                    {customerDraft.customerUserId || linkedCustomer?.customerUserId ? (
                      <span><strong>{dateTimeLabel(customerDraft.lastAccountProfileAt || linkedCustomer?.lastAccountProfileAt) || "Linked"}</strong><small>Account saved</small></span>
                    ) : null}
                  </div>
                  {customerDraft.customerUserId || linkedCustomer?.customerUserId ? (
                    <p className="customer-account-link-note"><UserRound size={13} /> Customer account linked</p>
                  ) : null}
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
