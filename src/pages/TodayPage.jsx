import {
  ArrowRight,
  ChevronRight,
  Gauge,
  ShoppingBag,
  Thermometer,
  TrendingUp,
  Wheat,
} from "lucide-react";
import { useMemo } from "react";
import { BrandHeader } from "../components/AppChrome";
import { ReadyShelf } from "../components/ReadyShelf";
import { buildBakeSchedule } from "../lib/fermentationModel";
import { activeKitchenBakes, buildKitchenBakeSchedule } from "../lib/kitchenBakes";
import { pickupDateKey } from "../lib/orderCapacity";

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

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

export default function TodayPage({
  bakerySettings,
  cloudAccount,
  orders,
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

      <ReadyShelf cloudAccount={cloudAccount} enabled={bakerySettings?.readyShelfEnabled !== false} />

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
