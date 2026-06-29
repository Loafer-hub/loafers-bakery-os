import { buildBakeSchedule } from "./fermentationModel";

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
  if (!recipe || !starter || !bake.anchorDateTime) return null;
  return buildBakeSchedule({
    recipe,
    loaves: Number(bake.loaves || recipe.yield || 1),
    doughTemperature: Number(bake.doughTemperature || 76),
    coldProofHours: Number(bake.coldProofHours ?? 12),
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
  const folds = stepById(model, "folds");
  const shape = stepById(model, "shape");
  const cold = stepById(model, "cold");
  const preheat = stepById(model, "preheat");
  const bakeStep = stepById(model, "bake");
  const foldOffsets = [0.5, 1, 1.5, 2].filter((offset) => {
    if (!shape?.start) return true;
    return addHours(mix, offset).getTime() < new Date(shape.start).getTime() - 8 * 60 * 1000;
  });
  const chosenFoldOffsets = foldOffsets.length ? foldOffsets : [0.5];
  const coolStart = bakeStep?.end ? new Date(bakeStep.end) : addHours(model.bakeEnd, -0.5);
  const readyTime = addHours(coolStart, Number(bake.coolHours || 2));

  return [
    { id: "feed", label: "Feed starter", time: stepById(model, "feed")?.start, detail: bake.ratio || stepById(model, "feed")?.detail || "Build levain" },
    { id: "mix", label: "Mix dough", time: mix, detail: `${bake.doughTemperature || 76}°F target dough` },
    ...chosenFoldOffsets.map((offset, index) => ({
      id: `stretch-fold-${index + 1}`,
      label: `Stretch & fold ${index + 1}`,
      time: addHours(mix, offset),
      detail: index === 0 ? "Start gentle gluten development" : "Build strength without tearing",
    })),
    { id: "bulk-check", label: "Bulk check", time: folds?.end || addHours(mix, model.dough.bulkHours * 0.65), detail: "Look for rise, bubbles, doming, and strength" },
    { id: "shape", label: "Shape", time: shape?.start, detail: shape?.detail || "Shape when the dough says yes" },
    { id: "cold-proof", label: "Cold proof / final rest", time: cold?.start, detail: cold?.detail || `${bake.coldProofHours ?? 12}h planned` },
    { id: "preheat", label: "Preheat oven", time: preheat?.start, detail: "Give the stone/Dutch oven real heat" },
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
