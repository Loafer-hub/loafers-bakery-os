import { useEffect, useState } from "react";
import { BottomNav } from "./components/AppChrome";
import { Modal, Toast } from "./components/Primitives";
import { recipes, scheduleSeed, seedInventory, seedOrders } from "./data/seed";
import { usePersistentState } from "./hooks/usePersistentState";
import BakePage from "./pages/BakePage";
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
  const [schedule, setSchedule] = usePersistentState("loafers-schedule-v1", scheduleSeed);
  const [starterLogs, setStarterLogs] = usePersistentState("loafers-starter-v1", []);
  const [toast, setToast] = useState("");
  const [quickStarter, setQuickStarter] = useState(false);
  const [starterNote, setStarterNote] = useState("");
  const Page = pages[active];

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
        initials,
        accent: "terracotta",
        notes: "",
        isSample: false,
      },
      ...current,
    ]);
    setToast("Order added to the bake queue");
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
    setStarterLogs((current) => [{ ...entry, id: Date.now() }, ...current]);
    setToast("Starter feed logged");
  }

  const sharedProps = {
    orders,
    recipes,
    inventory: seedInventory,
    setActive: navigate,
    schedule,
    setSchedule,
    onAddOrder: addOrder,
    onClearSampleOrders: clearSampleOrders,
    onDeleteOrder: deleteOrder,
    onOpenOrder: openOrder,
    onPlanCreated: setToast,
    onStarterLogged: logStarter,
    onLogStarter: () => setQuickStarter(true),
    onUpdateOrder: updateOrder,
    selectedOrderId,
    starterLogs,
  };

  return (
    <div className="app-stage">
      <div className="app-shell">
        <div className="ios-status" aria-hidden="true"><b>9:41</b><span>● ●● ▰</span></div>
        <div className="scroll-view">
          <Page {...sharedProps} />
        </div>
        <BottomNav active={active} onChange={navigate} />
        <Toast message={toast} />
      </div>

      {quickStarter ? (
        <Modal title="How is Mabel looking?" onClose={() => setQuickStarter(false)}>
          <form className="form-stack" onSubmit={(event) => {
            event.preventDefault();
            logStarter({ ratio: "1:2:2", temperature: 76, rise: 2.1, note: starterNote });
            setStarterNote("");
            setQuickStarter(false);
          }}>
            <div className="starter-check-grid">
              <button type="button">Doubled</button>
              <button type="button">Domed top</button>
              <button type="button">Sweet aroma</button>
            </div>
            <label>Quick note<textarea value={starterNote} onChange={(event) => setStarterNote(event.target.value)} placeholder="Bubbles, aroma, texture…" /></label>
            <button className="primary-button" type="submit">Log starter check</button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
