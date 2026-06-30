import { useEffect, useState } from "react";
import { BottomNav } from "./components/AppChrome";
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
  completeCustomerOrder,
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
} from "./lib/productionPlanner";
import BakePage from "./pages/BakePage";
import CustomerOrderPortal from "./pages/CustomerOrderPortal";
import LiquidPage from "./pages/LiquidPage";
import MorePage from "./pages/MorePage";
import OrdersPage from "./pages/OrdersPage";
import RecipesPage from "./pages/RecipesPage";
import SettingsPage from "./pages/SettingsPage";
import TodayPage from "./pages/TodayPage";

// customer-options-v1
// checkout-flow-v1

const pages = {
  today: TodayPage,
  orders: OrdersPage,
  bake: BakePage,
  liquid: LiquidPage,
  recipes: RecipesPage,
  more: MorePage,
  settings: SettingsPage,
};

export default function App() {
  const [active, setActive] = useState("today");
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [orders, setOrders] = usePersistentState("loafers-orders-v1", seedOrders);
  const [customerProfiles, setCustomerProfiles] = usePersistentState("loafers-customer-profiles-v1", []);
  const [recipes, setRecipes] = usePersistentState("loafers-recipes-v1", seedRecipes);
  const [inventory, setInventory] = usePersistentState("loafers-inventory-v1", seedInventory);
  const [expenses, setExpenses] = usePersistentState("loafers-expenses-v1", seedExpenses);
  const [bakePlans, setBakePlans] = usePersistentState("loafers-bake-plans-v1", []);
  const [kitchenBakes, setKitchenBakes] = usePersistentState("loafers-kitchen-bakes-v1", []);
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
  const [storageOpen, setStorageOpen] = useState(false);
  const [quickFeed, setQuickFeed] = useState({
    starterId: "mabel",
    ratio: "1:2:2",
    temperature: 76,
    rise: 2,
    note: "",
  });
  const Page = pages[active];
  const cloudAccount = useCloudAccount();
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

    setOrders((current) => [{
      id: `${Date.now()}-${request.id.slice(0, 6)}`,
      cloudOrderId: request.id,
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
      status: "New",
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
    }, ...current]);
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
    setOrders((current) => current.map((item) => (
      item.id === id
        ? {
          ...item,
          ...changes,
          status: "Completed",
          bakeProgress: completedProgress,
          completedAt: new Date().toISOString(),
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

  function deleteOrder(id) {
    setOrders((current) => current.filter((order) => order.id !== id));
    setSelectedOrderId(null);
    setToast("Order deleted");
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

  function navigate(page) {
    if (page !== "orders") setSelectedOrderId(null);
    setActive(page);
  }

  function openOrder(id) {
    setSelectedOrderId(id);
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
      const exists = current.some((item) => item.id === savedRecipe.id);
      return exists
        ? current.map((item) => item.id === savedRecipe.id ? savedRecipe : item)
        : [savedRecipe, ...current];
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
    setKitchenBakes((current) => {
      const exists = current.some((item) => item.id === bake.id);
      return exists
        ? current.map((item) => item.id === bake.id ? bake : item)
        : [bake, ...current];
    });
    if (!options.silent) setToast(options.message || "Kitchen bake saved");
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
    selectedKitchenBakeId,
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
    onLogStarter: () => {
      setQuickFeed((current) => ({ ...current, starterId: starters[0]?.id || "" }));
      setQuickStarter(true);
    },
    onOpenStorage: () => setStorageOpen(true),
    onUpdateOrder: updateOrder,
    onUpdateOrderProgress: updateOrderProgress,
    onSaveBakePlan: saveBakePlan,
    onSaveInventoryItem: saveInventoryItem,
    onSaveKitchenBake: saveKitchenBake,
    onSaveRecipe: saveRecipe,
    onSaveStarter: saveStarter,
    onSelectKitchenBake: selectKitchenBake,
    onSyncProductionPlans: syncProductionPlans,
    selectedOrderId,
    starterLogs,
  };

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
      <div className="app-shell">
        <div className="scroll-view">
          <Page {...sharedProps} />
        </div>
        <BottomNav active={active === "settings" ? "more" : active} onChange={navigate} />
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
