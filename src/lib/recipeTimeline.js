// recipe-timeline-controls-v1

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

  return {
    useStarter,
    includeStarterFeed,
    useBulkFermentRules: useStarter && boolOr(raw.useBulkFermentRules, defaults.useBulkFermentRules),
    primaryLabel: String(raw.primaryLabel || defaults.primaryLabel || "Rise").trim() || "Rise",
    primaryRiseHours: numberOr(raw.primaryRiseHours, defaults.primaryRiseHours, 0.25, 24),
    includeStretchFolds,
    stretchFoldCount: includeStretchFolds ? Math.round(numberOr(raw.stretchFoldCount, defaults.stretchFoldCount, 0, 12)) : 0,
    firstFoldMinutes: includeStretchFolds ? numberOr(raw.firstFoldMinutes, defaults.firstFoldMinutes, 0, 360) : 0,
    foldIntervalMinutes: includeStretchFolds ? numberOr(raw.foldIntervalMinutes, defaults.foldIntervalMinutes, 5, 360) : 0,
    includeShape,
    shapeMinutes: includeShape ? numberOr(raw.shapeMinutes, defaults.shapeMinutes, 0, 240) : 0,
    includeFinalProof,
    finalProofHours: includeFinalProof ? numberOr(raw.finalProofHours, defaults.finalProofHours, 0, 24) : 0,
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
