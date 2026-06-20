const NUTRITION_PER_100G = {
  breadFlour: { calories: 364, carbs: 76.3, protein: 10.3, fat: 1, fiber: 2.7, sodium: 2 },
  wholeWheat: { calories: 340, carbs: 72, protein: 13.2, fat: 2.5, fiber: 10.7, sodium: 5 },
  rye: { calories: 335, carbs: 75.9, protein: 10.3, fat: 1.6, fiber: 15.1, sodium: 2 },
  spelt: { calories: 338, carbs: 70.2, protein: 14.6, fat: 2.4, fiber: 10.7, sodium: 8 },
  einkorn: { calories: 333, carbs: 67, protein: 14, fat: 2.5, fiber: 9, sodium: 5 },
  oat: { calories: 389, carbs: 66.3, protein: 16.9, fat: 6.9, fiber: 10.6, sodium: 2 },
  rice: { calories: 366, carbs: 80.1, protein: 6, fat: 1.4, fiber: 2.4, sodium: 0 },
  buckwheat: { calories: 335, carbs: 70.6, protein: 12.6, fat: 3.1, fiber: 10, sodium: 11 },
  corn: { calories: 361, carbs: 76.9, protein: 6.9, fat: 3.9, fiber: 7.3, sodium: 5 },
  cheddar: { calories: 403, carbs: 1.3, protein: 24.9, fat: 33.1, fiber: 0, sodium: 621 },
  seeds: { calories: 570, carbs: 20, protein: 20, fat: 48, fiber: 11, sodium: 10 },
  milk: { calories: 61, carbs: 4.8, protein: 3.2, fat: 3.3, fiber: 0, sodium: 43 },
  oil: { calories: 884, carbs: 0, protein: 0, fat: 100, fiber: 0, sodium: 0 },
  sugar: { calories: 387, carbs: 100, protein: 0, fat: 0, fiber: 0, sodium: 1 },
  jalapeno: { calories: 29, carbs: 6.5, protein: 0.9, fat: 0.4, fiber: 2.8, sodium: 3 },
  salt: { calories: 0, carbs: 0, protein: 0, fat: 0, fiber: 0, sodium: 39300 },
  generic: { calories: 300, carbs: 55, protein: 8, fat: 6, fiber: 4, sodium: 80 },
  zero: { calories: 0, carbs: 0, protein: 0, fat: 0, fiber: 0, sodium: 0 },
};

function profileForIngredient(ingredient) {
  const name = String(ingredient.name || "").toLowerCase();
  if (name.includes("water")) return NUTRITION_PER_100G.zero;
  if (name.includes("salt")) return NUTRITION_PER_100G.salt;
  if (name.includes("starter") || name.includes("levain")) return NUTRITION_PER_100G.breadFlour;
  if (name.includes("whole wheat") || name.includes("wholemeal")) return NUTRITION_PER_100G.wholeWheat;
  if (name.includes("rye")) return NUTRITION_PER_100G.rye;
  if (name.includes("spelt")) return NUTRITION_PER_100G.spelt;
  if (name.includes("einkorn")) return NUTRITION_PER_100G.einkorn;
  if (name.includes("oat")) return NUTRITION_PER_100G.oat;
  if (name.includes("rice")) return NUTRITION_PER_100G.rice;
  if (name.includes("buckwheat")) return NUTRITION_PER_100G.buckwheat;
  if (name.includes("corn")) return NUTRITION_PER_100G.corn;
  if (name.includes("cheddar") || name.includes("cheese")) return NUTRITION_PER_100G.cheddar;
  if (name.includes("seed") || name.includes("sesame") || name.includes("flax") || name.includes("sunflower")) return NUTRITION_PER_100G.seeds;
  if (name.includes("milk")) return NUTRITION_PER_100G.milk;
  if (name.includes("oil") || name.includes("butter")) return NUTRITION_PER_100G.oil;
  if (name.includes("sugar") || name.includes("honey") || name.includes("maple")) return NUTRITION_PER_100G.sugar;
  if (name.includes("jalape")) return NUTRITION_PER_100G.jalapeno;
  if (name.includes("flour")) return NUTRITION_PER_100G.breadFlour;
  return NUTRITION_PER_100G.generic;
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function estimateRecipeNutrition(recipe, slicesPerLoaf = 12) {
  const ingredients = Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
  const yieldCount = Math.max(1, Number(recipe?.yield || 1));
  const totals = { calories: 0, carbs: 0, protein: 0, fat: 0, fiber: 0, sodium: 0 };

  ingredients.forEach((ingredient) => {
    const profile = profileForIngredient(ingredient);
    const declaredWeight = Math.max(0, Number(ingredient.weight || 0));
    const nutritionalWeight = /starter|levain/i.test(ingredient.name || "")
      ? declaredWeight / 2
      : declaredWeight;
    Object.keys(totals).forEach((key) => {
      totals[key] += profile[key] * nutritionalWeight / 100;
    });
  });

  const perLoaf = Object.fromEntries(Object.entries(totals).map(([key, value]) => [
    key,
    round(value / yieldCount, key === "calories" || key === "sodium" ? 0 : 1),
  ]));
  const perSlice = Object.fromEntries(Object.entries(perLoaf).map(([key, value]) => [
    key,
    round(value / slicesPerLoaf, key === "calories" || key === "sodium" ? 0 : 1),
  ]));

  return {
    perLoaf,
    perSlice,
    slicesPerLoaf,
  };
}
