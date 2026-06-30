import { getFlourProfile, weightedFlourMetric } from "../data/flourProfiles";

// recipe-timeline-controls-v1
// yeast-rise-science-v1

const PRODUCT_TIMELINE_DEFAULTS = {
  bread: {
    useStarter: true,
    includeStarterFeed: true,
    useBulkFermentRules: true,
    primaryLabel: "Bulk ferment",
    primaryRiseHours: 4.75,
    includeStretchFolds: true,
    stretchFoldCount: 4,
    firstFoldMinutes: 30,
    foldIntervalMinutes: 30,
    includeShape: true,
    shapeMinutes: 30,
    includeFinalProof: false,
    finalProofHours: 0,
    includeColdProof: true,
    defaultColdProofHours: 12,
    includePreheat: true,
    preheatMinutes: 45,
    coolHours: 2,
  },
  yeast: {
    autoYeastTiming: true,
    useStarter: false,
    includeStarterFeed: false,
    useBulkFermentRules: false,
    primaryLabel: "Rise",
    primaryRiseHours: 1.5,
    includeStretchFolds: false,
    stretchFoldCount: 0,
    firstFoldMinutes: 0,
    foldIntervalMinutes: 0,
    includeShape: true,
    shapeMinutes: 15,
    includeFinalProof: true,
    finalProofHours: 0.75,
    includeColdProof: false,
    defaultColdProofHours: 0,
    includePreheat: true,
    preheatMinutes: 45,
    coolHours: 2,
  },
  bagel: {
    useStarter: true,
    includeStarterFeed: true,
    useBulkFermentRules: true,
    primaryLabel: "Bulk ferment",
    primaryRiseHours: 4,
    includeStretchFolds: false,
    stretchFoldCount: 0,
    firstFoldMinutes: 0,
    foldIntervalMinutes: 0,
    includeShape: true,
    shapeMinutes: 45,
    includeFinalProof: true,
    finalProofHours: 0.5,
    includeColdProof: true,
    defaultColdProofHours: 12,
    includePreheat: true,
    preheatMinutes: 45,
    coolHours: 1,
  },
};

const NON_BREAD_TIMELINE_DEFAULTS = {
  autoYeastTiming: false,
  useStarter: false,
  includeStarterFeed: false,
  useBulkFermentRules: false,
  primaryLabel: "Prep",
  primaryRiseHours: 1,
  includeStretchFolds: false,
  stretchFoldCount: 0,
  firstFoldMinutes: 0,
  foldIntervalMinutes: 0,
  includeShape: false,
  shapeMinutes: 0,
  includeFinalProof: false,
  finalProofHours: 0,
  includeColdProof: false,
  defaultColdProofHours: 0,
  includePreheat: false,
  preheatMinutes: 0,
  coolHours: 1,
};

const BREADLIKE_TYPES = new Set(["bread", "yeast", "bagel", "bun", "pastry"]);
const SOURDOUGHLIKE_TYPES = new Set(["bread", "bagel", "bun", "pastry"]);

function numberOr(value, fallback, minimum = 0, maximum = Number.POSITIVE_INFINITY) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, number));
}

function boolOr(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

function fahrenheitToCelsius(value) {
  return (Number(value) - 32) * 5 / 9;
}

function ingredientName(ingredient = {}) {
  return String(ingredient.name || "").toLowerCase();
}

function categoryPercent(recipe = {}, category) {
  return (recipe.ingredients || []).reduce((sum, ingredient) => (
    ingredient.category === category ? sum + Number(ingredient.percent || 0) : sum
  ), 0);
}

function percentByMatch(recipe = {}, matcher) {
  return (recipe.ingredients || []).reduce((sum, ingredient) => (
    matcher(ingredient) ? sum + Number(ingredient.percent || 0) : sum
  ), 0);
}

function flourBlendForTimeline(recipe = {}) {
  const flours = (recipe.ingredients || []).filter((ingredient) => ingredient.category === "flour");
  const total = flours.reduce((sum, ingredient) => sum + Number(ingredient.percent || 0), 0) || 100;
  return flours.length
    ? flours.map((ingredient) => ({
      type: getFlourProfile(ingredient.flourType || ingredient.name).name,
      percent: Number(ingredient.percent || 0) / total * 100,
    }))
    : [{ type: "Bread flour", percent: 100 }];
}

function roundedQuarterHour(hours) {
  return Number((Math.round(Number(hours || 0) * 4) / 4).toFixed(2));
}

function timingReason(label, value, tone = "neutral") {
  return { label, value, tone };
}

export function suggestYeastTimeline(recipe = {}, options = {}) {
  const doughTemperature = Number(options.doughTemperature || 76);
  const hydration = Number(recipe.hydration || categoryPercent(recipe, "liquid") || 63);
  const yeastPercent = percentByMatch(recipe, (ingredient) => (
    ingredient.category === "yeast" || ingredientName(ingredient).includes("yeast")
  )) || 1.2;
  const sugarPercent = categoryPercent(recipe, "sweetener");
  const fatPercent = categoryPercent(recipe, "fat");
  const saltPercent = categoryPercent(recipe, "salt") || percentByMatch(recipe, (ingredient) => ingredientName(ingredient).includes("salt"));
  const dairyEggPercent = percentByMatch(recipe, (ingredient) => {
    const name = ingredientName(ingredient);
    return name.includes("milk")
      || name.includes("cream")
      || name.includes("egg")
      || name.includes("butter")
      || name.includes("yolk");
  });
  const blend = flourBlendForTimeline(recipe);
  const flourActivityRate = clamp(weightedFlourMetric(blend, "activity"), 0.9, 1.18);
  const temperatureRate = clamp(
    Math.pow(1.9, (fahrenheitToCelsius(doughTemperature) - 24) / 10),
    0.45,
    2.25,
  );
  const yeastRate = clamp(Math.pow(yeastPercent / 1.2, 0.42), 0.48, 2.1);
  const hydrationRate = clamp(1 + (hydration - 63) * 0.007, 0.82, 1.14);
  const sugarDrag = clamp(1 + Math.max(0, sugarPercent - 5) * 0.035, 1, 1.8);
  const fatDrag = clamp(1 + fatPercent * 0.018, 1, 1.75);
  const dairyEggDrag = clamp(1 + dairyEggPercent * 0.006, 1, 1.45);
  const saltDrag = clamp(1 + Math.max(0, saltPercent - 2) * 0.12, 1, 1.45);
  const enrichmentDrag = sugarDrag * fatDrag * dairyEggDrag * saltDrag;
  const rate = clamp((temperatureRate * yeastRate * hydrationRate * flourActivityRate) / enrichmentDrag, 0.34, 2.55);
  const firstRiseHours = roundedQuarterHour(clamp(1.5 / rate, 0.5, 5.5));
  const proofShare = clamp(0.45 + Math.max(0, sugarPercent - 8) * 0.008 + fatPercent * 0.006, 0.42, 0.72);
  const finalProofHours = roundedQuarterHour(clamp(firstRiseHours * proofShare, 0.35, 2.75));
  const enriched = sugarPercent >= 8 || fatPercent >= 8 || dairyEggPercent >= 25;

  return {
    firstRiseHours,
    finalProofHours,
    enriched,
    doughTemperature,
    rate: Number(rate.toFixed(2)),
    factors: {
      yeastPercent: Number(yeastPercent.toFixed(2)),
      hydration: Number(hydration.toFixed(1)),
      sugarPercent: Number(sugarPercent.toFixed(1)),
      fatPercent: Number(fatPercent.toFixed(1)),
      saltPercent: Number(saltPercent.toFixed(1)),
      dairyEggPercent: Number(dairyEggPercent.toFixed(1)),
      flourActivityRate: Number(flourActivityRate.toFixed(2)),
      temperatureRate: Number(temperatureRate.toFixed(2)),
      yeastRate: Number(yeastRate.toFixed(2)),
      hydrationRate: Number(hydrationRate.toFixed(2)),
      enrichmentDrag: Number(enrichmentDrag.toFixed(2)),
    },
    reasons: [
      timingReason("Yeast", `${Number(yeastPercent.toFixed(2))}%`, yeastPercent >= 1.8 ? "faster" : yeastPercent < 0.8 ? "slower" : "neutral"),
      timingReason("Hydration", `${Number(hydration.toFixed(1))}%`, hydration >= 72 ? "faster" : hydration < 58 ? "slower" : "neutral"),
      timingReason("Sugar", `${Number(sugarPercent.toFixed(1))}%`, sugarPercent >= 12 ? "slower" : "neutral"),
      timingReason("Fat", `${Number(fatPercent.toFixed(1))}%`, fatPercent >= 8 ? "slower" : "neutral"),
      timingReason("Dairy/eggs", `${Number(dairyEggPercent.toFixed(1))}%`, dairyEggPercent >= 25 ? "slower" : "neutral"),
      timingReason("Flour activity", `${Number(flourActivityRate.toFixed(2))}×`, flourActivityRate > 1.05 ? "faster" : flourActivityRate < 0.96 ? "slower" : "neutral"),
    ],
    summary: enriched
      ? "Enriched dough: sugar, fat, dairy, or eggs slow fermentation, so the app gives it a longer rise and final proof."
      : "Lean yeast dough: timing is driven mostly by yeast amount, dough temperature, hydration, and flour activity.",
  };
}

export function applyYeastTimingSuggestion(recipe = {}, options = {}) {
  if ((recipe.productType || "bread") !== "yeast") return recipe;
  const currentSettings = normalizeTimelineSettings(recipe);
  if (!options.force && currentSettings.autoYeastTiming === false) return {
    ...recipe,
    timelineSettings: currentSettings,
  };
  const suggestion = suggestYeastTimeline(recipe, options);
  return {
    ...recipe,
    timelineSettings: normalizeTimelineSettings({
      ...recipe,
      timelineSettings: {
        ...currentSettings,
        autoYeastTiming: true,
        useStarter: false,
        includeStarterFeed: false,
        useBulkFermentRules: false,
        primaryLabel: "Rise",
        primaryRiseHours: suggestion.firstRiseHours,
        includeStretchFolds: false,
        stretchFoldCount: 0,
        firstFoldMinutes: 0,
        foldIntervalMinutes: 0,
        includeFinalProof: true,
        finalProofHours: suggestion.finalProofHours,
        includeColdProof: false,
        defaultColdProofHours: 0,
      },
    }),
  };
}

export function defaultTimelineSettingsForProductType(productType = "bread") {
  if (PRODUCT_TIMELINE_DEFAULTS[productType]) {
    return { ...PRODUCT_TIMELINE_DEFAULTS[productType] };
  }
  if (SOURDOUGHLIKE_TYPES.has(productType)) {
    return { ...PRODUCT_TIMELINE_DEFAULTS.bread };
  }
  if (BREADLIKE_TYPES.has(productType)) {
    return { ...PRODUCT_TIMELINE_DEFAULTS.yeast };
  }
  return { ...NON_BREAD_TIMELINE_DEFAULTS };
}

export function normalizeTimelineSettings(recipe = {}) {
  const productType = recipe.productType || "bread";
  const defaults = defaultTimelineSettingsForProductType(productType);
  const raw = recipe.timelineSettings || {};
  const forceNoStarter = productType === "yeast";
  const useStarter = forceNoStarter ? false : boolOr(raw.useStarter, defaults.useStarter);
  const includeStarterFeed = useStarter && boolOr(raw.includeStarterFeed, defaults.includeStarterFeed);
  const includeStretchFolds = boolOr(raw.includeStretchFolds, defaults.includeStretchFolds);
  const includeShape = boolOr(raw.includeShape, defaults.includeShape);
  const includeFinalProof = boolOr(raw.includeFinalProof, defaults.includeFinalProof);
  const includeColdProof = boolOr(raw.includeColdProof, defaults.includeColdProof);
  const includePreheat = boolOr(raw.includePreheat, defaults.includePreheat);
  const autoYeastTiming = productType === "yeast"
    ? boolOr(raw.autoYeastTiming, defaults.autoYeastTiming ?? true)
    : boolOr(raw.autoYeastTiming, defaults.autoYeastTiming ?? false);
  const yeastSuggestion = productType === "yeast" && autoYeastTiming ? suggestYeastTimeline(recipe) : null;

  return {
    autoYeastTiming,
    useStarter,
    includeStarterFeed,
    useBulkFermentRules: useStarter && boolOr(raw.useBulkFermentRules, defaults.useBulkFermentRules),
    primaryLabel: String(raw.primaryLabel || defaults.primaryLabel || "Rise").trim() || "Rise",
    primaryRiseHours: numberOr(yeastSuggestion?.firstRiseHours ?? raw.primaryRiseHours, defaults.primaryRiseHours, 0.25, 24),
    includeStretchFolds,
    stretchFoldCount: includeStretchFolds ? Math.round(numberOr(raw.stretchFoldCount, defaults.stretchFoldCount, 0, 12)) : 0,
    firstFoldMinutes: includeStretchFolds ? numberOr(raw.firstFoldMinutes, defaults.firstFoldMinutes, 0, 360) : 0,
    foldIntervalMinutes: includeStretchFolds ? numberOr(raw.foldIntervalMinutes, defaults.foldIntervalMinutes, 5, 360) : 0,
    includeShape,
    shapeMinutes: includeShape ? numberOr(raw.shapeMinutes, defaults.shapeMinutes, 0, 240) : 0,
    includeFinalProof,
    finalProofHours: includeFinalProof ? numberOr(yeastSuggestion?.finalProofHours ?? raw.finalProofHours, defaults.finalProofHours, 0, 24) : 0,
    includeColdProof,
    defaultColdProofHours: includeColdProof ? numberOr(raw.defaultColdProofHours, defaults.defaultColdProofHours, 0, 72) : 0,
    includePreheat,
    preheatMinutes: includePreheat ? numberOr(raw.preheatMinutes, defaults.preheatMinutes, 0, 180) : 0,
    coolHours: numberOr(raw.coolHours, defaults.coolHours, 0, 24),
  };
}

export function recipeUsesStarter(recipe = {}) {
  return normalizeTimelineSettings(recipe).useStarter;
}

export function recipeAllowsStarterIngredient(recipe = {}) {
  return recipe.productType !== "yeast" && recipeUsesStarter(recipe);
}
