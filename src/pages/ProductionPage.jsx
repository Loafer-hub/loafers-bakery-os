import {
  AlertTriangle,
  Boxes,
  CalendarDays,
  ClipboardList,
  Package,
  Sprout,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BakeCalendar } from "../components/BakeCalendar";
import { StarterLab } from "../components/StarterLab";
import { pickupDateKey } from "../lib/orderCapacity";
import {
  blockBakeryDay,
  listBakeryUnavailableDays,
  unblockBakeryDay,
} from "../lib/cloud";
import BakePage from "./BakePage";
import LiquidPage from "./LiquidPage";

const operationAreas = [
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "starters", label: "Starters", icon: Sprout },
  { id: "inventory", label: "Inventory on hand", icon: Boxes },
];

function formatCurrency(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function itemStockTone(item) {
  const amount = Number(item.amount || 0);
  const target = Number(item.target || 0);
  if (target > 0 && amount <= target * 0.25) return "critical";
  if (target > 0 && amount < target) return "low";
  return "ok";
}

function InventoryOnHand({ inventory = [] }) {
  const inventoryValue = inventory.reduce((sum, item) => (
    sum + Number(item.amount || 0) * Number(item.unitCost || 0)
  ), 0);
  const lowStockItems = inventory.filter((item) => itemStockTone(item) !== "ok");
  const sortedItems = [...inventory].sort((a, b) => {
    const toneRank = { critical: 0, low: 1, ok: 2 };
    return toneRank[itemStockTone(a)] - toneRank[itemStockTone(b)]
      || String(a.name || "").localeCompare(String(b.name || ""));
  });

  return (
    <section className="production-inventory-panel">
      <div className="production-inventory-summary">
        <article>
          <Package size={19} />
          <span><small>Total on hand</small><strong>{inventory.length}</strong><em>tracked items</em></span>
        </article>
        <article className={lowStockItems.length ? "warning" : ""}>
          <AlertTriangle size={19} />
          <span><small>Low stock</small><strong>{lowStockItems.length}</strong><em>below target</em></span>
        </article>
        <article>
          <Boxes size={19} />
          <span><small>Stock value</small><strong>{formatCurrency(inventoryValue)}</strong><em>estimated</em></span>
        </article>
      </div>

      <div className="production-inventory-list">
        {sortedItems.length ? sortedItems.map((item) => {
          const tone = itemStockTone(item);
          const itemValue = Number(item.amount || 0) * Number(item.unitCost || 0);
          return (
            <article className={`production-inventory-row ${tone}`} key={item.id || item.name}>
              <span>
                <strong>{item.name || "Inventory item"}</strong>
                <small>Target {item.target || 0} {item.unit || "unit"} · {formatCurrency(item.unitCost)} / {item.unit || "unit"}</small>
              </span>
              <span>
                <strong>{item.amount || 0} {item.unit || "unit"}</strong>
                <small>{formatCurrency(itemValue)} on hand</small>
              </span>
              <em>{tone === "critical" ? "Critical" : tone === "low" ? "Low" : "Ready"}</em>
            </article>
          );
        }) : (
          <article className="production-inventory-empty">
            <Package size={22} />
            <span><strong>No inventory yet</strong><small>Add flour, packaging, labels, jars, and other supplies from Business.</small></span>
          </article>
        )}
      </div>
    </section>
  );
}

function ProductionOperations({
  area,
  onChangeArea,
  onOpenBakeDesk,
  bakerySettings,
  bakePlans = [],
  cloudAccount,
  inventory = [],
  orders = [],
  starters = [],
  starterLogs = [],
  onDeleteStarter,
  onDeleteStarterLog,
  onSaveStarter,
  onStarterLogged,
}) {
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [unavailableDays, setUnavailableDays] = useState([]);
  const [availabilityMode, setAvailabilityMode] = useState(false);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const activeArea = operationAreas.some((item) => item.id === area) ? area : "calendar";
  const acceptedOrderBakes = useMemo(() => orders.flatMap((order) => {
    if (!order.cloudOrderId || order.status === "Completed") return [];
    const date = pickupDateKey(order.pickupAt);
    if (!date) return [];
    return [{
      id: `accepted-${order.id}`,
      date,
      customer: order.customer,
      recipeName: order.product,
      loaves: order.quantity,
      orderId: order.id,
      kind: "accepted-order",
    }];
  }), [orders]);
  const lowStockItems = useMemo(() => inventory.filter((item) => itemStockTone(item) !== "ok"), [inventory]);

  useEffect(() => {
    const bakeryId = cloudAccount.workspace?.bakeryId;
    if (!bakeryId) {
      setUnavailableDays([]);
      return undefined;
    }
    let active = true;
    listBakeryUnavailableDays(bakeryId)
      .then((days) => {
        if (active) setUnavailableDays(days);
      })
      .catch((error) => {
        if (active) setAvailabilityError(error.message);
      });
    return () => {
      active = false;
    };
  }, [cloudAccount.workspace?.bakeryId]);

  async function toggleUnavailableDate(date) {
    const bakeryId = cloudAccount.workspace?.bakeryId;
    if (!bakeryId || availabilitySaving) return;
    setAvailabilitySaving(true);
    setAvailabilityError("");
    try {
      const existing = unavailableDays.find((day) => day.unavailable_date === date);
      if (existing) {
        await unblockBakeryDay(bakeryId, date);
        setUnavailableDays((current) => current.filter((day) => day.unavailable_date !== date));
      } else {
        const blocked = await blockBakeryDay(bakeryId, date);
        setUnavailableDays((current) => [...current, blocked].sort((a, b) => a.unavailable_date.localeCompare(b.unavailable_date)));
      }
    } catch (error) {
      setAvailabilityError(error.message);
    } finally {
      setAvailabilitySaving(false);
    }
  }

  return (
    <main className="page production-operations-page">
      <section className="production-ops-hero">
        <div>
          <span className="eyebrow-label dark">Production control</span>
          <h1>Production</h1>
          <p>Calendar, starter health, customer blackout days, and the ingredient stock you need before work starts.</p>
        </div>
        <div className="production-ops-metrics">
          <article><CalendarDays size={18} /><span><small>Planned</small><strong>{bakePlans.length}</strong></span></article>
          <article><ClipboardList size={18} /><span><small>Accepted</small><strong>{acceptedOrderBakes.length}</strong></span></article>
          <article><Sprout size={18} /><span><small>Starters</small><strong>{starters.length}</strong></span></article>
          <article className={lowStockItems.length ? "warning" : ""}><Boxes size={18} /><span><small>Low stock</small><strong>{lowStockItems.length}</strong></span></article>
        </div>
      </section>

      <div className="view-switch production-ops-switch" aria-label="Production operations">
        {operationAreas.map(({ id, label, icon: Icon }) => (
          <button type="button" className={activeArea === id ? "selected" : ""} key={id} onClick={() => onChangeArea(id)}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {activeArea === "calendar" ? (
        <BakeCalendar
          month={calendarMonth}
          plans={bakePlans}
          orderBakes={acceptedOrderBakes}
          unavailableDays={unavailableDays}
          availabilityMode={availabilityMode}
          availabilitySaving={availabilitySaving}
          canManageAvailability={Boolean(cloudAccount.workspace?.bakeryId)}
          availabilityError={availabilityError}
          onToggleAvailabilityMode={() => setAvailabilityMode((current) => !current)}
          onToggleUnavailable={toggleUnavailableDate}
          onChangeMonth={(amount) => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1))}
          onSelectDate={(date) => onOpenBakeDesk({ date })}
          onOpenPlan={(plan) => onOpenBakeDesk({ plan })}
        />
      ) : null}

      {activeArea === "starters" ? (
        <StarterLab
          starters={starters}
          starterLogs={starterLogs}
          onSaveStarter={onSaveStarter}
          onDeleteStarter={onDeleteStarter}
          onStarterLogged={onStarterLogged}
          onDeleteStarterLog={onDeleteStarterLog}
        />
      ) : null}

      {activeArea === "inventory" ? <InventoryOnHand inventory={inventory} /> : null}

      {activeArea === "calendar" ? (
        <p className="production-ops-note">
          Customer capacity is still based on your bakery settings: {bakerySettings?.dailyBakeCapacity || 6} bake slots per pickup day.
        </p>
      ) : null}
    </main>
  );
}

export default function ProductionPage(props) {
  const [view, setView] = useState(props.productionView || "operations");
  const [operationArea, setOperationArea] = useState(props.productionArea || "calendar");
  const [productionPlanDate, setProductionPlanDate] = useState(null);
  const [productionPlanToLoad, setProductionPlanToLoad] = useState(null);

  useEffect(() => {
    if (props.productionView) setView(props.productionView);
  }, [props.productionView]);

  useEffect(() => {
    if (props.productionArea) setOperationArea(props.productionArea);
  }, [props.productionArea]);

  useEffect(() => {
    document.querySelector(".scroll-view")?.scrollTo({ top: 0, left: 0 });
  }, [view, operationArea]);

  function openProductionArea(area = "calendar") {
    setOperationArea(area === "starters" ? "starters" : area);
    setView("operations");
  }

  function openBakeDesk(options = {}) {
    if (options.date) setProductionPlanDate({ date: options.date, nonce: Date.now() });
    if (options.plan) setProductionPlanToLoad({ plan: options.plan, nonce: Date.now() });
    setView("bake");
  }

  return (
    <>
      {view === "bake" ? (
        <BakePage
          {...props}
          productionPlanDate={productionPlanDate}
          productionPlanToLoad={productionPlanToLoad}
          onOpenProductionArea={openProductionArea}
        />
      ) : null}
      {view === "operations" ? (
        <ProductionOperations
          {...props}
          area={operationArea}
          onChangeArea={setOperationArea}
          onOpenBakeDesk={openBakeDesk}
        />
      ) : null}
      {view === "liquid" ? <LiquidPage {...props} /> : null}
    </>
  );
}
