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
import { buildBakeSchedule } from "../lib/fermentationModel";
import { MAX_DAILY_LOAVES, pickupDateKey } from "../lib/orderCapacity";

function BakeTimeline({ model }) {
  if (!model) {
    return (
      <div className="bake-timeline empty-timeline" aria-label="No planned bake">
        <span>Nothing scheduled yet. Plan a bake to build this timeline.</span>
      </div>
    );
  }

  const steps = model.steps
    .filter((step) => ["mix", "shape", "bake"].includes(step.id))
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

export default function TodayPage({
  orders,
  setActive,
  onLogStarter,
  onOpenOrder,
  starters,
  starterLogs,
  bakePlans,
  recipes,
  onOpenStorage,
}) {
  const today = new Date();
  const todayKey = pickupDateKey(today);
  const todayOrders = orders.filter((order) => (
    order.isSample !== true
    && order.status !== "Completed"
    && (pickupDateKey(order.pickupAt) === todayKey || (!order.pickupAt && order.due === "Today"))
  ));
  const totalLoaves = todayOrders.reduce((sum, order) => sum + order.quantity, 0);
  const revenue = todayOrders.reduce((sum, order) => sum + order.total, 0);
  const capacityUsed = Math.min(MAX_DAILY_LOAVES, totalLoaves);
  const starter = starters[0];
  const latestStarterLog = starterLogs.find((log) => log.starterId === starter?.id) || starterLogs[0];
  const nextBakeModel = useMemo(() => {
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

  return (
    <main className="page today-page">
      <BrandHeader onOpenStorage={onOpenStorage} />
      <section className="greeting">
        <h1>Good morning, Joshua</h1>
        <p>{today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
      </section>

      <section>
        <h2 className="display-title">Today’s bake</h2>
        <BakeTimeline model={nextBakeModel} />
      </section>

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
            {totalLoaves} loaves&nbsp; / &nbsp;${revenue}
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="order-preview-list">
          {todayOrders.map((order) => (
            <button className="order-preview" key={order.id} onClick={() => onOpenOrder(order.id)}>
              <span className={`avatar avatar-${order.accent}`}>{order.initials}</span>
              <span className="order-preview-copy">
                <strong>{order.customer}</strong>
                <small>{order.quantity} × {order.product}</small>
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
          <span><b>{totalLoaves}</b> of {MAX_DAILY_LOAVES} loaves today</span>
          <span
            className="capacity-track"
            style={{ gridTemplateColumns: `repeat(${MAX_DAILY_LOAVES}, 1fr)` }}
            aria-label={`${totalLoaves} of ${MAX_DAILY_LOAVES} loaves booked today`}
          >
            {Array.from({ length: MAX_DAILY_LOAVES }, (_, index) => (
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
