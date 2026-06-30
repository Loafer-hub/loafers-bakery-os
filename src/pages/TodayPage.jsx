import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Gauge,
  PackageCheck,
  ShoppingBag,
  Store,
  Thermometer,
  TrendingUp,
  Wheat,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BrandHeader } from "../components/AppChrome";
import { ReadyShelf } from "../components/ReadyShelf";
import { listReadyShelfItems } from "../lib/cloud";
import { buildBakeSchedule } from "../lib/fermentationModel";
import { activeKitchenBakes, buildKitchenBakeSchedule } from "../lib/kitchenBakes";
import { pickupDateKey } from "../lib/orderCapacity";
import { buildProductionPlanner, DEFAULT_PRODUCTION_AUTOMATION } from "../lib/productionPlanner";

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const CLOSED_ORDER_STATUSES = new Set(["completed", "rejected", "cancelled", "canceled"]);

function isOpenProductionOrder(order) {
  return order?.isSample !== true && !CLOSED_ORDER_STATUSES.has(String(order?.status || "").toLowerCase());
}

function money(value) {
  return Number(value || 0).toFixed(2);
}

function timeLabel(value) {
  if (!value) return "Arrange";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function dateTimeLabel(value) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function pickupWindowsFor(date, settings) {
  const isWeekend = [0, 6].includes(date.getDay());
  const windows = isWeekend ? settings?.weekendWindows : settings?.weekdayWindows;
  return (windows || [])
    .filter((window) => window?.start && window?.end)
    .map((window) => `${timeLabel(`2026-01-01T${window.start}`)}–${timeLabel(`2026-01-01T${window.end}`)}`);
}

function inventoryAmount(row) {
  if (!row) return "Missing";
  if (row.matched === false) return "No inventory match";
  const unit = row.item?.unit || "";
  const needed = row.needed !== undefined ? Number(row.needed).toFixed(row.needed >= 10 ? 0 : 1) : "—";
  const available = row.available !== undefined ? Number(row.available).toFixed(row.available >= 10 ? 0 : 1) : "—";
  return `${available}/${needed} ${unit}`.trim();
}

function BakeTimeline({ model }) {
  if (!model) {
    return (
      <div className="bake-timeline empty-timeline" aria-label="No planned bake">
        <span>Nothing scheduled yet. Plan a bake to build this timeline.</span>
      </div>
    );
  }

  const steps = model.steps
    .filter((step) => ["mix", "primary", "shape", "final-proof", "bake"].includes(step.id))
    .slice(0, 4)
    .map((step) => ({
      label: step.label.replace(" dough", ""),
      time: step.start.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" }),
    }));

  return (
    <div className="bake-timeline" aria-label="Today's bake timeline">
      <div className="timeline-line" />
      {steps.map((step, index) => (
        <div className="timeline-step" key={step.label}>
          <span className={index === 0 ? "timeline-number active" : "timeline-number"}>{index + 1}</span>
          <span className="timeline-art">
            {index === 0 ? <Wheat size={27} /> : index === 1 ? <span className="dough-glyph">◒</span> : <span className="loaf-glyph">╱╱╱</span>}
          </span>
          <strong>{step.label}</strong>
          <span>{step.time}</span>
        </div>
      ))}
    </div>
  );
}

function visualFermentationState(model) {
  if (!model) {
    return {
      percent: 0,
      status: "No active dough timeline",
      detail: "Plan a bake and I’ll turn the schedule into a visual fermentation gauge.",
      blocks: "░░░░░░░░░░",
      word: "fermented",
    };
  }

  const now = new Date();
  const timeline = model.timeline || {};
  const primaryLabel = timeline.primaryLabel || "Bulk fermentation";
  const word = timeline.useBulkFermentRules ? "fermented" : "risen";
  const mix = model.steps.find((step) => step.id === "mix")?.start || model.mix;
  const primaryEnd = timeline.primaryEnd || model.steps.find((step) => ["shape", "primary"].includes(step.id))?.start;
  const primaryStart = new Date(mix);
  const primaryDone = new Date(primaryEnd || primaryStart.getTime() + model.dough.bulkHours * 60 * 60 * 1000);
  const total = Math.max(1, primaryDone.getTime() - primaryStart.getTime());
  const rawPercent = (now.getTime() - primaryStart.getTime()) / total * 100;
  const percent = Math.round(clamp(rawPercent, 0, 100));
  const filled = Math.round(percent / 10);
  const blocks = `${"█".repeat(filled)}${"░".repeat(10 - filled)}`;

  if (now < primaryStart) {
    return {
      percent: 0,
      status: "Waiting to mix",
      detail: `${primaryLabel} starts ${primaryStart.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}.`,
      blocks,
      word,
    };
  }

  if (now > primaryDone) {
    return {
      percent: 100,
      status: `${primaryLabel} target reached`,
      detail: "Move by dough strength now: shape, chill, or bake according to the plan.",
      blocks,
      word,
    };
  }

  return {
    percent,
    status: `${primaryLabel} in motion`,
    detail: `${model.dough.bulkHours.toFixed(1)}h model based on temperature, hydration, flour behavior${model.timeline?.usesStarter ? ", and starter strength" : ", and yeast amount"}.`,
    blocks,
    word,
  };
}

function FermentationVisual({ model, sourceLabel }) {
  const state = visualFermentationState(model);
  const doughScale = 0.68 + (state.percent / 100) * 0.42;
  return (
    <section className="visual-fermentation-card" aria-label="Visual fermentation">
      <div className="section-title-line">
        <div>
          <span className="eyebrow-label dark">Visual fermentation</span>
          <h2>{state.percent}% {state.word}</h2>
          {sourceLabel ? <small className="visual-source-label">{sourceLabel}</small> : null}
        </div>
        <span className="fermentation-blocks" aria-hidden="true">{state.blocks}</span>
      </div>
      <div className="fermentation-visual-body">
        <div className="fermentation-jar" aria-hidden="true">
          <span className="fermentation-dough" style={{ transform: `scale(${doughScale})` }} />
          <span className="fermentation-bubble bubble-one" />
          <span className="fermentation-bubble bubble-two" />
          <span className="fermentation-bubble bubble-three" />
        </div>
        <div>
          <strong>{state.status}</strong>
          <p>{state.detail}</p>
          <div className="fermentation-progress-track" aria-label={`${state.percent}% ${state.word}`}>
            <i style={{ width: `${state.percent}%` }} />
          </div>
          <small>Visuals are a guide. Final call still comes from dough rise, bubbles, doming, and strength.</small>
        </div>
      </div>
    </section>
  );
}

function ProductionDashboard({
  bakerySettings,
  cloudAccount,
  inventory,
  kitchenBakes,
  onOpenOrder,
  orders,
  productionAutomation,
  readyShelfRefreshKey,
  recipes,
  setActive,
  starterLogs,
  starters,
}) {
  const [shelfItems, setShelfItems] = useState([]);
  const [shelfError, setShelfError] = useState("");
  const todayKey = pickupDateKey(new Date());
  const dailyCapacity = Math.max(1, Number(bakerySettings?.dailyCapacity || 6));
  const acceptedToday = orders
    .filter(isOpenProductionOrder)
    .filter((order) => (
      pickupDateKey(order.pickupAt) === todayKey || (!order.pickupAt && String(order.due || "").toLowerCase() === "today")
    ))
    .sort((a, b) => new Date(a.pickupAt || a.createdAt || 0) - new Date(b.pickupAt || b.createdAt || 0));
  const acceptedSlots = acceptedToday.reduce((sum, order) => sum + Number(order.quantity || 0), 0);
  const activeBakes = useMemo(() => activeKitchenBakes(kitchenBakes), [kitchenBakes]);
  const productionPlan = useMemo(() => buildProductionPlanner({
    orders: orders.filter(isOpenProductionOrder),
    recipes,
    inventory,
    starters,
    starterLogs,
    settings: { ...DEFAULT_PRODUCTION_AUTOMATION, ...productionAutomation },
  }), [inventory, orders, productionAutomation, recipes, starterLogs, starters]);
  const lowInventory = inventory
    .filter((item) => Number(item.target || 0) > 0 && Number(item.amount || 0) < Number(item.target || 0))
    .map((item) => ({
      name: item.name,
      matched: true,
      needed: Number(item.target || 0),
      available: Number(item.amount || 0),
      item,
      lowStock: true,
    }));
  const shortageRows = [...productionPlan.shortages, ...lowInventory]
    .filter((row, index, rows) => rows.findIndex((item) => item.name === row.name) === index)
    .slice(0, 5);
  const windows = pickupWindowsFor(new Date(), bakerySettings);
  const readyShelfEnabled = bakerySettings?.readyShelfEnabled !== false;
  const bakeryId = cloudAccount.workspace?.bakeryId;

  useEffect(() => {
    let active = true;
    if (!readyShelfEnabled || !bakeryId) {
      setShelfItems([]);
      setShelfError("");
      return () => {
        active = false;
      };
    }
    listReadyShelfItems(bakeryId)
      .then((items) => {
        if (active) {
          setShelfItems(items.filter((item) => item.active !== false && Number(item.quantity || 0) > 0));
          setShelfError("");
        }
      })
      .catch((error) => {
        if (active) setShelfError(error.message || "Shelf check failed");
      });
    return () => {
      active = false;
    };
  }, [bakeryId, readyShelfEnabled, readyShelfRefreshKey]);

  const shelfQuantity = shelfItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  return (
    <section className="production-dashboard" aria-label="Daily production dashboard">
      <div className="section-title-line">
        <div>
          <span className="eyebrow-label dark">Daily production</span>
          <h2>Command center</h2>
          <small>Accepted orders, ready shelf, active bakes, pickups, and shortages in one place.</small>
        </div>
        <Store size={22} />
      </div>

      <div className="production-dashboard-grid">
        <article className="production-card production-orders-card">
          <span className="production-card-icon"><ShoppingBag size={18} /></span>
          <div>
            <strong>{acceptedToday.length} accepted today</strong>
            <small>{acceptedSlots} of {dailyCapacity} bake slots · ${money(acceptedToday.reduce((sum, order) => sum + Number(order.total || 0), 0))}</small>
          </div>
          <div className="production-mini-list">
            {acceptedToday.slice(0, 3).map((order) => (
              <button type="button" key={order.id} onClick={() => onOpenOrder?.(order.id)}>
                <span>{timeLabel(order.pickupAt || order.createdAt)}</span>
                <strong>{order.customer}</strong>
                <small>{order.itemSummary || `${order.quantity || 1} × ${order.product}`}</small>
              </button>
            ))}
            {!acceptedToday.length ? <small>No accepted pickups for today yet.</small> : null}
          </div>
        </article>

        <article className="production-card">
          <span className="production-card-icon"><PackageCheck size={18} /></span>
          <div>
            <strong>{readyShelfEnabled ? `${shelfQuantity} ready-shelf items` : "Ready shelf hidden"}</strong>
            <small>{shelfError || (bakeryId ? `${shelfItems.length} listing${shelfItems.length === 1 ? "" : "s"} available now` : "Sign into cloud to count ready stock")}</small>
          </div>
          <button type="button" className="text-button production-card-link" onClick={() => setActive("today")}>
            Manage shelf below <ChevronRight size={14} />
          </button>
        </article>

        <article className="production-card">
          <span className="production-card-icon"><Wheat size={18} /></span>
          <div>
            <strong>{activeBakes.length} in-progress bake{activeBakes.length === 1 ? "" : "s"}</strong>
            <small>{activeBakes[0] ? `${activeBakes[0].name || activeBakes[0].recipeName} · ${activeBakes[0].status || "working"}` : "Start a Kitchen bake to track steps live."}</small>
          </div>
          <button type="button" className="text-button production-card-link" onClick={() => setActive("bake")}>
            Open Kitchen <ChevronRight size={14} />
          </button>
        </article>

        <article className="production-card">
          <span className="production-card-icon"><Clock3 size={18} /></span>
          <div>
            <strong>Pickup windows</strong>
            <small>{windows.length ? windows.join(" · ") : "No pickup hours set for today"}</small>
          </div>
          <div className="production-window-list">
            {acceptedToday.slice(0, 4).map((order) => (
              <span key={order.id}><b>{timeLabel(order.pickupAt)}</b> {order.customer}</span>
            ))}
            {!acceptedToday.length ? <span>No pickups to stage.</span> : null}
          </div>
        </article>

        <article className={`production-card production-shortage-card ${shortageRows.length ? "warning" : "clear"}`}>
          <span className="production-card-icon">{shortageRows.length ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}</span>
          <div>
            <strong>{shortageRows.length ? `${shortageRows.length} shortage flag${shortageRows.length === 1 ? "" : "s"}` : "No shortage flags"}</strong>
            <small>{shortageRows.length ? "Based on open orders, recipes, packaging, and restock targets." : "Inventory looks okay for current open production."}</small>
          </div>
          <div className="production-shortage-list">
            {shortageRows.map((row) => (
              <span key={row.name}>
                <b>{row.name}</b>
                <small>{row.lowStock ? "Below target" : inventoryAmount(row)}</small>
              </span>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

export default function TodayPage({
  bakerySettings,
  cloudAccount,
  inventory,
  orders,
  productionAutomation,
  setActive,
  onLogStarter,
  onOpenOrder,
  starters,
  starterLogs,
  bakePlans,
  kitchenBakes,
  selectedKitchenBakeId,
  recipes,
  onOpenStorage,
  onSelectKitchenBake,
}) {
  const [readyShelfRefreshKey, setReadyShelfRefreshKey] = useState(0);
  const dailyCapacity = Math.max(1, Number(bakerySettings?.dailyCapacity || 6));
  const today = new Date();
  const todayKey = pickupDateKey(today);
  const todayOrders = orders.filter((order) => (
    order.isSample !== true
    && order.status !== "Completed"
    && (pickupDateKey(order.pickupAt) === todayKey || (!order.pickupAt && order.due === "Today"))
  ));
  const totalLoaves = todayOrders.reduce((sum, order) => sum + Number(order.quantity || 0), 0);
  const totalItems = todayOrders.reduce((sum, order) => sum + Number(order.totalUnits || order.quantity || 0), 0);
  const revenue = todayOrders.reduce((sum, order) => sum + order.total, 0);
  const capacityUsed = Math.min(dailyCapacity, totalLoaves);
  const starter = starters[0];
  const latestStarterLog = starterLogs.find((log) => log.starterId === starter?.id) || starterLogs[0];
  const activeKitchenList = useMemo(() => activeKitchenBakes(kitchenBakes), [kitchenBakes]);
  const selectedKitchenBake = useMemo(() => {
    if (!activeKitchenList.length || selectedKitchenBakeId === "planned") return null;
    return activeKitchenList.find((bake) => bake.id === selectedKitchenBakeId)
      || (!selectedKitchenBakeId ? activeKitchenList[0] : null);
  }, [activeKitchenList, selectedKitchenBakeId]);
  const kitchenBakeModel = useMemo(() => (
    selectedKitchenBake
      ? buildKitchenBakeSchedule(selectedKitchenBake, recipes, starters, starterLogs)
      : null
  ), [recipes, selectedKitchenBake, starterLogs, starters]);
  const plannedBakeModel = useMemo(() => {
    const nextPlan = [...bakePlans]
      .filter((plan) => new Date(plan.bakeEnd || `${plan.date}T23:59:00`) >= new Date())
      .sort((a, b) => new Date(a.bakeEnd || a.date) - new Date(b.bakeEnd || b.date))[0];
    if (!nextPlan) return null;
    const planRecipe = recipes.find((item) => item.id === nextPlan.recipeId);
    const planStarter = starters.find((item) => item.id === nextPlan.starterId) || starters[0];
    if (!planRecipe || !planStarter) return null;
    return buildBakeSchedule({
      recipe: planRecipe,
      loaves: nextPlan.loaves,
      doughTemperature: nextPlan.doughTemperature || 76,
      coldProofHours: nextPlan.coldProofHours ?? 12,
      anchorMode: nextPlan.anchorMode || "start",
      anchorDateTime: nextPlan.anchorDateTime || `${nextPlan.date}T06:30`,
      starter: planStarter,
      ratio: nextPlan.ratio || "1:2:2",
      starterLogs,
    });
  }, [bakePlans, recipes, starterLogs, starters]);
  const visualModel = kitchenBakeModel || plannedBakeModel;
  const visualSourceLabel = selectedKitchenBake
    ? `Watching ${selectedKitchenBake.name || selectedKitchenBake.recipeName}`
    : plannedBakeModel
      ? "Watching next planned bake"
      : "No active bake selected";
  const markReadyShelfChanged = useCallback(() => {
    setReadyShelfRefreshKey((current) => current + 1);
  }, []);

  return (
    <main className="page today-page">
      <BrandHeader onOpenStorage={onOpenStorage} />
      <section className="greeting">
        <h1>Good morning, Joshua</h1>
        <p>{today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
      </section>

      <section>
        <h2 className="display-title">Today’s bake</h2>
        <BakeTimeline model={visualModel} />
      </section>

      {activeKitchenList.length ? (
        <section className="today-bake-selector" aria-label="Select active bake visual">
          <span><strong>Visual source</strong><small>Pick which named Kitchen bake the fermentation visual follows.</small></span>
          <select
            value={selectedKitchenBake?.id || "planned"}
            onChange={(event) => onSelectKitchenBake?.(event.target.value)}
          >
            <option value="planned">Next planned bake</option>
            {activeKitchenList.map((bake) => (
              <option key={bake.id} value={bake.id}>{bake.name || bake.recipeName}</option>
            ))}
          </select>
        </section>
      ) : null}

      <FermentationVisual model={visualModel} sourceLabel={visualSourceLabel} />

      <ProductionDashboard
        bakerySettings={bakerySettings}
        cloudAccount={cloudAccount}
        inventory={inventory}
        kitchenBakes={kitchenBakes}
        onOpenOrder={onOpenOrder}
        orders={orders}
        productionAutomation={productionAutomation}
        readyShelfRefreshKey={readyShelfRefreshKey}
        recipes={recipes}
        setActive={setActive}
        starterLogs={starterLogs}
        starters={starters}
      />

      <ReadyShelf
        cloudAccount={cloudAccount}
        enabled={bakerySettings?.readyShelfEnabled !== false}
        onShelfChange={markReadyShelfChanged}
      />

      <button className="starter-panel" onClick={onLogStarter}>
        <span className="starter-illustration"><Wheat size={39} strokeWidth={1.4} /></span>
        <span className="starter-copy">
          <span className="panel-title">{starter?.name || "Starter"}</span>
          <span className="starter-ready">{latestStarterLog ? `Last fed ${new Date(latestStarterLog.dateTime || Date.now()).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "Ready for a first feed log"}</span>
          <span className="starter-stats">
            <span><TrendingUp size={18} /> <b>{latestStarterLog?.rise || "—"}×</b> rise</span>
            <span><Thermometer size={18} /> <b>{latestStarterLog?.temperature || "—"}°F</b></span>
          </span>
        </span>
        <ChevronRight size={22} className="panel-chevron" />
      </button>

      <section className="order-panel">
        <div className="panel-heading">
          <span><ShoppingBag size={21} /> Order summary</span>
          <button onClick={() => setActive("orders")}>
            {totalItems} items&nbsp; / &nbsp;${revenue}
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="order-preview-list">
          {todayOrders.map((order) => (
            <button className="order-preview" key={order.id} onClick={() => onOpenOrder(order.id)}>
              <span className={`avatar avatar-${order.accent}`}>{order.initials}</span>
              <span className="order-preview-copy">
                <strong>{order.customer}</strong>
                <small>{order.itemSummary || `${order.quantity} × ${order.product}`}</small>
              </span>
              <span className="order-preview-price">
                <strong>${order.total}</strong>
                <small>{order.status}</small>
              </span>
              <ChevronRight size={18} />
            </button>
          ))}
        </div>
        <div className="capacity-row">
          <Gauge size={21} />
          <span><b>{totalLoaves}</b> of {dailyCapacity} bake slots today</span>
          <span
            className="capacity-track"
            style={{ gridTemplateColumns: `repeat(${dailyCapacity}, 1fr)` }}
            aria-label={`${totalLoaves} of ${dailyCapacity} bake slots booked today`}
          >
            {Array.from({ length: dailyCapacity }, (_, index) => (
              <i key={index} className={index < capacityUsed ? "filled" : ""} />
            ))}
          </span>
        </div>
        <button className="primary-button" onClick={() => setActive("bake")}>
          Plan next bake <ArrowRight size={19} />
        </button>
      </section>
    </main>
  );
}
