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
import BakePage from "./pages/BakePage";
import CustomerOrderPortal from "./pages/CustomerOrderPortal";
import MorePage from "./pages/MorePage";
import OrdersPage from "./pages/OrdersPage";
import RecipesPage from "./pages/RecipesPage";
import TodayPage from "./pages/TodayPage";

const pages = {
  today: TodayPage,
  orders: OrdersPage,
  bake: BakePage,
  recipes: RecipesPage,
  more: MorePage,
};

export default function App() {
  const [active, setActive] = useState("today");
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [orders, setOrders] = usePersistentState("loafers-orders-v1", seedOrders);
  const [recipes, setRecipes] = usePersistentState("loafers-recipes-v1", seedRecipes);
  const [inventory, setInventory] = usePersistentState("loafers-inventory-v1", seedInventory);
  const [expenses, setExpenses] = usePersistentState("loafers-expenses-v1", seedExpenses);
  const [bakePlans, setBakePlans] = usePersistentState("loafers-bake-plans-v1", []);
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
  const orderSlug = new URLSearchParams(window.location.search).get("order");

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

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
    const quantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const product = items.map((item) => (
      item.quantity > 1 ? `${item.product_name} × ${item.quantity}` : item.product_name
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
      initials,
      product: product || "Online bread request",
      quantity,
      total: Number(request.subtotal_cents || 0) / 100,
      status: "New",
      due,
      pickupAt: request.pickup_at,
      paymentMethod: request.payment_method,
      pickupLocation: request.pickup_location,
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

  function applyStorageData(data) {
    setOrders(data.orders);
    setRecipes(data.recipes);
    setInventory(data.inventory);
    setExpenses(data.expenses);
    setBakePlans(data.bakePlans);
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
    orders,
    recipes,
    bakePlans,
    starters,
    expenses,
    inventory,
    setActive: navigate,
    onAddOrder: addOrder,
    onClearSampleOrders: clearSampleOrders,
    onDeleteOrder: deleteOrder,
    onDeleteBakePlan: deleteBakePlan,
    onDeleteExpense: deleteExpense,
    onDeleteInventoryItem: deleteInventoryItem,
    onDeleteRecipe: deleteRecipe,
    onDeleteStarter: deleteStarter,
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
    onSaveBakePlan: saveBakePlan,
    onSaveInventoryItem: saveInventoryItem,
    onSaveRecipe: saveRecipe,
    onSaveStarter: saveStarter,
    selectedOrderId,
    starterLogs,
  };

  if (orderSlug) {
    return (
      <CustomerOrderPortal
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
        <BottomNav active={active} onChange={navigate} />
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
            recipes,
            inventory,
            expenses,
            bakePlans,
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
