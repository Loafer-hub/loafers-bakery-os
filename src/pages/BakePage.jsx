import {
  AlertTriangle,
  Beaker,
  CalendarDays,
  ChefHat,
  ClipboardCheck,
  Clock3,
  Layers3,
  Minus,
  Plus,
  Thermometer,
  Trash2,
  Wheat,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BakeCalendar } from "../components/BakeCalendar";
import { KitchenBoard } from "../components/KitchenBoard";
import { ProductionPlanner } from "../components/ProductionPlanner";
import { StarterLab } from "../components/StarterLab";
import { EmptyState } from "../components/Primitives";
import {
  buildBakeSchedule,
  curvePath,
  recipeFlourBlend,
} from "../lib/fermentationModel";
import { normalizeTimelineSettings, recipeUsesStarter } from "../lib/recipeTimeline";
import { acceptedOrderBakesFromOrders } from "../lib/orderRecords";
import {
  blockBakeryDay,
  listBakeryUnavailableDays,
  unblockBakeryDay,
} from "../lib/cloud";

// bake-yeast-tab-fix-v1

function localDateTimeValue(date = new Date()) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

function defaultAnchor() {
  const date = new Date();
  date.setDate(date.getDate() + 2);
  date.setHours(6, 30, 0, 0);
  return localDateTimeValue(date);
}

function localDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatScheduleTime(date) {
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatShortTime(date) {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function sameCalendarDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

const bakeViews = [
  {
    id: "plan",
    label: "Plan",
    heading: "Plan a bake",
    editHeading: "Change bake plan",
    subtitle: "Build one science-backed timeline from mix time or desired finish.",
  },
  {
    id: "kitchen",
    label: "Kitchen",
    heading: "Kitchen work",
    subtitle: "Live checklists for active bakes, folds, proofing, baking, and completion.",
  },
  {
    id: "production",
    label: "Batches",
    heading: "Batch planning",
    subtitle: "Group accepted orders, stagger starts, check formulas, and spot shortages.",
  },
  {
    id: "calendar",
    label: "Calendar",
    heading: "Bake calendar",
    subtitle: "Planned bakes, accepted orders, and unavailable bake days.",
  },
  {
    id: "starter",
    label: "Starters",
    heading: "Starter care",
    subtitle: "Starter profiles, feed logs, ratios, and flour blends.",
  },
];

const bakeDeskViews = bakeViews.filter((item) => !["calendar", "starter"].includes(item.id));
const bakeViewCopy = Object.fromEntries(bakeViews.map((item) => [item.id, item]));

export default function BakePage({
  bakerySettings,
  batchTraceRecords,
  cloudAccount,
  productionAutomation,
  inventory,
  liquidSafetyLogs,
  recipes,
  bakePlans,
  kitchenBakes,
  selectedKitchenBakeId,
  orders,
  starters,
  starterLogs,
  onDeleteBakePlan,
  onDeleteKitchenBake,
  onDeleteStarter,
  onChangeProductionAutomation,
  onSaveBakePlan,
  onSaveKitchenBake,
  onSaveStarter,
  onSelectKitchenBake,
  onSyncProductionPlans,
  onStarterLogged,
  onDeleteStarterLog,
  onOpenProductionArea,
  bakeDeskRecipeSignal,
  productionPlanDate,
  productionPlanToLoad,
}) {
  const [view, setView] = useState("plan");
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [confirmPlanDelete, setConfirmPlanDelete] = useState(false);
  const [recipeId, setRecipeId] = useState(recipes[0]?.id || "");
  const [loaves, setLoaves] = useState(recipes[0]?.yield || 1);
  const [starterId, setStarterId] = useState(starters[0]?.id || "");
  const [ratio, setRatio] = useState("1:2:2");
  const [doughTemperature, setDoughTemperature] = useState(76);
  const [coldProofHours, setColdProofHours] = useState(12);
  const [anchorMode, setAnchorMode] = useState("start");
  const [anchorDateTime, setAnchorDateTime] = useState(defaultAnchor);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const date = new Date(defaultAnchor());
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [unavailableDays, setUnavailableDays] = useState([]);
  const [availabilityError, setAvailabilityError] = useState("");
  const [availabilityMode, setAvailabilityMode] = useState(false);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const recipe = recipes.find((item) => item.id === recipeId) || recipes[0];
  const timelineSettings = normalizeTimelineSettings(recipe);
  const usesStarter = recipeUsesStarter(recipe);
  const starter = usesStarter ? (starters.find((item) => item.id === starterId) || starters[0]) : null;
  const acceptedOrderBakes = useMemo(() => acceptedOrderBakesFromOrders(orders), [orders]);

  useEffect(() => {
    if (["calendar", "starter"].includes(view)) setView("plan");
  }, [view]);

  useEffect(() => {
    if (recipes.length && !recipes.some((item) => item.id === recipeId)) {
      setRecipeId(recipes[0].id);
      setLoaves(recipes[0].yield);
    }
  }, [recipeId, recipes]);

  useEffect(() => {
    if (productionPlanDate?.date) resetForDate(productionPlanDate.date);
  }, [productionPlanDate?.nonce]);

  useEffect(() => {
    if (productionPlanToLoad?.plan) loadPlan(productionPlanToLoad.plan);
  }, [productionPlanToLoad?.nonce]);

  useEffect(() => {
    if (!bakeDeskRecipeSignal?.recipeId) return;
    const nextRecipe = recipes.find((item) => item.id === bakeDeskRecipeSignal.recipeId);
    if (!nextRecipe) return;
    const nextTimeline = normalizeTimelineSettings(nextRecipe);
    const nextUsesStarter = recipeUsesStarter(nextRecipe);
    setEditingPlanId(null);
    setConfirmPlanDelete(false);
    setRecipeId(nextRecipe.id);
    setLoaves(Number(nextRecipe.yield || 1));
    setStarterId(nextUsesStarter ? (starters[0]?.id || "") : "");
    setRatio(nextUsesStarter ? "1:2:2" : "");
    setDoughTemperature(76);
    setColdProofHours(nextTimeline.includeColdProof ? Number(nextTimeline.defaultColdProofHours || 0) : 0);
    setAnchorMode("start");
    setAnchorDateTime(defaultAnchor());
    setView(bakeDeskRecipeSignal.view === "kitchen" ? "kitchen" : "plan");
  }, [bakeDeskRecipeSignal?.nonce]);

  useEffect(() => {
    if (!usesStarter) {
      if (starterId) setStarterId("");
      return;
    }
    if (starters.length && !starters.some((item) => item.id === starterId)) {
      setStarterId(starters[0].id);
    }
  }, [starterId, starters, usesStarter]);

  useEffect(() => {
    setColdProofHours((current) => (
      timelineSettings.includeColdProof
        ? (current || timelineSettings.defaultColdProofHours)
        : 0
    ));
  }, [recipeId, timelineSettings.defaultColdProofHours, timelineSettings.includeColdProof]);

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

  const model = useMemo(() => {
    if (!recipe || !anchorDateTime || (usesStarter && !starter)) return null;
    return buildBakeSchedule({
      recipe,
      loaves,
      doughTemperature,
      coldProofHours,
      anchorMode,
      anchorDateTime,
      starter,
      ratio,
      starterLogs,
    });
  }, [
    anchorDateTime,
    anchorMode,
    coldProofHours,
    doughTemperature,
    loaves,
    ratio,
    recipe,
    starter,
    starterLogs,
    usesStarter,
  ]);

  const doughCurve = curvePath(model?.dough?.bulkHours || 4.75, "dough");
  const levainCurve = curvePath(model?.starterPeak?.hours || 5, "starter");
  const updateAnchorDateTime = (event) => setAnchorDateTime(event.currentTarget.value);

  function resetForDate(date) {
    setEditingPlanId(null);
    setConfirmPlanDelete(false);
    setAnchorMode("start");
    setAnchorDateTime(`${date}T06:30`);
    setView("plan");
  }

  function loadPlan(plan) {
    const planRecipe = recipes.find((item) => item.id === plan.recipeId);
    const planUsesStarter = recipeUsesStarter(planRecipe);
    setEditingPlanId(plan.id);
    setRecipeId(plan.recipeId);
    setLoaves(plan.loaves);
    setStarterId(planUsesStarter ? (plan.starterId || starters[0]?.id || "") : "");
    setRatio(planUsesStarter ? (plan.ratio || "1:2:2") : "");
    setDoughTemperature(plan.doughTemperature || 76);
    setColdProofHours(plan.coldProofHours ?? 12);
    setAnchorMode(plan.anchorMode || "start");
    setAnchorDateTime(plan.anchorDateTime || `${plan.date}T06:30`);
    setConfirmPlanDelete(false);
    setView("plan");
  }

  function savePlan() {
    if (!recipe || !model || (usesStarter && !starter)) return;
    const planId = editingPlanId || Date.now();
    const finishDate = localDateKey(model.bakeEnd);
    onSaveBakePlan({
      id: planId,
      date: finishDate,
      recipeId: recipe.id,
      recipeName: recipe.name,
      loaves,
      starterId: usesStarter ? starter.id : "",
      starterName: usesStarter ? starter.name : "",
      ratio: usesStarter ? ratio : "",
      doughTemperature,
      coldProofHours: timelineSettings.includeColdProof ? coldProofHours : 0,
      anchorMode,
      anchorDateTime,
      bulkHours: Number(model.dough.bulkHours.toFixed(2)),
      bakeEnd: model.bakeEnd.toISOString(),
      isNew: !editingPlanId,
    });
    setEditingPlanId(planId);
    setCalendarMonth(new Date(model.bakeEnd.getFullYear(), model.bakeEnd.getMonth(), 1));
  }

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

  const activeViewCopy = bakeViewCopy[view] || bakeViewCopy.plan;
  const headingTitle = view === "plan" && editingPlanId
    ? activeViewCopy.editHeading
    : activeViewCopy.heading;
  const headingSubtitle = view === "calendar"
    ? `${activeViewCopy.subtitle} ${bakePlans.length} planned · ${acceptedOrderBakes.length} accepted.`
    : view === "kitchen"
      ? `${activeViewCopy.subtitle} ${kitchenBakes.filter((bake) => !bake.completedAt).length} active.`
    : view === "production"
      ? activeViewCopy.subtitle
    : view === "starter"
      ? `${activeViewCopy.subtitle} ${starters.length} ${starters.length === 1 ? "profile" : "profiles"}.`
      : model
        ? `${activeViewCopy.subtitle} Estimated finish ${formatScheduleTime(model.bakeEnd)}.`
        : activeViewCopy.subtitle;
  const activeKitchenList = kitchenBakes.filter((bake) => !bake.completedAt && String(bake.status || "active").toLowerCase() !== "completed");
  const upcomingPlans = [...bakePlans]
    .sort((a, b) => new Date(a.anchorDateTime || a.bakeEnd || a.date) - new Date(b.anchorDateTime || b.bakeEnd || b.date))
    .slice(0, 3);
  const now = new Date();
  const nextModelStep = model?.steps?.find((step) => new Date(step.end || step.start).getTime() >= now.getTime()) || model?.steps?.[0];
  const productionSignal = model?.dough?.activityRate > 1.65
    ? { value: "Fast dough", detail: "Check earlier than the timeline." }
    : activeKitchenList.length >= 4
      ? { value: "Busy bench", detail: "Use Kitchen before starting more." }
      : acceptedOrderBakes.length
        ? { value: "Orders queued", detail: `${acceptedOrderBakes.length} accepted pickup ${acceptedOrderBakes.length === 1 ? "order" : "orders"}.` }
        : { value: "On track", detail: "No production risk flagged." };
  const heroMetrics = [
    {
      label: "In progress",
      value: activeKitchenList.length,
      detail: activeKitchenList.length ? "Active kitchen bakes" : "Nothing on the bench",
      icon: ClipboardCheck,
    },
    {
      label: "Next step",
      value: nextModelStep?.label || "No plan",
      detail: nextModelStep ? formatScheduleTime(nextModelStep.start) : "Start from Plan",
      icon: Clock3,
    },
    {
      label: usesStarter ? "Starter ready" : "Rise mode",
      value: usesStarter ? (starter?.name || "Add starter") : "Yeast / direct",
      detail: usesStarter && model?.starterPeak ? `Peak about ${model.starterPeak.hours.toFixed(1)}h after feed` : `${timelineSettings.primaryLabel || "Rise"} timing`,
      icon: Wheat,
    },
    {
      label: "Production signal",
      value: productionSignal.value,
      detail: productionSignal.detail,
      icon: Layers3,
    },
  ];

  return (
    <main className="page bake-page">
      <section className="bake-command-hero">
        <div className="bake-command-copy">
          <span className="eyebrow-label dark">Loafers production</span>
          <h1>Bake desk</h1>
          <p>{headingSubtitle}</p>
        </div>
        <span className="bake-command-mark" aria-hidden="true"><ChefHat size={34} /></span>
        <div className="bake-command-grid">
          {heroMetrics.map((metric) => {
            const MetricIcon = metric.icon;
            return (
              <article className="bake-command-card" key={metric.label}>
                <MetricIcon size={18} />
                <span>
                  <small>{metric.label}</small>
                  <strong>{metric.value}</strong>
                  <em>{metric.detail}</em>
                </span>
              </article>
            );
          })}
        </div>
      </section>

      <section className="bake-workspace">
        <div className="bake-main-column">
          <section className="bake-workbench-card">
            <div className="bake-workbench-head">
              <span>
                <small>{activeViewCopy.label}</small>
                <h2>{headingTitle}</h2>
              </span>
              <span>{model ? `Finish ${formatScheduleTime(model.bakeEnd)}` : "Choose a work area"}</span>
            </div>
            <div className="view-switch bake-view-switch" aria-label="Bake work areas">
              {bakeDeskViews.map((item) => (
                <button
                  className={view === item.id ? "selected" : ""}
                  key={item.id}
                  onClick={() => setView(item.id)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="bake-workbench-body">

      {view === "kitchen" ? (
        <KitchenBoard
          bakePlans={bakePlans}
          inventory={inventory}
          kitchenBakes={kitchenBakes}
          orders={orders}
          productionAutomation={productionAutomation}
          recipes={recipes}
          selectedKitchenBakeId={selectedKitchenBakeId}
          starters={starters}
          starterLogs={starterLogs}
          onDeleteKitchenBake={onDeleteKitchenBake}
          onSaveKitchenBake={onSaveKitchenBake}
          onSelectKitchenBake={onSelectKitchenBake}
        />
      ) : null}

      {view === "production" ? (
        <ProductionPlanner
          automation={productionAutomation}
          bakerySettings={bakerySettings}
          batchTraceRecords={batchTraceRecords}
          cloudAccount={cloudAccount}
          inventory={inventory}
          liquidSafetyLogs={liquidSafetyLogs}
          orders={orders}
          recipes={recipes}
          starters={starters}
          starterLogs={starterLogs}
          onChangeAutomation={onChangeProductionAutomation}
          onSyncProductionPlans={onSyncProductionPlans}
        />
      ) : null}

      {view === "plan" ? (
        recipe && model ? (
          <>
            <section className="model-controls">
              <div className="anchor-switch">
                <button type="button" className={anchorMode === "start" ? "selected" : ""} onClick={() => setAnchorMode("start")}>Start from mix</button>
                <button type="button" className={anchorMode === "finish" ? "selected" : ""} onClick={() => setAnchorMode("finish")}>Finish baking by</button>
              </div>
              <label className="anchor-time-field">
                {anchorMode === "start" ? "Mix date and time" : "Desired finish"}
                <input type="datetime-local" value={anchorDateTime} onChange={updateAnchorDateTime} onInput={updateAnchorDateTime} />
              </label>
              <div className="planner-input-grid">
                <label>
                  Recipe
                  <select value={recipeId} onChange={(event) => {
                    const next = recipes.find((item) => item.id === event.target.value);
                    setRecipeId(event.target.value);
                    if (next) setLoaves(next.yield);
                  }}>
                    {recipes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <label>
                  Starter
                  {usesStarter ? (
                    <select value={starterId} onChange={(event) => setStarterId(event.target.value)}>
                      {starters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  ) : <span className="planner-static-value">Not used for this recipe</span>}
                </label>
                <label>
                  Dough temp °F
                  <input type="number" min="50" max="100" value={doughTemperature} onChange={(event) => setDoughTemperature(Number(event.target.value))} />
                </label>
                <label>
                  Levain ratio
                  {usesStarter ? (
                    <input value={ratio} onChange={(event) => setRatio(event.target.value)} placeholder="1:2:2" />
                  ) : <span className="planner-static-value">Not needed</span>}
                </label>
                <label>
                  Cold proof hours
                  {timelineSettings.includeColdProof ? (
                    <input type="number" min="0" max="48" step="0.5" value={coldProofHours} onChange={(event) => setColdProofHours(Number(event.target.value))} />
                  ) : <span className="planner-static-value">Skipped</span>}
                </label>
                <label>
                  Loaves
                  <span className="inline-stepper">
                    <button type="button" onClick={() => setLoaves((current) => Math.max(1, current - 1))} aria-label="Decrease loaves"><Minus size={16} /></button>
                    <b>{loaves}</b>
                    <button type="button" onClick={() => setLoaves((current) => Math.min(40, current + 1))} aria-label="Increase loaves"><Plus size={16} /></button>
                  </span>
                </label>
              </div>
            </section>

            <section className="dynamic-schedule" aria-label="Science-backed bake timeline">
              <div className="section-title-line">
                <h2>Timeline</h2>
                <span>{model.dough.bulkHours.toFixed(1)}h {timelineSettings.primaryLabel.toLowerCase()}{timelineSettings.includeColdProof ? ` · ${coldProofHours}h cold` : ""}</span>
              </div>
              {model.steps.map((step) => (
                <div className="dynamic-schedule-row" key={step.id}>
                  <span className="schedule-dot" />
                  <span>
                    <strong>{step.label}</strong>
                    <small>{step.detail}</small>
                  </span>
                  <span>
                    <strong>{formatScheduleTime(step.start)}</strong>
                    {step.end ? <small>to {sameCalendarDay(step.start, step.end) ? formatShortTime(step.end) : formatScheduleTime(step.end)}</small> : null}
                  </span>
                </div>
              ))}
            </section>

            <section className="science-curves">
              <div className="section-title-line">
                <div><span className="eyebrow-label">Fermentation model</span><h2>Activity curves</h2></div>
                <Beaker size={22} />
              </div>
              <div className="curve-grid">
                {usesStarter && model.starterPeak ? <div className="science-curve-card">
                  <span>Levain rise</span>
                  <strong>Peak ~{model.starterPeak.hours.toFixed(1)}h</strong>
                  <svg viewBox="0 0 300 100" role="img" aria-label={`Levain rise estimated to peak in ${model.starterPeak.hours.toFixed(1)} hours`}>
                    <path className="chart-fill levain-fill" d={levainCurve.fill} />
                    <path className="chart-line" d={levainCurve.line} />
                  </svg>
                  <div className="chart-labels"><span>Feed</span><span>{(model.starterPeak.hours / 2).toFixed(1)}h</span><span>{model.starterPeak.hours.toFixed(1)}h</span></div>
                </div> : null}
                <div className="science-curve-card">
                  <span>{timelineSettings.primaryLabel} progress</span>
                  <strong>{timelineSettings.includeShape ? "Shape" : "Check"} ~{model.dough.bulkHours.toFixed(1)}h</strong>
                  <svg viewBox="0 0 300 100" role="img" aria-label={`${timelineSettings.primaryLabel} estimated at ${model.dough.bulkHours.toFixed(1)} hours`}>
                    <path className="chart-fill dough-fill" d={doughCurve.fill} />
                    <path className="chart-line" d={doughCurve.line} />
                  </svg>
                  <div className="chart-labels"><span>Mix</span><span>{timelineSettings.includeStretchFolds ? "Folds" : "Watch rise"}</span><span>{timelineSettings.includeShape ? "Shape" : "Ready"}</span></div>
                </div>
              </div>
              <div className="factor-grid">
                <span><Thermometer size={14} /><b>{model.dough.temperatureRate.toFixed(2)}×</b> temperature</span>
                <span><b>{model.dough.hydrationRate.toFixed(2)}×</b> {recipe.hydration}% hydration</span>
                <span><b>{model.dough.flourRate.toFixed(2)}×</b> flour activity</span>
                <span><b>{model.dough.structureRate.toFixed(2)}×</b> gas retention</span>
                <span><b>{model.dough.waterDemandRate.toFixed(2)}×</b> flour water demand</span>
                <span><b>{model.dough.inoculationRate.toFixed(2)}×</b> {model.dough.inoculation}% {model.dough.inoculationKind}</span>
              </div>
              <p className="model-note">
                Planning estimate, not a guarantee. Fermentation speed and visible rise are different: low-gluten flour may ferment quickly while holding less gas. Watch dough rise and strength{usesStarter ? "; your feed logs gradually calibrate the levain curve" : ""}.
              </p>
            </section>

            <section className="formula-panel compact-formula">
              <div className="formula-title-row">
                <div><strong>{recipe.name}</strong><span>· {loaves} loaves</span></div>
                <span>{recipe.hydration}% hydration</span>
              </div>
              <p className="flour-summary">{recipeFlourBlend(recipe).map((item) => `${item.percent}% ${item.type}`).join(" · ")}</p>
            </section>

            <button className="primary-button" type="button" onClick={savePlan}>
              {editingPlanId ? "Save schedule changes" : "Save to bake calendar"}
            </button>
            {editingPlanId ? confirmPlanDelete ? (
              <div className="delete-confirmation">
                <span>Delete this planned bake?</span>
                <div>
                  <button type="button" className="text-button" onClick={() => setConfirmPlanDelete(false)}>Keep it</button>
                  <button type="button" className="danger-button" onClick={() => {
                    onDeleteBakePlan(editingPlanId);
                    setEditingPlanId(null);
                    setConfirmPlanDelete(false);
                    setView("calendar");
                  }}>Delete bake</button>
                </div>
              </div>
            ) : (
              <button className="delete-order-button" type="button" onClick={() => setConfirmPlanDelete(true)}>
                <Trash2 size={15} /> Delete planned bake
              </button>
            ) : null}
          </>
        ) : (
          <div className="planner-empty-stack">
            {!recipes.length ? <EmptyState title="Add a recipe first" body="The planner needs recipe timing, hydration, and flour settings." /> : null}
            {usesStarter && !starters.length ? <EmptyState title="Add a starter first" body="Create a starter profile so feed timing and flour blend can be included." /> : null}
            <button
              className="primary-button"
              type="button"
              onClick={() => (usesStarter && !starters.length ? onOpenProductionArea?.("starters") : setView("plan"))}
            >
              {usesStarter && !starters.length ? "Open starter setup" : "Set up baking data"}
            </button>
          </div>
        )
      ) : null}

      {view === "calendar" ? (
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
          onSelectDate={resetForDate}
          onOpenPlan={loadPlan}
        />
      ) : null}

      {view === "starter" ? (
        <StarterLab
          starters={starters}
          starterLogs={starterLogs}
          onSaveStarter={onSaveStarter}
          onDeleteStarter={onDeleteStarter}
          onStarterLogged={onStarterLogged}
          onDeleteStarterLog={onDeleteStarterLog}
        />
      ) : null}

      {view === "plan" && model?.dough.activityRate > 1.65 ? (
        <div className="warning-callout compact-warning"><AlertTriangle size={18} /> Fast fermentation estimate—check the dough earlier than usual.</div>
      ) : null}
            </div>
          </section>
        </div>

        <aside className="bake-side-panel" aria-label="Bake desk summary">
          <section className="bake-side-card bake-side-card-dark">
            <span><CalendarDays size={20} /></span>
            <div>
              <small>Production calendar</small>
              <strong>{bakePlans.length} planned · {acceptedOrderBakes.length} accepted</strong>
              <p>Calendar, starters, and inventory now live in Production.</p>
            </div>
            <button type="button" onClick={() => onOpenProductionArea?.("calendar")}>Open Production</button>
          </section>

          <section className="bake-side-card">
            <div className="section-title-line compact">
              <h3>Kitchen now</h3>
              <button type="button" onClick={() => setView("kitchen")}>Open</button>
            </div>
            {activeKitchenList.length ? activeKitchenList.slice(0, 3).map((bake) => (
              <button className="bake-side-row" key={bake.id} type="button" onClick={() => {
                onSelectKitchenBake?.(bake.id);
                setView("kitchen");
              }}>
                <span>{bake.name || bake.recipeName || "Active bake"}</span>
                <small>{bake.loaves || 1} item{Number(bake.loaves || 1) === 1 ? "" : "s"}</small>
              </button>
            )) : <p className="bake-side-empty">No active bakes yet. Add one from Kitchen when dough hits the bench.</p>}
          </section>

          <section className="bake-side-card">
            <div className="section-title-line compact">
              <h3>Up next</h3>
              <button type="button" onClick={() => setView("plan")}>Plan</button>
            </div>
            {upcomingPlans.length ? upcomingPlans.map((plan) => (
              <button className="bake-side-row" key={plan.id} type="button" onClick={() => loadPlan(plan)}>
                <span>{plan.recipeName || "Planned bake"}</span>
                <small>{plan.anchorDateTime ? formatScheduleTime(new Date(plan.anchorDateTime)) : plan.date}</small>
              </button>
            )) : <p className="bake-side-empty">No saved bake plans. Build one from Plan or accept orders into Batches.</p>}
          </section>
        </aside>
      </section>
    </main>
  );
}
