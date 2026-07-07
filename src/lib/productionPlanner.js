import { buildBakeSchedule } from "./fermentationModel";
import { pickupDateKey } from "./orderCapacity";
import { isProductionOrder } from "./orderRecords";
import { normalizeTimelineSettings, recipeUsesStarter } from "./recipeTimeline";

export const DEFAULT_PRODUCTION_AUTOMATION = {
  enabled: true,
  groupBatches: true,
  autoSchedule: true,
  inventoryWarnings: true,
  autoCreatePlans: false,
  autoDeductInventory: false,
  includePackaging: true,
  coolingHours: 2,
  doughTemperature: 76,
  coldProofHours: 12,
  ratio: "1:2:2",
};

const SKIP_INVENTORY_NAMES = ["water", "starter", "levain"];

function normalizedName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function localDateTimeValue(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function localDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function findRecipe(name, recipes) {
  const target = normalizedName(name);
  if (!target) return null;
  return recipes.find((recipe) => normalizedName(recipe.name) === target)
    || recipes.find((recipe) => target.includes(normalizedName(recipe.name)))
    || recipes.find((recipe) => normalizedName(recipe.name).includes(target))
    || null;
}

function parsedProductLines(order, recipes) {
  if (Array.isArray(order.items) && order.items.length) {
    return order.items.map((item) => ({
      name: item.product_name || item.name,
      quantity: Math.max(0.5, Number(item.quantity || 1) * Number(item.units_per_pack || 1)),
      packages: Math.max(1, Number(item.quantity || 1)),
    }));
  }

  const matchingRecipes = recipes.filter((recipe) => (
    normalizedName(order.product).includes(normalizedName(recipe.name))
  ));
  if (matchingRecipes.length === 1) {
    return [{ name: matchingRecipes[0].name, quantity: Math.max(1, Number(order.totalUnits || order.quantity || 1)), packages: Math.max(1, Number(order.packageCount || 1)) }];
  }
  if (matchingRecipes.length > 1) {
    return matchingRecipes.map((recipe) => {
      const escaped = recipe.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const quantityMatch = String(order.product).match(new RegExp(`${escaped}\\s*[×x]\\s*(\\d+)`, "i"));
      return { name: recipe.name, quantity: Number(quantityMatch?.[1] || 1), packages: Number(quantityMatch?.[1] || 1) };
    });
  }
  return [{ name: order.product, quantity: Math.max(1, Number(order.totalUnits || order.quantity || 1)), packages: Math.max(1, Number(order.packageCount || 1)) }];
}

export function orderProductionLines(order, recipes) {
  return parsedProductLines(order, recipes).map((line, index) => ({
    ...line,
    id: `${order.id}-${index}`,
    orderId: order.id,
    customer: order.customer,
    pickupAt: order.pickupAt,
    pickupDate: pickupDateKey(order.pickupAt),
    recipe: findRecipe(line.name, recipes),
  }));
}

function createSchedule(batch, starter, starterLogs, settings) {
  if (!settings.autoSchedule || !batch.recipe || !batch.pickupAt) return null;
  const timeline = normalizeTimelineSettings(batch.recipe);
  if (recipeUsesStarter(batch.recipe) && !starter) return null;
  const pickup = new Date(batch.pickupAt);
  if (Number.isNaN(pickup.getTime())) return null;
  const bakeFinish = new Date(pickup.getTime() - Number(settings.coolingHours || 0) * 3600000);
  return buildBakeSchedule({
    recipe: batch.recipe,
    loaves: batch.loaves,
    doughTemperature: Number(settings.doughTemperature || 76),
    coldProofHours: timeline.includeColdProof ? Number(settings.coldProofHours || timeline.defaultColdProofHours) : 0,
    anchorMode: "finish",
    anchorDateTime: localDateTimeValue(bakeFinish),
    starter,
    ratio: settings.ratio || "1:2:2",
    starterLogs,
  });
}

function buildBatches(orders, recipes, starter, starterLogs, settings) {
  const lines = orders
    .filter((order) => order.pickupAt && isProductionOrder(order))
    .flatMap((order) => orderProductionLines(order, recipes))
    .sort((a, b) => new Date(a.pickupAt) - new Date(b.pickupAt));
  const groups = new Map();

  lines.forEach((line) => {
    const key = settings.groupBatches && line.recipe
      ? `${line.pickupDate}-${line.recipe.id}`
      : line.id;
    const current = groups.get(key) || {
      key,
      pickupDate: line.pickupDate,
      pickupAt: line.pickupAt,
      recipe: line.recipe,
      recipeName: line.recipe?.name || line.name,
      loaves: 0,
      packages: 0,
      customers: [],
      orderIds: [],
      unmatched: !line.recipe,
    };
    current.loaves += line.quantity;
    current.packages += Number(line.packages || 1);
    current.customers.push(`${line.customer} (${line.quantity})`);
    current.orderIds.push(line.orderId);
    if (new Date(line.pickupAt) < new Date(current.pickupAt)) current.pickupAt = line.pickupAt;
    groups.set(key, current);
  });

  return [...groups.values()].map((batch) => ({
    ...batch,
    schedule: createSchedule(batch, starter, starterLogs, settings),
  }));
}

function inventoryUnitsForGrams(grams, unit) {
  const normalized = normalizedName(unit);
  if (["kg", "kilogram", "kilograms"].includes(normalized)) return grams / 1000;
  if (["g", "gram", "grams"].includes(normalized)) return grams;
  if (["lb", "pound", "pounds"].includes(normalized)) return grams / 453.592;
  if (["oz", "ounce", "ounces"].includes(normalized)) return grams / 28.3495;
  return null;
}

function findInventoryItem(name, inventory) {
  const target = normalizedName(name);
  return inventory.find((item) => normalizedName(item.name) === target)
    || inventory.find((item) => target.includes(normalizedName(item.name)))
    || inventory.find((item) => normalizedName(item.name).includes(target))
    || null;
}

export function ingredientRequirements(batches) {
  const requirements = new Map();
  batches.forEach((batch) => {
    if (!batch.recipe) return;
    const factor = batch.loaves / Math.max(1, Number(batch.recipe.yield || 1));
    batch.recipe.ingredients.forEach((ingredient) => {
      const key = normalizedName(ingredient.name);
      const current = requirements.get(key) || { name: ingredient.name, grams: 0 };
      current.grams += Number(ingredient.weight || 0) * factor;
      requirements.set(key, current);
    });
  });
  return [...requirements.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function inventoryStatus(requirements, inventory, totalLoaves, includePackaging = true) {
  const rows = requirements.map((requirement) => {
    const item = findInventoryItem(requirement.name, inventory);
    const skipped = SKIP_INVENTORY_NAMES.some((name) => normalizedName(requirement.name).includes(name));
    if (!item) {
      return { ...requirement, matched: false, skipped, shortage: !skipped };
    }
    const needed = inventoryUnitsForGrams(requirement.grams, item.unit);
    if (needed === null) return { ...requirement, item, matched: false, skipped, shortage: !skipped };
    const available = Number(item.amount || 0);
    return {
      ...requirement,
      item,
      matched: true,
      needed,
      available,
      shortage: available < needed,
    };
  });

  if (includePackaging) {
    const bags = findInventoryItem("Paper bags", inventory);
    rows.push({
      name: "Paper bags",
      matched: Boolean(bags),
      item: bags,
      needed: totalLoaves,
      available: Number(bags?.amount || 0),
      shortage: !bags || Number(bags.amount || 0) < totalLoaves,
      packaging: true,
    });
  }
  return rows;
}

export function buildProductionPlanner({
  orders,
  recipes,
  inventory,
  starters,
  starterLogs,
  settings,
}) {
  const resolvedSettings = { ...DEFAULT_PRODUCTION_AUTOMATION, ...settings };
  const starter = starters[0] || null;
  const batches = buildBatches(orders, recipes, starter, starterLogs, resolvedSettings);
  const requirements = ingredientRequirements(batches);
  const totalLoaves = batches.reduce((sum, batch) => sum + batch.loaves, 0);
  const totalPackages = batches.reduce((sum, batch) => sum + batch.packages, 0);
  const stock = inventoryStatus(requirements, inventory, totalPackages, resolvedSettings.includePackaging);
  const calendarPlans = batches.flatMap((batch) => {
    if (!batch.schedule || !batch.recipe) return [];
    const usesStarter = recipeUsesStarter(batch.recipe);
    if (usesStarter && !starter) return [];
    const timeline = normalizeTimelineSettings(batch.recipe);
    return [{
      id: `production-${batch.key}`,
      date: localDateKey(batch.schedule.bakeEnd),
      recipeId: batch.recipe.id,
      recipeName: batch.recipe.name,
      loaves: batch.loaves,
      starterId: usesStarter ? starter.id : "",
      starterName: usesStarter ? starter.name : "",
      ratio: usesStarter ? resolvedSettings.ratio : "",
      doughTemperature: resolvedSettings.doughTemperature,
      coldProofHours: timeline.includeColdProof ? resolvedSettings.coldProofHours : 0,
      anchorMode: "finish",
      anchorDateTime: localDateTimeValue(batch.schedule.bakeEnd),
      bulkHours: Number(batch.schedule.dough.bulkHours.toFixed(2)),
      bakeEnd: batch.schedule.bakeEnd.toISOString(),
      generatedByProduction: true,
      sourceOrderIds: [...new Set(batch.orderIds)],
      isNew: false,
    }];
  });
  return {
    batches,
    requirements,
    stock,
    calendarPlans,
    totalLoaves,
    totalPackages,
    shortages: stock.filter((row) => row.shortage),
    unmatched: batches.filter((batch) => batch.unmatched),
  };
}

export function deductInventoryForOrder(order, recipes, inventory, settings) {
  const lines = orderProductionLines(order, recipes).filter((line) => line.recipe);
  const usage = new Map();
  lines.forEach((line) => {
    const factor = line.quantity / Math.max(1, Number(line.recipe.yield || 1));
    line.recipe.ingredients.forEach((ingredient) => {
      if (SKIP_INVENTORY_NAMES.some((name) => normalizedName(ingredient.name).includes(name))) return;
      const key = normalizedName(ingredient.name);
      const current = usage.get(key) || { name: ingredient.name, grams: 0 };
      current.grams += Number(ingredient.weight || 0) * factor;
      usage.set(key, current);
    });
  });

  const deductions = [];
  const shortages = [];
  const nextInventory = inventory.map((item) => {
    const requirement = [...usage.values()].find((entry) => {
      const target = normalizedName(entry.name);
      const current = normalizedName(item.name);
      return target === current || target.includes(current) || current.includes(target);
    });
    if (!requirement) return item;
    const needed = inventoryUnitsForGrams(requirement.grams, item.unit);
    if (needed === null) return item;
    const before = Number(item.amount || 0);
    const after = Math.max(0, before - needed);
    deductions.push({ itemId: item.id, name: item.name, amount: needed, unit: item.unit });
    if (before < needed) shortages.push(item.name);
    return { ...item, amount: Number(after.toFixed(3)) };
  });

  if (settings.includePackaging) {
    const bagIndex = nextInventory.findIndex((item) => normalizedName(item.name).includes("paper bag"));
    if (bagIndex >= 0) {
      const bags = nextInventory[bagIndex];
      const needed = Array.isArray(order.items) && order.items.length
        ? order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
        : Math.max(1, Number(order.packageCount || order.quantity || 1));
      const before = Number(bags.amount || 0);
      nextInventory[bagIndex] = { ...bags, amount: Math.max(0, before - needed) };
      deductions.push({ itemId: bags.id, name: bags.name, amount: needed, unit: bags.unit });
      if (before < needed) shortages.push(bags.name);
    }
  }

  return { inventory: nextInventory, deductions, shortages, matchedRecipes: lines.length };
}
