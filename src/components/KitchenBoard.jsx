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
import { normalizeTimelineSettings, recipeUsesStarter } from "../lib/recipeTimeline";

// kitchen-collapse-v1
function defaultForm(recipes, starters) {
  const recipe = recipes[0];
  const starter = recipeUsesStarter(recipe) ? starters[0] : null;
  const timeline = normalizeTimelineSettings(recipe);
  return {
    name: "",
    recipeId: recipe?.id || "",
    loaves: recipe?.yield || 1,
    starterId: starter?.id || "",
    ratio: "1:2:2",
    doughTemperature: 76,
    coldProofHours: timeline.defaultColdProofHours,
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

function recipeProductType(recipe = {}) {
  return String(recipe.productType || "bread").replace(/_/g, " ");
}

function formulaModeFor(recipe = {}) {
  return recipe.formulaMode || "bakers";
}

function gramsLabel(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return "—";
  return `${Math.round(number).toLocaleString()} g`;
}

function percentLabel(recipe, ingredient) {
  const percent = Number(ingredient.percent || 0);
  if (!Number.isFinite(percent)) return "—";
  return `${percent.toFixed(percent % 1 ? 1 : 0)}%`;
}

function customInstructionSteps(recipe = {}) {
  const raw = recipe.instructions || recipe.method || recipe.productionInstructions || recipe.productionNotes;
  if (Array.isArray(raw)) {
    return raw
      .map((item, index) => {
        if (typeof item === "string") return [`Step ${index + 1}`, item];
        return [item.title || item.label || `Step ${index + 1}`, item.note || item.body || item.detail || ""];
      })
      .filter(([, note]) => String(note || "").trim());
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw
      .split(/\n+/)
      .map((line, index) => {
        const [title, ...rest] = line.split(":");
        return rest.length
          ? [title.trim() || `Step ${index + 1}`, rest.join(":").trim()]
          : [`Step ${index + 1}`, line.trim()];
      })
      .filter(([, note]) => note);
  }
  return [];
}

function kitchenMethodSteps(recipe = {}, timeline = {}) {
  const custom = customInstructionSteps(recipe);
  if (custom.length) return custom;

  const type = recipe.productType || "bread";
  if (type === "yeast") {
    return [
      ["Mix", "Mix until hydrated, then knead or fold until the dough is smooth and elastic."],
      [timeline.primaryLabel || "Rise", `Rise until puffy and expanded, about ${Number(timeline.primaryRiseHours || 1.5).toFixed(1)} hours in the current recipe model.`],
      ["Shape", timeline.includeShape ? "Degas gently, shape, and place into the final pan or banneton." : "Shape is optional for this recipe setting."],
      ["Final proof", timeline.includeFinalProof ? `Proof until the dough springs back slowly, about ${Number(timeline.finalProofHours || 0.75).toFixed(1)} hours.` : "Final proof is skipped by this recipe setting."],
      ["Bake and cool", "Bake when properly proofed; cool fully before slicing, bagging, or selling."],
    ];
  }
  if (type === "hot_sauce") {
    return [
      ["Prep", "Wash, trim, weigh, and record peppers, salt, vinegar, and aromatics."],
      ["Ferment or cook", "Follow your chosen safety process and log pH/salt before customer sale."],
      ["Blend", "Blend to desired texture, adjust acidity/salt, and strain if needed."],
      ["Bottle", "Bottle cleanly, label the batch date, storage notes, and warning notes."],
    ];
  }
  if (type === "vinegar") {
    return [
      ["Start", "Combine base and culture in a clean vessel with breathable cover."],
      ["Ferment", "Ferment away from direct sun and track acidity, aroma, and batch date."],
      ["Taste and test", "Check acidity before bottling; keep notes for traceability."],
      ["Bottle", "Strain, bottle, date, and add storage instructions."],
    ];
  }
  if (type === "infused_oil") {
    return [
      ["Prep", "Use dry aromatics when possible and avoid water-heavy inclusions."],
      ["Infuse", "Steep gently, strain fully, and keep process notes."],
      ["Safety log", "Record storage instructions and warning notes before sale."],
      ["Bottle", "Bottle, date, label, and refrigerate if required by your process."],
    ];
  }
  if (type === "cake") {
    return [
      ["Prep", "Scale ingredients, prepare pans, and bring butter or eggs to the right temperature."],
      ["Mix", "Mix according to cake style; avoid overmixing once flour is added."],
      ["Bake", "Bake until the center is set and a tester comes out clean."],
      ["Cool", "Cool fully before frosting, packing, or slicing."],
    ];
  }
  return [
    ["Feed", timeline.includeStarterFeed ? "Feed starter or levain early enough to peak near mix time." : "Starter feed is skipped by this recipe setting."],
    ["Mix", "Mix flour and most water first if you use an autolyse, then add remaining ingredients."],
    ["Develop", timeline.includeStretchFolds ? `${timeline.stretchFoldCount || 0} stretch/fold sets about ${timeline.foldIntervalMinutes || 30} minutes apart.` : "Stretch and folds are skipped by this recipe setting."],
    [timeline.primaryLabel || "Bulk ferment", `Use dough strength and rise as the final call. Model target is about ${Number(timeline.primaryRiseHours || 0).toFixed(1)} hours.`],
    ["Shape / proof / bake", `${timeline.includeShape ? "Shape when ready. " : ""}${timeline.includeColdProof ? `Cold proof about ${Number(timeline.defaultColdProofHours || 0).toFixed(1)} hours. ` : ""}Bake and cool before bagging.`],
  ];
}

function KitchenRecipePanel({ compact = false, loaves, recipe, timeline }) {
  if (!recipe) {
    return (
      <aside className="kitchen-recipe-panel">
        <strong>No recipe selected</strong>
        <p>Choose a saved recipe to see its formula and kitchen instructions here.</p>
      </aside>
    );
  }

  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const steps = kitchenMethodSteps(recipe, timeline);
  const visibleIngredients = compact ? ingredients.slice(0, 5) : ingredients;
  const hiddenCount = Math.max(0, ingredients.length - visibleIngredients.length);

  return (
    <aside className={compact ? "kitchen-recipe-panel compact" : "kitchen-recipe-panel"}>
      <div className="kitchen-recipe-heading">
        <span>
          <small>Recipe + instructions</small>
          <strong>{recipe.name || "Untitled recipe"}</strong>
          {recipe.note ? <em>{recipe.note}</em> : null}
        </span>
        <b>{loaves || recipe.yield || 1} {pluralUnit(recipeUnit(recipe), loaves || recipe.yield || 1)}</b>
      </div>

      <div className="kitchen-recipe-stats">
        <span><small>Type</small><strong>{recipeProductType(recipe)}</strong></span>
        <span><small>Formula</small><strong>{formulaModeFor(recipe) === "batch" ? "Batch %" : "Baker’s %"}</strong></span>
        <span><small>Hydration</small><strong>{Number(recipe.hydration || 0) ? `${Number(recipe.hydration).toFixed(0)}%` : "—"}</strong></span>
        <span><small>Primary</small><strong>{timeline.primaryLabel || "Rise"}</strong></span>
      </div>

      {visibleIngredients.length ? (
        <div className="kitchen-recipe-formula">
          <div><span>Ingredient</span><span>Weight</span><span>{formulaModeFor(recipe) === "batch" ? "Batch %" : "Baker’s %"}</span></div>
          {visibleIngredients.map((ingredient, index) => (
            <div key={`${ingredient.name}-${index}`}>
              <span>{ingredient.name || "Ingredient"}</span>
              <span>{gramsLabel(ingredient.weight)}</span>
              <span>{percentLabel(recipe, ingredient)}</span>
            </div>
          ))}
          {hiddenCount ? <p>+ {hiddenCount} more ingredient{hiddenCount === 1 ? "" : "s"} in the saved recipe.</p> : null}
        </div>
      ) : (
        <p className="kitchen-recipe-empty">No saved ingredients yet. Add ingredients in Menu → Products / Recipes.</p>
      )}

      <ol className="kitchen-recipe-steps">
        {steps.map(([label, detail]) => (
          <li key={label}>
            <b>{label}</b>
            <span>{detail}</span>
          </li>
        ))}
      </ol>
    </aside>
  );
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
  const timeline = normalizeTimelineSettings(recipe);
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
          <span>{timeline.primaryLabel || "Rise"} · {progress.done}/{progress.total} done</span>
        </div>
      ) : <p className="kitchen-warning">This bake needs a recipe{recipeUsesStarter(recipe) ? ", starter," : ""} and valid time before the checklist can be built.</p>}

      <div className="kitchen-progress-track" aria-label={`${progress.percent}% kitchen checklist complete`}>
        <i style={{ width: `${progress.percent}%` }} />
      </div>

      <details className="kitchen-recipe-details" open={selectedKitchenBakeId === bake.id}>
        <summary>
          <span>Recipe and instructions</span>
          <ChevronDown size={16} />
        </summary>
        <KitchenRecipePanel compact recipe={recipe} timeline={timeline} loaves={bake.loaves} />
      </details>

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
  const timeline = normalizeTimelineSettings(recipe);
  const usesStarter = recipeUsesStarter(recipe);
  const starter = usesStarter ? (starters.find((item) => item.id === form.starterId) || starters[0]) : null;

  useEffect(() => {
    setForm((current) => {
      const nextRecipe = recipes.find((item) => item.id === current.recipeId) || recipes[0];
      const nextUsesStarter = recipeUsesStarter(nextRecipe);
      const nextStarter = nextUsesStarter ? (starters.find((item) => item.id === current.starterId) || starters[0]) : null;
      const nextTimeline = normalizeTimelineSettings(nextRecipe);
      return {
        ...current,
        recipeId: nextRecipe?.id || "",
        starterId: nextStarter?.id || "",
        loaves: current.loaves || nextRecipe?.yield || 1,
        coldProofHours: nextTimeline.includeColdProof ? (current.coldProofHours ?? nextTimeline.defaultColdProofHours) : 0,
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
    const fields = new FormData(event.currentTarget);
    const selectedRecipe = recipes.find((item) => item.id === fields.get("recipeId")) || recipe;
    const selectedUsesStarter = recipeUsesStarter(selectedRecipe);
    const selectedStarter = selectedUsesStarter ? (starters.find((item) => item.id === fields.get("starterId")) || starter) : null;
    const selectedTimeline = normalizeTimelineSettings(selectedRecipe);
    if (!selectedRecipe || (selectedUsesStarter && !selectedStarter)) return;
    const mixTime = String(fields.get("anchorDateTime") || form.anchorDateTime);
    const bakeName = String(fields.get("name") || "").trim();
    saveNewBake({
      name: bakeName || `${selectedRecipe.name} · ${formatKitchenTime(mixTime)}`,
      recipeId: selectedRecipe.id,
      recipeName: selectedRecipe.name,
      loaves: Number(fields.get("loaves") || form.loaves || 1),
      starterId: selectedStarter?.id || "",
      starterName: selectedStarter?.name || "",
      ratio: selectedUsesStarter ? String(fields.get("ratio") || form.ratio) : "",
      doughTemperature: Number(fields.get("doughTemperature") || form.doughTemperature || 76),
      coldProofHours: selectedTimeline.includeColdProof ? Number(fields.get("coldProofHours") || form.coldProofHours || 0) : 0,
      anchorMode: "start",
      anchorDateTime: mixTime,
    });
    setForm((current) => ({ ...current, name: "" }));
  }

  function addFromPlan(plan) {
    const planRecipe = recipes.find((item) => item.id === plan.recipeId);
    const planUsesStarter = recipeUsesStarter(planRecipe);
    const planTimeline = normalizeTimelineSettings(planRecipe);
    const planStarter = planUsesStarter ? (starters.find((item) => item.id === plan.starterId) || starters[0]) : null;
    saveNewBake({
      name: plan.name || `${plan.recipeName || planRecipe?.name || "Planned bake"} · ${formatKitchenTime(plan.anchorDateTime || plan.bakeEnd)}`,
      recipeId: plan.recipeId || planRecipe?.id,
      recipeName: plan.recipeName || planRecipe?.name,
      loaves: Number(plan.loaves || planRecipe?.yield || 1),
      starterId: planUsesStarter ? (plan.starterId || planStarter?.id) : "",
      starterName: planUsesStarter ? (plan.starterName || planStarter?.name) : "",
      ratio: planUsesStarter ? (plan.ratio || settings.ratio) : "",
      doughTemperature: Number(plan.doughTemperature || settings.doughTemperature),
      coldProofHours: planTimeline.includeColdProof ? Number(plan.coldProofHours ?? settings.coldProofHours) : 0,
      anchorMode: plan.anchorMode || "start",
      anchorDateTime: plan.anchorDateTime || localDateTimeValue(new Date(plan.bakeEnd || `${plan.date}T06:30`)),
      sourcePlanId: plan.id,
    });
  }

  function addFromBatch(batch) {
    const batchUsesStarter = recipeUsesStarter(batch.recipe);
    const batchTimeline = normalizeTimelineSettings(batch.recipe);
    const batchStarter = batchUsesStarter ? starters[0] : null;
    saveNewBake({
      name: `${batch.recipeName} · ${batch.pickupDate}`,
      recipeId: batch.recipe.id,
      recipeName: batch.recipe.name,
      loaves: Number(batch.loaves || 1),
      starterId: batchUsesStarter ? batchStarter?.id : "",
      starterName: batchUsesStarter ? batchStarter?.name : "",
      ratio: batchUsesStarter ? settings.ratio : "",
      doughTemperature: Number(settings.doughTemperature || 76),
      coldProofHours: batchTimeline.includeColdProof ? Number(settings.coldProofHours ?? 12) : 0,
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
          <label>Bake name<input name="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Saturday country loaf #1" /></label>
          <label>Recipe<select value={form.recipeId} onChange={(event) => {
            const nextRecipe = recipes.find((item) => item.id === event.target.value);
            const nextTimeline = normalizeTimelineSettings(nextRecipe);
            setForm({
              ...form,
              recipeId: event.target.value,
              loaves: nextRecipe?.yield || form.loaves,
              starterId: recipeUsesStarter(nextRecipe) ? (form.starterId || starters[0]?.id || "") : "",
              coldProofHours: nextTimeline.includeColdProof ? (form.coldProofHours || nextTimeline.defaultColdProofHours) : 0,
            });
          }} name="recipeId">{recipes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          {usesStarter ? (
            <label>Starter<select name="starterId" value={form.starterId} onChange={(event) => setForm({ ...form, starterId: event.target.value })}>{starters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          ) : (
            <div className="kitchen-static-field"><span>Starter</span><strong>Not used for this recipe</strong></div>
          )}
          <label>Mix time<input name="anchorDateTime" type="datetime-local" value={form.anchorDateTime} onChange={(event) => setForm({ ...form, anchorDateTime: event.target.value })} /></label>
          <label>Items<input name="loaves" type="number" min="1" max="60" value={form.loaves} onChange={(event) => setForm({ ...form, loaves: Number(event.target.value) })} /></label>
          <label>Dough °F<input name="doughTemperature" type="number" min="50" max="100" value={form.doughTemperature} onChange={(event) => setForm({ ...form, doughTemperature: Number(event.target.value) })} /></label>
          {timeline.includeColdProof ? (
            <label>Cold proof<input name="coldProofHours" type="number" min="0" max="48" step="0.5" value={form.coldProofHours} onChange={(event) => setForm({ ...form, coldProofHours: Number(event.target.value) })} /></label>
          ) : (
            <div className="kitchen-static-field"><span>Cold proof</span><strong>Skipped for this recipe</strong></div>
          )}
          {usesStarter ? (
            <label>Levain ratio<input name="ratio" value={form.ratio} onChange={(event) => setForm({ ...form, ratio: event.target.value })} /></label>
          ) : (
            <div className="kitchen-static-field"><span>Levain ratio</span><strong>Not needed</strong></div>
          )}
          <button className="primary-button" type="submit" disabled={!recipe || (usesStarter && !starter)}>Add to Kitchen</button>
        </form>

        <KitchenRecipePanel recipe={recipe} timeline={timeline} loaves={form.loaves} />

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
