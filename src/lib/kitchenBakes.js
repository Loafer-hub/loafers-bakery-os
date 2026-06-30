import { buildBakeSchedule } from "./fermentationModel";
import { normalizeTimelineSettings, recipeUsesStarter } from "./recipeTimeline";

const ACTIVE_STATUSES = new Set(["active", "mixing", "proofing", "baking", undefined, null, ""]);

export function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export function localDateTimeValue(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function formatKitchenTime(value) {
  if (!value) return "Set by feel";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Set by feel";
  return date.toLocaleString("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function activeKitchenBakes(kitchenBakes = []) {
  return kitchenBakes
    .filter((bake) => ACTIVE_STATUSES.has(bake.status) && !bake.completedAt)
    .sort((a, b) => new Date(a.anchorDateTime || a.createdAt || 0) - new Date(b.anchorDateTime || b.createdAt || 0));
}

export function buildKitchenBakeSchedule(bake, recipes, starters, starterLogs) {
  if (!bake) return null;
  const recipe = recipes.find((item) => item.id === bake.recipeId)
    || recipes.find((item) => item.name === bake.recipeName)
    || recipes[0];
  const starter = starters.find((item) => item.id === bake.starterId)
    || starters.find((item) => item.name === bake.starterName)
    || starters[0];
  if (!recipe || !bake.anchorDateTime) return null;
  if (recipeUsesStarter(recipe) && !starter) return null;
  const timeline = normalizeTimelineSettings(recipe);
  return buildBakeSchedule({
    recipe,
    loaves: Number(bake.loaves || recipe.yield || 1),
    doughTemperature: Number(bake.doughTemperature || 76),
    coldProofHours: Number(bake.coldProofHours ?? timeline.defaultColdProofHours),
    anchorMode: bake.anchorMode || "start",
    anchorDateTime: bake.anchorDateTime,
    starter,
    ratio: bake.ratio || "1:2:2",
    starterLogs,
  });
}

function stepById(model, id) {
  return model?.steps?.find((step) => step.id === id);
}

export function buildKitchenChecklist(model, bake = {}) {
  if (!model) return [];
  const mix = stepById(model, "mix")?.start || model.mix;
  const timeline = model.timeline || {};
  const folds = stepById(model, "folds");
  const primary = stepById(model, "primary");
  const shape = stepById(model, "shape");
  const finalProof = stepById(model, "final-proof");
  const cold = stepById(model, "cold");
  const preheat = stepById(model, "preheat");
  const bakeStep = stepById(model, "bake");
  const coolStart = bakeStep?.end ? new Date(bakeStep.end) : addHours(model.bakeEnd, -0.5);
  const readyTime = addHours(coolStart, Number(bake.coolHours ?? timeline.coolHours ?? 2));
  const foldSteps = timeline.includeStretchFolds && timeline.stretchFoldCount > 0
    ? Array.from({ length: timeline.stretchFoldCount }, (_, index) => {
      const offset = (Number(timeline.firstFoldMinutes || 0) + index * Number(timeline.foldIntervalMinutes || 30)) / 60;
      const time = addHours(mix, offset);
      return {
        id: `stretch-fold-${index + 1}`,
        label: `Stretch & fold ${index + 1}`,
        time,
        detail: index === 0 ? "Start gentle gluten development" : "Build strength without tearing",
      };
    }).filter((step) => {
      const cutoff = shape?.start || primary?.start || timeline.primaryEnd;
      if (!cutoff) return true;
      return new Date(step.time).getTime() < new Date(cutoff).getTime() - 8 * 60 * 1000;
    })
    : [];

  return [
    ...(timeline.usesStarter && stepById(model, "feed") ? [
      { id: "feed", label: "Feed starter", time: stepById(model, "feed")?.start, detail: bake.ratio || stepById(model, "feed")?.detail || "Build levain" },
    ] : []),
    { id: "mix", label: "Mix dough", time: mix, detail: `${bake.doughTemperature || 76}°F target dough` },
    ...foldSteps,
    {
      id: "primary-check",
      label: `${timeline.primaryLabel || "Rise"} check`,
      time: primary?.start || folds?.end || shape?.start || timeline.primaryEnd || addHours(mix, model.dough.bulkHours * 0.65),
      detail: timeline.useBulkFermentRules ? "Look for rise, bubbles, doming, and strength" : "Look for puffy dough and a slow spring back",
    },
    ...(timeline.includeShape && shape ? [
      { id: "shape", label: "Shape", time: shape?.start, detail: shape?.detail || "Shape when the dough says yes" },
    ] : []),
    ...(timeline.includeFinalProof && finalProof ? [
      { id: "final-proof", label: "Final proof", time: finalProof?.start, detail: finalProof?.detail || `${timeline.finalProofHours}h planned` },
    ] : []),
    ...(timeline.includeColdProof && cold ? [
      { id: "cold-proof", label: "Cold proof / final rest", time: cold?.start, detail: cold?.detail || `${bake.coldProofHours ?? timeline.defaultColdProofHours ?? 12}h planned` },
    ] : []),
    ...(timeline.includePreheat && preheat ? [
      { id: "preheat", label: "Preheat oven", time: preheat?.start, detail: "Give the stone/Dutch oven real heat" },
    ] : []),
    { id: "bake", label: "Bake", time: bakeStep?.start, detail: bakeStep?.detail || "Load and bake" },
    { id: "cool", label: "Cool", time: coolStart, detail: "Crumb sets while steam escapes" },
    { id: "ready", label: "Ready / packed", time: readyTime, detail: "Ready for shelf, pickup, or slicing" },
  ];
}

export function kitchenBakeProgress(bake, steps) {
  const checks = bake?.checks || {};
  const total = steps.length || 0;
  const done = steps.filter((step) => Boolean(checks[step.id])).length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  return { done, total, percent };
}
