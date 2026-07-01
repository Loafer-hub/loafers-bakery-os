import { normalizedSalesOptions } from "./salesOptions";

const PRODUCT_LABOR_DEFAULTS = {
  bread: 75,
  yeast: 55,
  bagel: 110,
  bun: 75,
  cake: 90,
  pastry: 120,
  hot_sauce: 50,
  vinegar: 35,
  infused_oil: 35,
  other: 45,
};

const PACKAGING_HINTS = [
  { match: ["bottle", "sauce", "vinegar", "oil"], names: ["bottle", "label"] },
  { match: ["jar"], names: ["jar", "label"] },
  { match: ["cake"], names: ["box", "label"] },
  { match: ["bagel", "bun", "roll", "pastry"], names: ["bag", "box", "label"] },
  { match: ["loaf", "bread"], names: ["bag", "label"] },
];

export function normalizeCostName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function inventoryUnitsForGrams(grams, unit) {
  const normalized = normalizeCostName(unit);
  if (["kg", "kilogram", "kilograms"].includes(normalized)) return grams / 1000;
  if (["g", "gram", "grams"].includes(normalized)) return grams;
  if (["lb", "pound", "pounds"].includes(normalized)) return grams / 453.592;
  if (["oz", "ounce", "ounces"].includes(normalized)) return grams / 28.3495;
  return null;
}

export function findInventoryItem(name, inventory = []) {
  const target = normalizeCostName(name);
  if (!target) return null;
  return inventory.find((item) => normalizeCostName(item.name) === target)
    || inventory.find((item) => target.includes(normalizeCostName(item.name)))
    || inventory.find((item) => normalizeCostName(item.name).includes(target))
    || null;
}

export function ingredientCostForWeight(ingredient, grams, inventory = []) {
  const item = findInventoryItem(ingredient.name, inventory);
  if (!item || !Number(item.unitCost)) return 0;
  const units = inventoryUnitsForGrams(Number(grams || 0), item.unit);
  if (units === null) return 0;
  return units * Number(item.unitCost || 0);
}

function packagingNamesFor(recipe = {}, option = {}) {
  const words = normalizeCostName([
    recipe.productType,
    recipe.unitName,
    recipe.name,
    option.label,
  ].join(" "));
  const matched = PACKAGING_HINTS.find((hint) => hint.match.some((word) => words.includes(word)));
  return matched?.names || ["bag", "label"];
}

function packagingCostForOption(recipe, option, inventory) {
  const override = Number(recipe?.economics?.packageCost ?? recipe?.packageCost ?? 0);
  if (override > 0) return override;
  return packagingNamesFor(recipe, option).reduce((sum, name) => {
    const item = inventory.find((entry) => normalizeCostName(entry.name).includes(name));
    return sum + Number(item?.unitCost || 0);
  }, 0);
}

export function defaultLaborMinutesForRecipe(recipe = {}) {
  return PRODUCT_LABOR_DEFAULTS[recipe.productType] || PRODUCT_LABOR_DEFAULTS.other;
}

export function recipeEconomicsInput(recipe = {}) {
  const economics = recipe.economics || {};
  return {
    laborMinutes: Math.max(0, Number(economics.laborMinutes ?? recipe.laborMinutes ?? defaultLaborMinutesForRecipe(recipe))),
    laborRate: Math.max(0, Number(economics.laborRate ?? recipe.laborRate ?? 20)),
    overheadPercent: Math.max(0, Number(economics.overheadPercent ?? recipe.overheadPercent ?? 10)),
    packageCost: Math.max(0, Number(economics.packageCost ?? recipe.packageCost ?? 0)),
  };
}

export function estimateRecipeEconomics(recipe = {}, inventory = []) {
  const yieldCount = Math.max(1, Number(recipe.yield || 1));
  const baseIngredientCost = (recipe.ingredients || []).reduce((sum, ingredient) => (
    sum + ingredientCostForWeight(ingredient, Number(ingredient.weight || 0), inventory)
  ), 0);
  const economics = recipeEconomicsInput(recipe);
  const laborCost = economics.laborMinutes / 60 * economics.laborRate;
  const overheadCost = (baseIngredientCost + laborCost) * (economics.overheadPercent / 100);
  const baseCost = baseIngredientCost + laborCost + overheadCost;
  const costPerUnit = baseCost / yieldCount;
  const salesOptions = normalizedSalesOptions(recipe);
  const optionRows = salesOptions.map((option) => {
    const packageCost = packagingCostForOption(recipe, option, inventory);
    const units = Math.max(0.5, Number(option.units || 1));
    const totalCost = costPerUnit * units + packageCost;
    const price = Number(option.price || 0);
    const profit = price - totalCost;
    const margin = price > 0 ? profit / price * 100 : 0;
    const capacityUnits = Math.max(0.25, Number(option.capacityUnits || 1));
    return {
      ...option,
      capacityUnits,
      cost: totalCost,
      ingredientCost: baseIngredientCost / yieldCount * units,
      laborCost: laborCost / yieldCount * units,
      overheadCost: overheadCost / yieldCount * units,
      packageCost,
      profit,
      margin,
      profitPerBakeSlot: profit / capacityUnits,
      suggestedPrice35: totalCost / 0.65,
      suggestedPrice50: totalCost / 0.5,
    };
  });
  const lowestPriceOption = optionRows.reduce((lowest, option) => (
    !lowest || option.price < lowest.price ? option : lowest
  ), null);
  const bestProfitOption = optionRows.reduce((best, option) => (
    !best || option.profitPerBakeSlot > best.profitPerBakeSlot ? option : best
  ), null);
  return {
    economics,
    baseIngredientCost,
    laborCost,
    overheadCost,
    baseCost,
    costPerUnit,
    optionRows,
    lowestPriceOption,
    bestProfitOption,
    underpriced: optionRows.some((option) => option.margin < 35),
  };
}
