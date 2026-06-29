import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock3,
  Layers3,
  Plus,
  Trash2,
  Wheat,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "./Primitives";
import {
  activeKitchenBakes,
  buildKitchenBakeSchedule,
  buildKitchenChecklist,
  formatKitchenTime,
  kitchenBakeProgress,
  localDateTimeValue,
} from "../lib/kitchenBakes";
import {
  buildProductionPlanner,
  DEFAULT_PRODUCTION_AUTOMATION,
} from "../lib/productionPlanner";

// kitchen-collapse-v1
function defaultForm(recipes, starters) {
  const recipe = recipes[0];
  const starter = starters[0];
  return {
    name: "",
    recipeId: recipe?.id || "",
    loaves: recipe?.yield || 1,
    starterId: starter?.id || "",
    ratio: "1:2:2",
    doughTemperature: 76,
    coldProofHours: 12,
    anchorMode: "start",
    anchorDateTime: localDateTimeValue(new Date()),
  };
}

function recipeUnit(recipe) {
  return recipe?.unitName || "item";
}

function pluralUnit(unit, amount) {
  return Number(amount) === 1 ? unit : `${unit}s`;
}

function minutesBetween(first, second) {
  return Math.round((new Date(second).getTime() - new Date(first).getTime()) / 60000);
}

function gapLabel(minutes) {
  if (!Number.isFinite(minutes)) return "after previous batch";
  if (minutes < 15) return "overlaps the previous mix — consider combining or shifting";
  if (minutes < 60) return `${minutes} min after previous mix`;
  const hours = minutes / 60;
  return `${hours.toFixed(hours >= 2 ? 0 : 1)} hr after previous mix`;
}

function BakeNameInput({ bake, onSaveKitchenBake }) {
  return (
    <input
      aria-label={`${bake.name || bake.recipeName} bake name`}
      value={bake.name || ""}
      onChange={(event) => onSaveKitchenBake({
        ...bake,
        name: event.target.value,
        updatedAt: new Date().toISOString(),
      }, { silent: true })}
      placeholder={bake.recipeName || "Named bake"}
    />
  );
}

function KitchenDisclosure({ badge, children, className = "", eyebrow, icon, title }) {
  return (
    <details className={`kitchen-disclosure ${className}`}>
      <summary className="kitchen-disclosure-summary">
        <span>
          <span className="eyebrow-label dark">{eyebrow}</span>
          <h2>{title}</h2>
        </span>
        <span className="kitchen-disclosure-actions">
          {badge !== undefined ? <strong>{badge}</strong> : null}
          {icon}
          <ChevronDown className="kitchen-disclosure-chevron" size={17} />
        </span>
      </summary>
      <div className="kitchen-disclosure-body">{children}</div>
    </details>
  );
}

function KitchenBakeCard({
  bake,
  recipes,
  starters,
  starterLogs,
  selectedKitchenBakeId,
  onDeleteKitchenBake,
  onSaveKitchenBake,
  onSelectKitchenBake,
}) {
  const model = buildKitchenBakeSchedule(bake, recipes, starters, starterLogs);
  const steps = buildKitchenChecklist(model, bake);
  const progress = kitchenBakeProgress(bake, steps);
  const recipe = recipes.find((item) => item.id === bake.recipeId);
  const checkedIds = bake.checks || {};

  function toggleStep(stepId, checked) {
    onSaveKitchenBake({
      ...bake,
      checks: { ...checkedIds, [stepId]: checked },
      status: "active",
      updatedAt: new Date().toISOString(),
    }, { silent: true });
  }

  function completeBake() {
    const completedChecks = Object.fromEntries(steps.map((step) => [step.id, true]));
    onSaveKitchenBake({
      ...bake,
      checks: completedChecks,
      status: "completed",
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { message: "Kitchen bake completed" });
  }

  return (
    <article className={`kitchen-bake-card ${selectedKitchenBakeId === bake.id ? "selected" : ""}`}>
      <div className="kitchen-bake-header">
        <span className="kitchen-bake-icon"><Wheat size={20} /></span>
        <span>
          <small>{recipe?.name || bake.recipeName || "Kitchen bake"} · {bake.loaves} {pluralUnit(recipeUnit(recipe), bake.loaves)}</small>
          <BakeNameInput bake={bake} onSaveKitchenBake={onSaveKitchenBake} />
        </span>
        <strong>{progress.percent}%</strong>
      </div>

      {model ? (
        <div className="kitchen-bake-meta">
          <span><Clock3 size={14} /> Mix {formatKitchenTime(model.mix)}</span>
          <span>Bake {formatKitchenTime(model.steps.find((step) => step.id === "bake")?.start)}</span>
          <span>{progress.done}/{progress.total} done</span>
        </div>
      ) : <p className="kitchen-warning">This bake needs a recipe, starter, and valid time before the checklist can be built.</p>}

      <div className="kitchen-progress-track" aria-label={`${progress.percent}% kitchen checklist complete`}>
        <i style={{ width: `${progress.percent}%` }} />
      </div>

      <div className="kitchen-step-list">
        {steps.map((step) => (
          <label className={checkedIds[step.id] ? "kitchen-step-row done" : "kitchen-step-row"} key={step.id}>
            <input
              type="checkbox"
              checked={Boolean(checkedIds[step.id])}
              onChange={(event) => toggleStep(step.id, event.target.checked)}
            />
            <span>
              <strong>{step.label}</strong>
              <small>{formatKitchenTime(step.time)} · {step.detail}</small>
            </span>
          </label>
        ))}
      </div>

      <div className="kitchen-card-actions">
        <button type="button" className="secondary-button" onClick={() => onSelectKitchenBake(bake.id)}>
          Show on Today
        </button>
        <button type="button" className="secondary-button" onClick={completeBake}>
          <CheckCircle2 size={15} /> Complete
        </button>
        <button type="button" className="text-button danger-text" onClick={() => onDeleteKitchenBake(bake.id)}>
          <Trash2 size={15} /> Remove
        </button>
      </div>
    </article>
  );
}

export function KitchenBoard({
  bakePlans,
  inventory,
  kitchenBakes,
  orders,
  productionAutomation,
  recipes,
  selectedKitchenBakeId,
  starters,
  starterLogs,
  onDeleteKitchenBake,
  onSaveKitchenBake,
  onSelectKitchenBake,
}) {
  const [form, setForm] = useState(() => defaultForm(recipes, starters));
  const settings = useMemo(() => ({
    ...DEFAULT_PRODUCTION_AUTOMATION,
    ...productionAutomation,
    autoSchedule: true,
    groupBatches: true,
  }), [productionAutomation]);
  const activeBakes = useMemo(() => activeKitchenBakes(kitchenBakes), [kitchenBakes]);
  const planner = useMemo(() => buildProductionPlanner({
    orders,
    recipes,
    inventory,
    starters,
    starterLogs,
    settings,
  }), [inventory, orders, recipes, settings, starterLogs, starters]);
  const suggestedBatches = planner.batches
    .filter((batch) => batch.recipe && batch.schedule)
    .sort((a, b) => new Date(a.schedule.mix) - new Date(b.schedule.mix));
  const upcomingPlans = [...bakePlans]
    .filter((plan) => !activeBakes.some((bake) => bake.sourcePlanId === plan.id))
    .sort((a, b) => new Date(a.anchorDateTime || a.bakeEnd || a.date) - new Date(b.anchorDateTime || b.bakeEnd || b.date))
    .slice(0, 4);
  const recipe = recipes.find((item) => item.id === form.recipeId) || recipes[0];
  const starter = starters.find((item) => item.id === form.starterId) || starters[0];

  useEffect(() => {
    setForm((current) => {
      const nextRecipe = recipes.find((item) => item.id === current.recipeId) || recipes[0];
      const nextStarter = starters.find((item) => item.id === current.starterId) || starters[0];
      return {
        ...current,
        recipeId: nextRecipe?.id || "",
        starterId: nextStarter?.id || "",
        loaves: current.loaves || nextRecipe?.yield || 1,
      };
    });
  }, [recipes, starters]);

  function saveNewBake(payload) {
    const saved = {
      ...payload,
      id: payload.id || `kitchen-${Date.now()}`,
      name: payload.name?.trim() || payload.recipeName || "Kitchen bake",
      checks: payload.checks || {},
      status: "active",
      createdAt: payload.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSaveKitchenBake(saved, { message: "Bake added to Kitchen" });
    onSelectKitchenBake(saved.id);
  }

  function addManualBake(event) {
    event.preventDefault();
    if (!recipe || !starter) return;
    saveNewBake({
      name: form.name || `${recipe.name} · ${formatKitchenTime(form.anchorDateTime)}`,
      recipeId: recipe.id,
      recipeName: recipe.name,
      loaves: Number(form.loaves || 1),
      starterId: starter.id,
      starterName: starter.name,
      ratio: form.ratio,
      doughTemperature: Number(form.doughTemperature || 76),
      coldProofHours: Number(form.coldProofHours || 0),
      anchorMode: "start",
      anchorDateTime: form.anchorDateTime,
    });
    setForm((current) => ({ ...current, name: "" }));
  }

  function addFromPlan(plan) {
    const planRecipe = recipes.find((item) => item.id === plan.recipeId);
    const planStarter = starters.find((item) => item.id === plan.starterId) || starters[0];
    saveNewBake({
      name: plan.name || `${plan.recipeName || planRecipe?.name || "Planned bake"} · ${formatKitchenTime(plan.anchorDateTime || plan.bakeEnd)}`,
      recipeId: plan.recipeId || planRecipe?.id,
      recipeName: plan.recipeName || planRecipe?.name,
      loaves: Number(plan.loaves || planRecipe?.yield || 1),
      starterId: plan.starterId || planStarter?.id,
      starterName: plan.starterName || planStarter?.name,
      ratio: plan.ratio || settings.ratio,
      doughTemperature: Number(plan.doughTemperature || settings.doughTemperature),
      coldProofHours: Number(plan.coldProofHours ?? settings.coldProofHours),
      anchorMode: plan.anchorMode || "start",
      anchorDateTime: plan.anchorDateTime || localDateTimeValue(new Date(plan.bakeEnd || `${plan.date}T06:30`)),
      sourcePlanId: plan.id,
    });
  }

  function addFromBatch(batch) {
    const batchStarter = starters[0];
    saveNewBake({
      name: `${batch.recipeName} · ${batch.pickupDate}`,
      recipeId: batch.recipe.id,
      recipeName: batch.recipe.name,
      loaves: Number(batch.loaves || 1),
      starterId: batchStarter?.id,
      starterName: batchStarter?.name,
      ratio: settings.ratio,
      doughTemperature: Number(settings.doughTemperature || 76),
      coldProofHours: Number(settings.coldProofHours ?? 12),
      anchorMode: "finish",
      anchorDateTime: localDateTimeValue(batch.schedule.bakeEnd),
      sourceOrderIds: [...new Set(batch.orderIds)],
    });
  }

  return (
    <div className="kitchen-board">
      <section className="kitchen-hero">
        <span><ClipboardList size={23} /></span>
        <div>
          <small>Live bench list</small>
          <h2>Kitchen</h2>
          <p>Name each active bake, check off every stage, and choose what Today’s fermentation visual should watch.</p>
        </div>
        <strong>{activeBakes.length} active</strong>
      </section>

      <KitchenDisclosure
        className="kitchen-add-card"
        eyebrow="Start work"
        title="Add active bake"
        icon={<Plus size={18} />}
      >
        <form className="kitchen-add-form" onSubmit={addManualBake}>
          <label>Bake name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Saturday country loaf #1" /></label>
          <label>Recipe<select value={form.recipeId} onChange={(event) => {
            const nextRecipe = recipes.find((item) => item.id === event.target.value);
            setForm({ ...form, recipeId: event.target.value, loaves: nextRecipe?.yield || form.loaves });
          }}>{recipes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Starter<select value={form.starterId} onChange={(event) => setForm({ ...form, starterId: event.target.value })}>{starters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Mix time<input type="datetime-local" value={form.anchorDateTime} onChange={(event) => setForm({ ...form, anchorDateTime: event.target.value })} /></label>
          <label>Items<input type="number" min="1" max="60" value={form.loaves} onChange={(event) => setForm({ ...form, loaves: Number(event.target.value) })} /></label>
          <label>Dough °F<input type="number" min="50" max="100" value={form.doughTemperature} onChange={(event) => setForm({ ...form, doughTemperature: Number(event.target.value) })} /></label>
          <label>Cold proof<input type="number" min="0" max="48" step="0.5" value={form.coldProofHours} onChange={(event) => setForm({ ...form, coldProofHours: Number(event.target.value) })} /></label>
          <label>Levain ratio<input value={form.ratio} onChange={(event) => setForm({ ...form, ratio: event.target.value })} /></label>
          <button className="primary-button" type="submit" disabled={!recipe || !starter}>Add to Kitchen</button>
        </form>

        {upcomingPlans.length ? (
          <div className="kitchen-plan-starts">
            <strong>Quick start from planned bakes</strong>
            {upcomingPlans.map((plan) => (
              <button type="button" key={plan.id} onClick={() => addFromPlan(plan)}>
                <span>{plan.recipeName}</span>
                <small>{formatKitchenTime(plan.anchorDateTime || plan.bakeEnd)} · {plan.loaves} planned</small>
              </button>
            ))}
          </div>
        ) : null}
      </KitchenDisclosure>

      <KitchenDisclosure
        className="kitchen-suggestions"
        eyebrow="Optional suggestions"
        title="Batch and stagger"
        icon={<Layers3 size={18} />}
      >
        {suggestedBatches.length ? (
          <>
            <p className="kitchen-suggestion-note">These are grouped from open pickup-dated orders. Nothing starts unless you tap “Use in Kitchen.”</p>
            <div className="kitchen-suggestion-grid">
              {suggestedBatches.map((batch) => (
                <article className="kitchen-suggestion-card" key={batch.key}>
                  <span><strong>{batch.recipeName}</strong><small>{batch.customers.join(" · ")}</small></span>
                  <span>{batch.loaves} {pluralUnit(recipeUnit(batch.recipe), batch.loaves)}</span>
                  <small>Mix {formatKitchenTime(batch.schedule.mix)} · bake {formatKitchenTime(batch.schedule.steps.find((step) => step.id === "bake")?.start)}</small>
                  <button type="button" onClick={() => addFromBatch(batch)}>Use in Kitchen <ArrowRight size={14} /></button>
                </article>
              ))}
            </div>
            {suggestedBatches.length > 1 ? (
              <ol className="kitchen-stagger-list">
                {suggestedBatches.map((batch, index) => (
                  <li key={batch.key}>
                    <strong>{index + 1}. {batch.recipeName}</strong>
                    <small>{index === 0
                      ? `Start first at ${formatKitchenTime(batch.schedule.mix)}`
                      : gapLabel(minutesBetween(suggestedBatches[index - 1].schedule.mix, batch.schedule.mix))}</small>
                  </li>
                ))}
              </ol>
            ) : null}
          </>
        ) : (
          <p className="kitchen-suggestion-note">No batch suggestions yet. Add pickup-dated accepted orders or use planned bakes when you’re ready.</p>
        )}
      </KitchenDisclosure>

      <KitchenDisclosure
        badge={activeBakes.length}
        className="kitchen-active-section"
        eyebrow="In progress"
        title="Active bakes"
      >
        {activeBakes.length ? activeBakes.map((bake) => (
          <KitchenBakeCard
            bake={bake}
            key={bake.id}
            recipes={recipes}
            selectedKitchenBakeId={selectedKitchenBakeId}
            starters={starters}
            starterLogs={starterLogs}
            onDeleteKitchenBake={onDeleteKitchenBake}
            onSaveKitchenBake={onSaveKitchenBake}
            onSelectKitchenBake={onSelectKitchenBake}
          />
        )) : <EmptyState title="No bakes in progress" body="Add a named bake or accept a suggested batch when dough hits the bench." />}
      </KitchenDisclosure>
    </div>
  );
}
