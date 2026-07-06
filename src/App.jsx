import {
  ChefHat,
  ClipboardList,
  PackageCheck,
  Receipt,
  Settings2,
  Wheat,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BottomNav, GlobalQuickAction } from "./components/AppChrome";
import { InstallAppPrompt } from "./components/InstallAppPrompt";
import { Modal, Toast } from "./components/Primitives";
import { StorageCenter } from "./components/StorageCenter";
import {
  recipes as seedRecipes,
  seedExpenses,
  seedInventory,
  seedOrders,
  seedStarters,
} from "./data/seed";
import { usePersistentState } from "./hooks/usePersistentState";
import { useCloudAccount } from "./hooks/useCloudAccount";
import {
  cancelCustomerOrderCapacity,
  completeCustomerOrder,
  listBakeryCustomerProfiles,
  loadBakerySettings,
  saveBakerySettings,
  syncBakerCapacityReservations,
  updateCustomerOrderBakeProgress,
} from "./lib/cloud";
import { DEFAULT_BAKERY_SETTINGS, normalizedBakerySettings } from "./lib/bakerySettings";
import { BAKE_PHASES, normalizedBakeProgress } from "./lib/bakeProgress";
import {
  deductInventoryForOrder,
  DEFAULT_PRODUCTION_AUTOMATION,
  orderProductionLines,
} from "./lib/productionPlanner";
import { buildBakeSchedule } from "./lib/fermentationModel";
import { normalizeTimelineSettings, recipeUsesStarter } from "./lib/recipeTimeline";
import {
  batchCodeFor,
  recipeVersionLabel,
  withRecipeVersion,
} from "./lib/recipeVersions";
import BakePage from "./pages/BakePage";
import CustomerOrderPortal from "./pages/CustomerOrderPortal";
import LiquidPage from "./pages/LiquidPage";
import MenuPage from "./pages/MenuPage";
import MorePage from "./pages/MorePage";
import OrdersPage from "./pages/OrdersPage";
import ProductionPage from "./pages/ProductionPage";
import RecipesPage from "./pages/RecipesPage";
import ResourceHubPage from "./pages/ResourceHubPage";
import SettingsPage from "./pages/SettingsPage";
import TodayPage from "./pages/TodayPage";
import HelpPage from "./pages/HelpPage";

// customer-options-v1
// checkout-flow-v1

const pages = {
  today: TodayPage,
  orders: OrdersPage,
  production: ProductionPage,
  menu: MenuPage,
  business: MorePage,
  settings: SettingsPage,
  help: HelpPage,
  resources: ResourceHubPage,
};

const pageAliases = {
  bake: "production",
  liquid: "production",
  recipes: "menu",
  more: "business",
  trends: "business",
};

function canonicalPage(page) {
  if (page === "settings") return "settings";
  return pageAliases[page] || page || "today";
}

function customerSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function cleanEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function cleanPhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function localDateTimeValue(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function localDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function defaultMenuBakeStart() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(6, 30, 0, 0);
  return date;
}

function appendUniqueNote(existing, note) {
  const current = String(existing || "").trim();
  const next = String(note || "").trim();
  if (!next) return current;
  if (!current) return next;
  return current.includes(next) ? current : `${current}\n${next}`;
}

function mergeCommaList(existing, additions = []) {
  const values = [
    ...String(existing || "").split(","),
    ...additions,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return [...new Set(values)].slice(0, 8).join(", ");
}

function extractSavedField(notes, label) {
  const match = String(notes || "").match(new RegExp(`${label}:\\s*([^\\n]+)`, "i"));
  return match?.[1]?.trim() || "";
}

function profileIdFromCloudOrder(request) {
  const accountId = String(request.customer_user_id || "").trim();
  const customerId = String(request.customer_id || "").trim();
  const email = cleanEmail(request.customer_email);
  const phone = cleanPhone(request.customer_phone);
  if (accountId) return `account-${accountId}`;
  if (customerId) return `cloud-${customerId}`;
  if (email) return `email-${customerSlug(email)}`;
  if (phone) return `phone-${phone}`;
  return customerSlug(request.customer_name) || `customer-${Date.now()}`;
}

function upsertCustomerProfileFromCloudOrder(currentProfiles, request, order) {
  const email = cleanEmail(request.customer_email);
  const phone = cleanPhone(request.customer_phone);
  const accountId = String(request.customer_user_id || "").trim();
  const customerId = String(request.customer_id || "").trim();
  const nameKey = customerSlug(request.customer_name);
  const productNames = (order.items || [])
    .map((item) => item.product_name)
    .filter(Boolean);
  const savedPreferences = extractSavedField(request.customer_notes, "Saved preferences");
  const savedAddress = extractSavedField(request.customer_notes, "Saved pickup note");
  const existingIndex = currentProfiles.findIndex((profile) => (
    (accountId && profile.customerUserId === accountId)
    || (customerId && profile.customerId === customerId)
    || (email && cleanEmail(profile.email) === email)
    || (phone && cleanPhone(profile.phone) === phone)
    || (!email && !phone && nameKey && customerSlug(profile.name) === nameKey)
  ));
  const existing = existingIndex >= 0 ? currentProfiles[existingIndex] : {};
  const linkedNote = `Online request ${request.request_code}${accountId ? " · signed-in account" : ""}`;
  const merged = {
    ...existing,
    id: existing.id || profileIdFromCloudOrder(request),
    customerId: existing.customerId || customerId,
    customerUserId: existing.customerUserId || accountId,
    name: existing.name && existing.name !== "Customer" ? existing.name : request.customer_name || "Customer",
    email: existing.email || request.customer_email || "",
    phone: existing.phone || request.customer_phone || "",
    allergies: existing.allergies || request.allergies || "",
    preferences: existing.preferences || savedPreferences || "",
    address: existing.address || savedAddress || "",
    pickupNotes: existing.pickupNotes || request.pickup_location || "",
    paymentNotes: existing.paymentNotes || request.payment_method || "",
    favoriteItems: mergeCommaList(existing.favoriteItems, productNames),
    notes: appendUniqueNote(existing.notes, linkedNote),
    lastCloudOrderAt: order.pickupAt || request.created_at || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (existingIndex >= 0) {
    return currentProfiles.map((profile, index) => (index === existingIndex ? merged : profile));
  }
  return [merged, ...currentProfiles];
}

function profileIdFromSavedAccount(profile) {
  const accountId = String(profile.user_id || "").trim();
  const email = cleanEmail(profile.email);
  const phone = cleanPhone(profile.phone);
  if (accountId) return `account-${accountId}`;
  if (email) return `email-${customerSlug(email)}`;
  if (phone) return `phone-${phone}`;
  return customerSlug(profile.full_name) || `account-profile-${Date.now()}`;
}

function upsertCustomerProfileFromSavedAccount(currentProfiles, savedProfile) {
  const accountId = String(savedProfile.user_id || "").trim();
  const email = cleanEmail(savedProfile.email);
  const phone = cleanPhone(savedProfile.phone);
  const nameKey = customerSlug(savedProfile.full_name);
  const existingIndex = currentProfiles.findIndex((profile) => (
    (accountId && profile.customerUserId === accountId)
    || (email && cleanEmail(profile.email) === email)
    || (phone && cleanPhone(profile.phone) === phone)
    || (!email && !phone && nameKey && customerSlug(profile.name) === nameKey)
  ));
  const existing = existingIndex >= 0 ? currentProfiles[existingIndex] : {};
  const linkedNote = "Customer account profile synced";
  const merged = {
    ...existing,
    id: existing.id || profileIdFromSavedAccount(savedProfile),
    customerUserId: existing.customerUserId || accountId,
    name: savedProfile.full_name || existing.name || "Customer",
    email: savedProfile.email || existing.email || "",
    phone: savedProfile.phone || existing.phone || "",
    allergies: savedProfile.allergies || existing.allergies || "",
    preferences: savedProfile.preferences || existing.preferences || "",
    address: savedProfile.address || existing.address || "",
    paymentNotes: savedProfile.default_payment_method || existing.paymentNotes || "",
    favoriteItems: mergeCommaList(existing.favoriteItems, [savedProfile.favorite_product_name]),
    notes: appendUniqueNote(existing.notes, linkedNote),
    lastAccountProfileAt: savedProfile.updated_at || savedProfile.created_at || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (existingIndex >= 0) {
    return currentProfiles.map((profile, index) => (index === existingIndex ? merged : profile));
  }
  return [merged, ...currentProfiles];
}

function mergeSavedCustomerProfiles(currentProfiles, savedProfiles = []) {
  return savedProfiles.reduce(
    (profiles, savedProfile) => upsertCustomerProfileFromSavedAccount(profiles, savedProfile),
    currentProfiles,
  );
}

function recipeSnapshot(recipe) {
  if (!recipe) return null;
  return {
    id: recipe.id,
    name: recipe.name,
    productType: recipe.productType || "bread",
    version: Number(recipe.currentVersion || 1),
    versionLabel: recipeVersionLabel(recipe),
    ingredients: recipe.ingredients || [],
    yield: recipe.yield,
    unitName: recipe.unitName || "item",
  };
}

function traceFromOrder(order, recipes, inventoryDeduction) {
  const lines = orderProductionLines(order, recipes).filter((line) => line.recipe);
  if (!lines.length) return null;
  const now = new Date();
  const units = lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
  return {
    id: `trace-order-${order.id}-${Date.now()}`,
    batchCode: batchCodeFor(lines[0].recipe?.name || order.product || "Order", now),
    source: "completed-order",
    status: "completed",
    createdAt: now.toISOString(),
    batchDate: now.toISOString().slice(0, 10),
    recipeId: lines[0].recipe?.id || "",
    recipeName: lines.map((line) => line.recipe?.name || line.name).join(", "),
    recipeVersions: lines.map((line) => recipeSnapshot(line.recipe)).filter(Boolean),
    producedUnits: units,
    unitName: lines[0].recipe?.unitName || "item",
    orderIds: [order.id],
    customerNames: [order.customer].filter(Boolean),
    requestCodes: [order.requestCode || order.cloudOrderId].filter(Boolean),
    inventoryDeductions: inventoryDeduction?.deductions || order.inventoryDeductions || [],
    ingredientLots: [],
    qualityNotes: order.notes || "",
    outcomeNotes: "Auto-created when the order was completed.",
  };
}

function traceFromKitchenBake(bake, recipes) {
  const recipe = recipes.find((item) => item.id === bake.recipeId)
    || recipes.find((item) => item.name === bake.recipeName);
  if (!recipe) return null;
  const now = new Date();
  return {
    id: `trace-kitchen-${bake.id}-${Date.now()}`,
    batchCode: batchCodeFor(bake.name || recipe.name, now),
    source: "completed-kitchen-bake",
    status: "completed",
    createdAt: now.toISOString(),
    batchDate: bake.completedAt?.slice(0, 10) || now.toISOString().slice(0, 10),
    recipeId: recipe.id,
    recipeName: recipe.name,
    recipeVersions: [recipeSnapshot(recipe)].filter(Boolean),
    producedUnits: Number(bake.loaves || recipe.yield || 1),
    unitName: recipe.unitName || "item",
    orderIds: bake.sourceOrderIds || [],
    customerNames: [],
    requestCodes: [],
    inventoryDeductions: [],
    ingredientLots: [],
    qualityNotes: "",
    outcomeNotes: `Auto-created from Kitchen bake “${bake.name || bake.recipeName || recipe.name}.”`,
  };
}

export default function App() {
  const [active, setActive] = useState("today");
  const [desktopNavKey, setDesktopNavKey] = useState("today");
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [orders, setOrders] = usePersistentState("loafers-orders-v1", seedOrders);
  const [customerProfiles, setCustomerProfiles] = usePersistentState("loafers-customer-profiles-v1", []);
  const [recipes, setRecipes] = usePersistentState("loafers-recipes-v1", seedRecipes);
  const [inventory, setInventory] = usePersistentState("loafers-inventory-v1", seedInventory);
  const [expenses, setExpenses] = usePersistentState("loafers-expenses-v1", seedExpenses);
  const [bakePlans, setBakePlans] = usePersistentState("loafers-bake-plans-v1", []);
  const [kitchenBakes, setKitchenBakes] = usePersistentState("loafers-kitchen-bakes-v1", []);
  const [batchTraceRecords, setBatchTraceRecords] = usePersistentState("loafers-batch-trace-records-v1", []);
  const [liquidSafetyLogs, setLiquidSafetyLogs] = usePersistentState("loafers-liquid-safety-logs-v1", []);
  const [selectedKitchenBakeId, setSelectedKitchenBakeId] = usePersistentState("loafers-selected-kitchen-bake-v1", "");
  const [storedProductionAutomation, setProductionAutomation] = usePersistentState(
    "loafers-production-automation-v1",
    DEFAULT_PRODUCTION_AUTOMATION,
  );
  const [bakerySettings, setBakerySettings] = usePersistentState(
    "loafers-bakery-settings-v1",
    DEFAULT_BAKERY_SETTINGS,
  );
  const [starters, setStarters] = usePersistentState("loafers-starter-profiles-v1", seedStarters);
  const [starterLogs, setStarterLogs] = usePersistentState("loafers-starter-v1", []);
  const [storageMeta, setStorageMeta] = usePersistentState("loafers-storage-meta-v1", {
    lastBackupAt: null,
    lastCloudBackupAt: null,
  });
  const [recoveryBackup, setRecoveryBackup] = usePersistentState("loafers-recovery-v1", null);
  const [toast, setToast] = useState("");
  const [quickStarter, setQuickStarter] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [storageOpen, setStorageOpen] = useState(false);
  const [menuView, setMenuView] = useState("recipes");
  const [productionView, setProductionView] = useState("operations");
  const [productionArea, setProductionArea] = useState("calendar");
  const [bakeDeskRecipeSignal, setBakeDeskRecipeSignal] = useState(null);
  const [businessFocus, setBusinessFocus] = useState(null);
  const [quickFeed, setQuickFeed] = useState({
    starterId: "mabel",
    ratio: "1:2:2",
    temperature: 76,
    rise: 2,
    note: "",
  });
  const currentPage = canonicalPage(active);
  const Page = pages[currentPage] || TodayPage;
  const cloudAccount = useCloudAccount();
  const openOrderCount = useMemo(() => orders.filter((order) => {
    const status = String(order.status || "").toLowerCase();
    return status !== "completed" && status !== "rejected" && status !== "cancelled";
  }).length, [orders]);
  const productionAutomation = {
    ...DEFAULT_PRODUCTION_AUTOMATION,
    ...(storedProductionAutomation || {}),
  };
  const orderSlug = new URLSearchParams(window.location.search).get("order");

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    const bakeryId = cloudAccount.workspace?.bakeryId;
    if (!bakeryId) return undefined;
    const timeout = window.setTimeout(() => {
      syncBakerCapacityReservations(bakeryId, orders).catch(() => {});
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [cloudAccount.workspace?.bakeryId, orders]);

  useEffect(() => {
    const bakeryId = cloudAccount.workspace?.bakeryId;
    if (!bakeryId) return;
    loadBakerySettings(bakeryId)
      .then((settings) => {
        if (settings) setBakerySettings(settings);
      })
      .catch(() => {});
  }, [cloudAccount.workspace?.bakeryId, setBakerySettings]);

  useEffect(() => {
    const bakeryId = cloudAccount.workspace?.bakeryId;
    if (!bakeryId) return undefined;
    let active = true;
    listBakeryCustomerProfiles(bakeryId)
      .then((profiles) => {
        if (active && profiles.length) {
          setCustomerProfiles((current) => mergeSavedCustomerProfiles(current, profiles));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [cloudAccount.workspace?.bakeryId, setCustomerProfiles]);

  function addOrder(form) {
    const initials = form.customer
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    setOrders((current) => [
      {
        ...form,
        id: Date.now(),
        createdAt: new Date().toISOString(),
        initials,
        accent: "terracotta",
        notes: "",
        isSample: false,
      },
      ...current,
    ]);
    setToast("Order added to the bake queue");
  }

  function importCloudOrder(request) {
    const items = request.customer_order_items || [];
    const quantity = items.reduce((sum, item) => (
      sum + Number(item.capacity_units ?? item.quantity ?? 0)
    ), 0);
    const totalUnits = items.reduce((sum, item) => (
      sum + Number(item.quantity || 0) * Number(item.units_per_pack || 1)
    ), 0);
    const product = items.map((item) => (
      `${item.product_name}${item.sale_option_label ? ` · ${item.sale_option_label}` : ""}${item.quantity > 1 ? ` × ${item.quantity}` : ""}`
    )).join(", ");
    const pickup = request.pickup_at ? new Date(request.pickup_at) : null;
    const due = pickup && !Number.isNaN(pickup.getTime())
      ? pickup.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
      : "Arrange pickup";
    const contact = [request.customer_email, request.customer_phone].filter(Boolean).join(" · ");
    const notes = [
      request.customer_notes,
      contact ? `Customer contact: ${contact}` : "",
      request.payment_method ? `Payment: ${request.payment_method}` : "",
      request.pickup_location ? `Pickup: ${request.pickup_location}` : "",
      request.allergies ? `ALLERGIES: ${request.allergies}` : "",
      request.baker_notes ? `Baker comment: ${request.baker_notes}` : "",
      `Online request: ${request.request_code}`,
    ].filter(Boolean).join("\n\n");
    const initials = request.customer_name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    const nextOrder = {
      id: `${Date.now()}-${request.id.slice(0, 6)}`,
      cloudOrderId: request.id,
      customerId: request.customer_id,
      customerUserId: request.customer_user_id,
      createdAt: request.created_at,
      customer: request.customer_name,
      customerEmail: request.customer_email,
      customerPhone: request.customer_phone,
      notifyEmail: Boolean(request.notify_email),
      notifySms: Boolean(request.notify_sms),
      requestCode: request.request_code,
      orderSlug: cloudAccount.workspace?.bakery?.slug || "loafers",
      initials,
      product: product || "Online bread request",
      quantity,
      totalUnits,
      itemSummary: items.map((item) => `${item.quantity} × ${item.sale_option_label || item.product_name}`).join(" · "),
      total: Number(request.subtotal_cents || 0) / 100,
      status: "Accepted",
      due,
      pickupAt: request.pickup_at,
      paymentMethod: request.payment_method,
      paymentStatus: request.payment_status || "unpaid",
      paymentAmount: 0,
      paymentNotes: "",
      items: items.map((item) => ({
        product_name: item.product_name,
        quantity: Number(item.quantity || 1),
        sale_option_id: item.sale_option_id,
        sale_option_label: item.sale_option_label,
        units_per_pack: Number(item.units_per_pack || 1),
        capacity_units: Number(item.capacity_units ?? item.quantity ?? 1),
      })),
      pickupLocation: request.pickup_location,
      allergies: request.allergies,
      bakeProgress: normalizedBakeProgress(request.bake_progress),
      accent: "sage",
      notes,
      isSample: false,
    };
    setOrders((current) => [nextOrder, ...current]);
    setCustomerProfiles((current) => upsertCustomerProfileFromCloudOrder(current, request, nextOrder));
    setToast("Customer request accepted into Orders");
  }

  function updateOrder(id, changes) {
    setOrders((current) => current.map((order) => (
      order.id === id ? { ...order, ...changes } : order
    )));
    setToast("Order details saved");
  }

  async function completeOrder(id, changes = {}) {
    const order = orders.find((item) => item.id === id);
    if (!order) return;
    const completedProgress = Object.fromEntries(BAKE_PHASES.map((phase) => [phase.id, true]));
    let emailResult = null;
    if (order.cloudOrderId) {
      const bakeryId = cloudAccount.workspace?.bakeryId || "";
      await updateCustomerOrderBakeProgress(
        order.cloudOrderId,
        completedProgress,
        bakeryId,
        { notify: false },
      );
      emailResult = await completeCustomerOrder(order.cloudOrderId, bakeryId);
    }
    let inventoryDeduction = null;
    if (
      productionAutomation.enabled
      && productionAutomation.autoDeductInventory
      && !order.inventoryDeductedAt
      && order.status !== "Completed"
    ) {
      inventoryDeduction = deductInventoryForOrder(
        order,
        recipes,
        inventory,
        productionAutomation,
      );
      if (inventoryDeduction.deductions.length) setInventory(inventoryDeduction.inventory);
    }
    const batchTrace = traceFromOrder(order, recipes, inventoryDeduction);
    if (batchTrace && !order.batchTraceId) {
      setBatchTraceRecords((current) => [batchTrace, ...current]);
    }
    setOrders((current) => current.map((item) => (
      item.id === id
        ? {
          ...item,
          ...changes,
          status: "Completed",
          bakeProgress: completedProgress,
          completedAt: new Date().toISOString(),
          ...(batchTrace ? { batchTraceId: batchTrace.id } : {}),
          ...(inventoryDeduction?.deductions.length ? {
            inventoryDeductedAt: new Date().toISOString(),
            inventoryDeductions: inventoryDeduction.deductions,
          } : {}),
        }
        : item
    )));
    setSelectedOrderId(null);
    const emailSuffix = emailResult?.sent
      ? " · customer emailed"
      : emailResult?.error
        ? " · email failed"
        : "";
    setToast(inventoryDeduction?.deductions.length
      ? `Bake completed · ${inventoryDeduction.deductions.length} stock item${inventoryDeduction.deductions.length === 1 ? "" : "s"} deducted${inventoryDeduction.shortages.length ? " · shortage flagged" : ""}${emailSuffix}`
      : `Bake completed and moved to Completed${emailSuffix}`);
  }

  async function updateOrderProgress(id, bakeProgress) {
    const order = orders.find((item) => item.id === id);
    if (!order) return;
    const emailResult = order.cloudOrderId
      ? await updateCustomerOrderBakeProgress(
        order.cloudOrderId,
        bakeProgress,
        cloudAccount.workspace?.bakeryId || "",
      )
      : null;
    setOrders((current) => current.map((item) => (
      item.id === id ? { ...item, bakeProgress } : item
    )));
    setToast(emailResult?.sent
      ? "Customer bake progress updated · email sent"
      : emailResult?.error
        ? "Bake progress saved · email failed"
        : "Customer bake progress updated");
  }

  async function deleteOrder(id) {
    const order = orders.find((item) => item.id === id);
    const nextOrders = orders.filter((item) => item.id !== id);
    const bakeryId = cloudAccount.workspace?.bakeryId || "";
    setOrders(nextOrders);
    setSelectedOrderId(null);
    setToast("Order deleted");
    if (!bakeryId) return;
    try {
      if (order?.cloudOrderId) {
        await cancelCustomerOrderCapacity(
          order.cloudOrderId,
          bakeryId,
          "Order removed by the baker.",
        );
      }
      await syncBakerCapacityReservations(bakeryId, nextOrders);
      setToast(order?.cloudOrderId
        ? "Order deleted and customer calendar slot released"
        : "Order deleted and customer calendar refreshed");
    } catch {
      setToast("Order deleted locally; cloud calendar refresh failed");
    }
  }

  function clearSampleOrders() {
    const sampleCustomers = new Set([
      "Emily Morgan",
      "James Walker",
      "Sophie Lee",
      "Maya Patel",
      "Avery Brooks",
    ]);
    setOrders((current) => current.filter((order) => (
      order.isSample !== true
      && !(Number(order.id) >= 1 && Number(order.id) <= 5 && sampleCustomers.has(order.customer))
    )));
    setSelectedOrderId(null);
    setToast("Sample orders erased");
  }

  function openQuickStarter() {
    setQuickFeed((current) => ({ ...current, starterId: starters[0]?.id || "" }));
    setQuickStarter(true);
  }

  function navigate(page, options = {}) {
    const nextPage = canonicalPage(page);
    if (nextPage !== "orders") setSelectedOrderId(null);
    if (nextPage === "menu" && options.menuView) setMenuView(options.menuView);
    if (nextPage === "production" && options.productionView) setProductionView(options.productionView);
    if (nextPage === "production" && options.productionArea) setProductionArea(options.productionArea);
    if (nextPage === "business") {
      setBusinessFocus(options.businessFocus
        ? { area: options.businessFocus, nonce: Date.now() }
        : { area: "management", nonce: Date.now() });
    }
    setDesktopNavKey(options.navKey || (nextPage === "business" ? "management" : nextPage));
    setActive(nextPage);
  }

  function openOrder(id) {
    setSelectedOrderId(id);
    setDesktopNavKey("orders");
    setActive("orders");
  }

  function logStarter(entry) {
    const starter = starters.find((item) => item.id === entry.starterId) || starters[0];
    setStarterLogs((current) => [{
      ...entry,
      id: Date.now(),
      starterId: entry.starterId || starter?.id,
      starterName: starter?.name || "Starter",
      flourBlend: entry.flourBlend || starter?.flourBlend || [],
      dateTime: entry.dateTime || new Date().toISOString(),
    }, ...current]);
    setToast("Starter feed logged");
  }

  function saveStarter(starter) {
    const { isNew, ...savedStarter } = starter;
    setStarters((current) => {
      const exists = current.some((item) => item.id === savedStarter.id);
      return exists
        ? current.map((item) => item.id === savedStarter.id ? savedStarter : item)
        : [...current, savedStarter];
    });
    setToast(isNew ? "Starter added" : "Starter profile saved");
  }

  function deleteStarter(id) {
    setStarters((current) => current.filter((starter) => starter.id !== id));
    setToast("Starter deleted");
  }

  function saveRecipe(recipe) {
    const { isNew, ...savedRecipe } = recipe;
    setRecipes((current) => {
      const previous = current.find((item) => item.id === savedRecipe.id);
      const versionedRecipe = withRecipeVersion(previous, savedRecipe);
      return previous
        ? current.map((item) => item.id === savedRecipe.id ? versionedRecipe : item)
        : [versionedRecipe, ...current];
    });
    setToast(isNew ? "Recipe added" : "Recipe updated");
  }

  function deleteRecipe(id) {
    setRecipes((current) => current.filter((recipe) => recipe.id !== id));
    setToast("Recipe deleted");
  }

  function saveInventoryItem(item) {
    const { isNew, ...savedItem } = item;
    setInventory((current) => {
      const exists = current.some((entry) => entry.id === savedItem.id);
      return exists
        ? current.map((entry) => entry.id === savedItem.id ? savedItem : entry)
        : [savedItem, ...current];
    });
    setToast(isNew ? "Inventory item added" : "Inventory item updated");
  }

  function deleteInventoryItem(id) {
    setInventory((current) => current.filter((item) => item.id !== id));
    setToast("Inventory item removed");
  }

  function logExpense(expense) {
    const savedExpense = {
      ...expense,
      id: expense.id || `expense-${Date.now()}`,
      date: expense.date || new Date().toISOString().slice(0, 10),
    };
    setExpenses((current) => [savedExpense, ...current]);
    if (expense.inventoryId && Number(expense.quantity) > 0) {
      setInventory((current) => current.map((item) => (
        item.id === expense.inventoryId
          ? {
            ...item,
            amount: Number(item.amount || 0) + Number(expense.quantity),
            unitCost: Number(expense.totalCost || 0) / Number(expense.quantity),
          }
          : item
      )));
    }
    setToast("Purchase logged and inventory updated");
  }

  function deleteExpense(id) {
    setExpenses((current) => current.filter((expense) => expense.id !== id));
    setToast("Expense removed");
  }

  function saveCustomerProfile(profile) {
    const savedProfile = {
      ...profile,
      id: profile.id || `customer-${Date.now()}`,
      name: profile.name?.trim() || "Customer",
      updatedAt: new Date().toISOString(),
    };
    setCustomerProfiles((current) => {
      const exists = current.some((entry) => entry.id === savedProfile.id);
      return exists
        ? current.map((entry) => entry.id === savedProfile.id ? savedProfile : entry)
        : [savedProfile, ...current];
    });
    setToast("Customer profile saved");
  }

  function saveLiquidSafetyLog(log) {
    const savedLog = {
      ...log,
      id: log.id || `liquid-batch-${Date.now()}`,
      batchName: log.batchName?.trim() || "Liquid batch",
      batchDate: log.batchDate || new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString(),
    };
    setLiquidSafetyLogs((current) => {
      const exists = current.some((entry) => entry.id === savedLog.id);
      return exists
        ? current.map((entry) => entry.id === savedLog.id ? savedLog : entry)
        : [savedLog, ...current];
    });
    setToast("Safety batch log saved");
  }

  function deleteLiquidSafetyLog(id) {
    setLiquidSafetyLogs((current) => current.filter((entry) => entry.id !== id));
    setToast("Safety batch log removed");
  }

  function saveBakePlan(plan) {
    const { isNew, ...savedPlan } = plan;
    setBakePlans((current) => {
      const exists = current.some((item) => item.id === savedPlan.id);
      return exists
        ? current.map((item) => item.id === savedPlan.id ? savedPlan : item)
        : [...current, savedPlan];
    });
    setToast(isNew ? "Bake added to calendar" : "Bake plan updated");
  }

  function deleteBakePlan(id) {
    setBakePlans((current) => current.filter((plan) => plan.id !== id));
    setToast("Planned bake deleted");
  }

  function saveKitchenBake(bake, options = {}) {
    const previousBake = kitchenBakes.find((item) => item.id === bake.id);
    const shouldCreateTrace = bake.status === "completed" && previousBake?.status !== "completed" && !bake.batchTraceId;
    const batchTrace = shouldCreateTrace ? traceFromKitchenBake(bake, recipes) : null;
    const savedBake = batchTrace ? { ...bake, batchTraceId: batchTrace.id } : bake;
    setKitchenBakes((current) => {
      const exists = current.some((item) => item.id === savedBake.id);
      return exists
        ? current.map((item) => item.id === savedBake.id ? savedBake : item)
        : [savedBake, ...current];
    });
    if (batchTrace) setBatchTraceRecords((current) => [batchTrace, ...current]);
    if (!options.silent) setToast(options.message || "Kitchen bake saved");
  }

  function openRecipeInBakeDesk(recipe) {
    if (!recipe?.id) return;
    setBakeDeskRecipeSignal({ recipeId: recipe.id, view: "plan", nonce: Date.now() });
    navigate("production", { productionView: "bake", navKey: "bake" });
    setToast(`${recipe.name} loaded in Bake desk`);
  }

  function addRecipeToKitchen(recipe) {
    if (!recipe?.id) return;
    const timeline = normalizeTimelineSettings(recipe);
    const usesStarter = recipeUsesStarter(recipe);
    const starter = usesStarter ? starters[0] : null;
    if (usesStarter && !starter) {
      setToast("Add a starter before starting this bake in Kitchen");
      navigate("production", { productionView: "operations", productionArea: "starters", navKey: "production" });
      return;
    }
    const id = `kitchen-menu-${Date.now()}`;
    const anchorDateTime = localDateTimeValue(new Date());
    saveKitchenBake({
      id,
      name: `${recipe.name} · ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`,
      recipeId: recipe.id,
      recipeName: recipe.name,
      loaves: Number(recipe.yield || 1),
      starterId: usesStarter ? starter?.id : "",
      starterName: usesStarter ? starter?.name : "",
      ratio: usesStarter ? "1:2:2" : "",
      doughTemperature: 76,
      coldProofHours: timeline.includeColdProof ? Number(timeline.defaultColdProofHours || 0) : 0,
      anchorMode: "start",
      anchorDateTime,
      checks: {},
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: "menu-product-card",
    }, { message: `${recipe.name} added to Kitchen` });
    setSelectedKitchenBakeId(id);
    setBakeDeskRecipeSignal({ recipeId: recipe.id, view: "kitchen", nonce: Date.now() });
    navigate("production", { productionView: "bake", navKey: "bake" });
  }

  function addRecipeToCalendar(recipe) {
    if (!recipe?.id) return;
    const timeline = normalizeTimelineSettings(recipe);
    const usesStarter = recipeUsesStarter(recipe);
    const starter = usesStarter ? starters[0] : null;
    if (usesStarter && !starter) {
      setToast("Add a starter before scheduling this bake");
      navigate("production", { productionView: "operations", productionArea: "starters", navKey: "production" });
      return;
    }
    const start = defaultMenuBakeStart();
    const anchorDateTime = localDateTimeValue(start);
    let model = null;
    try {
      model = buildBakeSchedule({
        recipe,
        loaves: Number(recipe.yield || 1),
        doughTemperature: 76,
        coldProofHours: timeline.includeColdProof ? Number(timeline.defaultColdProofHours || 0) : 0,
        anchorMode: "start",
        anchorDateTime,
        starter,
        ratio: usesStarter ? "1:2:2" : "",
        starterLogs,
      });
    } catch {
      model = null;
    }
    const bakeEnd = model?.bakeEnd || new Date(start.getTime() + Math.max(1, Number(timeline.primaryRiseHours || 1)) * 60 * 60 * 1000);
    saveBakePlan({
      id: `menu-plan-${Date.now()}`,
      date: localDateKey(bakeEnd),
      recipeId: recipe.id,
      recipeName: recipe.name,
      loaves: Number(recipe.yield || 1),
      starterId: usesStarter ? starter?.id : "",
      starterName: usesStarter ? starter?.name : "",
      ratio: usesStarter ? "1:2:2" : "",
      doughTemperature: 76,
      coldProofHours: timeline.includeColdProof ? Number(timeline.defaultColdProofHours || 0) : 0,
      anchorMode: "start",
      anchorDateTime,
      bulkHours: Number((model?.dough?.bulkHours || timeline.primaryRiseHours || 1).toFixed(2)),
      bakeEnd: bakeEnd.toISOString(),
      source: "menu-product-card",
      isNew: true,
    });
    navigate("production", { productionView: "operations", productionArea: "calendar", navKey: "production" });
  }

  function deleteKitchenBake(id) {
    setKitchenBakes((current) => current.filter((bake) => bake.id !== id));
    if (selectedKitchenBakeId === id) setSelectedKitchenBakeId("");
    setToast("Kitchen bake removed");
  }

  function selectKitchenBake(id) {
    setSelectedKitchenBakeId(id || "planned");
    setToast(id && id !== "planned" ? "Today visual set to this bake" : "Today visual set to next planned bake");
  }

  function syncProductionPlans(generatedPlans) {
    setBakePlans((current) => {
      const manualPlans = current.filter((plan) => !plan.generatedByProduction);
      return [...manualPlans, ...generatedPlans];
    });
  }

  function saveBatchTraceRecord(record) {
    const savedRecord = {
      ...record,
      id: record.id || `trace-manual-${Date.now()}`,
      batchCode: record.batchCode?.trim() || batchCodeFor(record.recipeName || "Batch"),
      createdAt: record.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setBatchTraceRecords((current) => {
      const exists = current.some((item) => item.id === savedRecord.id);
      return exists
        ? current.map((item) => item.id === savedRecord.id ? savedRecord : item)
        : [savedRecord, ...current];
    });
    setToast("Batch trace saved");
  }

  function deleteBatchTraceRecord(id) {
    setBatchTraceRecords((current) => current.filter((record) => record.id !== id));
    setToast("Batch trace removed");
  }

  async function updateBakerySettings(settings) {
    const normalized = normalizedBakerySettings(settings);
    setBakerySettings(normalized);
    if (cloudAccount.workspace?.bakeryId) {
      await saveBakerySettings(cloudAccount.workspace.bakeryId, normalized);
      await cloudAccount.refreshWorkspace();
    }
    setToast("Bakery settings saved");
    return normalized;
  }

  function applyStorageData(data) {
    setOrders(data.orders);
    setCustomerProfiles(data.customerProfiles || []);
    setRecipes(data.recipes);
    setInventory(data.inventory);
    setExpenses(data.expenses);
    setBakePlans(data.bakePlans);
    setKitchenBakes(data.kitchenBakes || []);
    setBatchTraceRecords(data.batchTraceRecords || []);
    setLiquidSafetyLogs(data.liquidSafetyLogs || []);
    setStarters(data.starters);
    setStarterLogs(data.starterLogs);
    setSelectedOrderId(null);
  }

  function restoreStorage(data, previousBackup) {
    setRecoveryBackup(previousBackup);
    applyStorageData(data);
    setToast("Backup restored");
  }

  function undoStorageRestore() {
    if (!recoveryBackup) return;
    applyStorageData(recoveryBackup.data);
    setRecoveryBackup(null);
    setToast("Previous records recovered");
  }

  const sharedProps = {
    cloudAccount,
    bakerySettings: normalizedBakerySettings(bakerySettings),
    productionAutomation,
    orders,
    recipes,
    bakePlans,
    kitchenBakes,
    batchTraceRecords,
    liquidSafetyLogs,
    selectedKitchenBakeId,
    bakeDeskRecipeSignal,
    starters,
    customerProfiles,
    expenses,
    inventory,
    setActive: navigate,
    onAddOrder: addOrder,
    onClearSampleOrders: clearSampleOrders,
    onCompleteOrder: completeOrder,
    onDeleteOrder: deleteOrder,
    onDeleteBakePlan: deleteBakePlan,
    onDeleteExpense: deleteExpense,
    onDeleteInventoryItem: deleteInventoryItem,
    onDeleteKitchenBake: deleteKitchenBake,
    onDeleteBatchTraceRecord: deleteBatchTraceRecord,
    onDeleteLiquidSafetyLog: deleteLiquidSafetyLog,
    onDeleteRecipe: deleteRecipe,
    onDeleteStarter: deleteStarter,
    onChangeProductionAutomation: setProductionAutomation,
    onSaveBakerySettings: updateBakerySettings,
    onSaveCustomerProfile: saveCustomerProfile,
    onOpenOrder: openOrder,
    onImportCloudOrder: importCloudOrder,
    onLogExpense: logExpense,
    onPlanCreated: setToast,
    onStarterLogged: logStarter,
    onLogStarter: openQuickStarter,
    onOpenSettings: () => navigate("settings"),
    onOpenStorage: () => setStorageOpen(true),
    onUpdateOrder: updateOrder,
    onUpdateOrderProgress: updateOrderProgress,
    onSaveBakePlan: saveBakePlan,
    onSaveInventoryItem: saveInventoryItem,
    onSaveKitchenBake: saveKitchenBake,
    onSaveBatchTraceRecord: saveBatchTraceRecord,
    onSaveLiquidSafetyLog: saveLiquidSafetyLog,
    onSaveRecipe: saveRecipe,
    onSaveStarter: saveStarter,
    onSelectKitchenBake: selectKitchenBake,
    onSyncProductionPlans: syncProductionPlans,
    onAddRecipeToCalendar: addRecipeToCalendar,
    onAddRecipeToKitchen: addRecipeToKitchen,
    onOpenRecipeInBakeDesk: openRecipeInBakeDesk,
    businessFocus,
    selectedOrderId,
    productionView,
    productionArea,
    starterLogs,
    menuView,
    onChangeMenuView: setMenuView,
  };

  const quickActions = useMemo(() => [
    {
      label: "Review orders",
      note: "Pending, accepted, customer records",
      icon: ClipboardList,
      onClick: () => navigate("orders"),
    },
    {
      label: "Open Kitchen board",
      note: "Track active bakes and step checklists",
      icon: ChefHat,
      onClick: () => navigate("production"),
    },
    {
      label: "Ready shelf item",
      note: "Jump to Menu for public shelf stock",
      icon: PackageCheck,
      onClick: () => navigate("menu", { menuView: "shelf" }),
    },
    {
      label: "Log starter feed",
      note: "Quick culture check without hunting",
      icon: Wheat,
      onClick: openQuickStarter,
    },
    {
      label: "Log purchase",
      note: "Open Business inventory and spending",
      icon: Receipt,
      onClick: () => navigate("business"),
    },
    {
      label: "Bakery settings",
      note: "Capacity, pickup, messages, storefront",
      icon: Settings2,
      onClick: () => navigate("settings"),
    },
  ], [starters]);

  if (orderSlug) {
    return (
      <CustomerOrderPortal
        bakerySettings={normalizedBakerySettings(bakerySettings)}
        cloudAccount={cloudAccount}
        fallbackRecipes={recipes}
        slug={orderSlug}
      />
    );
  }

  return (
    <div className="app-stage">
      <div className={`app-shell owner-page-${currentPage}`} data-page={currentPage}>
        <div className="scroll-view">
          <Page {...sharedProps} />
          <InstallAppPrompt context="owner" />
        </div>
        <BottomNav
          active={currentPage}
          activeNavKey={desktopNavKey}
          onChange={navigate}
          orderBadgeCount={openOrderCount}
        />
        <GlobalQuickAction
          actions={quickActions}
          isOpen={quickActionsOpen}
          onClose={() => setQuickActionsOpen(false)}
          onOpen={() => setQuickActionsOpen(true)}
        />
        <Toast message={toast} />
      </div>

      {quickStarter ? (
        <Modal title="Quick starter check" onClose={() => setQuickStarter(false)}>
          <form className="form-stack" onSubmit={(event) => {
            event.preventDefault();
            logStarter(quickFeed);
            setQuickFeed((current) => ({ ...current, note: "" }));
            setQuickStarter(false);
          }}>
            <label>
              Starter
              <select value={quickFeed.starterId} onChange={(event) => setQuickFeed({ ...quickFeed, starterId: event.target.value })}>
                {starters.map((starter) => <option key={starter.id} value={starter.id}>{starter.name}</option>)}
              </select>
            </label>
            <div className="form-grid">
              <label>Feed ratio<input value={quickFeed.ratio} onChange={(event) => setQuickFeed({ ...quickFeed, ratio: event.target.value })} /></label>
              <label>Jar temp °F<input type="number" value={quickFeed.temperature} onChange={(event) => setQuickFeed({ ...quickFeed, temperature: Number(event.target.value) })} /></label>
            </div>
            <label>Rise multiple<input type="number" step="0.1" min="0" value={quickFeed.rise} onChange={(event) => setQuickFeed({ ...quickFeed, rise: Number(event.target.value) })} /></label>
            <label>Quick note<textarea value={quickFeed.note} onChange={(event) => setQuickFeed({ ...quickFeed, note: event.target.value })} placeholder="Bubbles, aroma, texture…" /></label>
            <button className="primary-button" type="submit">Log starter check</button>
          </form>
        </Modal>
      ) : null}

      {storageOpen ? (
        <StorageCenter
          data={{
            orders,
            customerProfiles,
            recipes,
            inventory,
            expenses,
            bakePlans,
            kitchenBakes,
            batchTraceRecords,
            liquidSafetyLogs,
            starters,
            starterLogs,
          }}
          cloudAccount={cloudAccount}
          lastBackupAt={storageMeta.lastBackupAt}
          lastCloudBackupAt={storageMeta.lastCloudBackupAt}
          recoveryBackup={recoveryBackup}
          onClose={() => setStorageOpen(false)}
          onRestore={restoreStorage}
          onSetLastBackupAt={(lastBackupAt) => setStorageMeta((current) => ({ ...current, lastBackupAt }))}
          onSetLastCloudBackupAt={(lastCloudBackupAt) => setStorageMeta((current) => ({ ...current, lastCloudBackupAt }))}
          onUndoRestore={undoStorageRestore}
        />
      ) : null}
    </div>
  );
}
