const SCALE_LABELS = {
  1: "Original recipe",
  2: "Double recipe",
  3: "Triple recipe",
  4: "Quadruple recipe",
};

const UNICODE_FRACTION_VALUES = {
  "¼": 0.25,
  "½": 0.5,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

const SCALABLE_INSTRUCTION_UNITS = "cups?|tablespoons?|tbsp\\.?|teaspoons?|tsp\\.?|ounces?|oz\\.?|pounds?|lbs?\\.?|kilograms?|kgs?|kg|grams?|g|millilit(?:ers?|res?)|ml|lit(?:ers?|res?)|l|cloves?|cans?|jars?|bottles?|packages?|pkgs?\\.?|packs?|containers?|sticks?|slices?|pieces?|pinch(?:es)?|bunch(?:es)?|heads?|dozen|doz\\.?|each|eggs?";
const INSTRUCTION_QUANTITY = new RegExp(`(\\b\\d+\\s+\\d+\\/\\d+|\\b\\d+\\/\\d+|\\b\\d+(?:\\.\\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])(\\s*)(${SCALABLE_INSTRUCTION_UNITS})(?=\\b|\\s|[,.])`, "gi");

const UNIT_WORDS = {
  cup: ["cup", "cups"], tablespoon: ["tablespoon", "tablespoons"], teaspoon: ["teaspoon", "teaspoons"],
  ounce: ["ounce", "ounces"], pound: ["pound", "pounds"], kilogram: ["kilogram", "kilograms"],
  gram: ["gram", "grams"], milliliter: ["milliliter", "milliliters"], millilitre: ["millilitre", "millilitres"],
  liter: ["liter", "liters"], litre: ["litre", "litres"], clove: ["clove", "cloves"], can: ["can", "cans"],
  jar: ["jar", "jars"], bottle: ["bottle", "bottles"], package: ["package", "packages"], pack: ["pack", "packs"],
  container: ["container", "containers"], stick: ["stick", "sticks"], slice: ["slice", "slices"], piece: ["piece", "pieces"],
  pinch: ["pinch", "pinches"], bunch: ["bunch", "bunches"], head: ["head", "heads"], egg: ["egg", "eggs"],
};

function grammaticalUnit(unit, amount) {
  const normalized = String(unit || "").toLowerCase().replace(/\.$/, "");
  const word = Object.values(UNIT_WORDS).find(([singular, plural]) => normalized === singular || normalized === plural);
  return word ? word[amount === 1 ? 0 : 1] : unit;
}

export function normalizeRecipeScale(value) {
  const scale = Math.round(Number(value) || 1);
  return Math.min(4, Math.max(1, scale));
}

export function recipeScaleLabel(value, { compact = false } = {}) {
  const scale = normalizeRecipeScale(value);
  if (compact) return scale === 1 ? "Original" : scale === 2 ? "Doubled" : scale === 3 ? "Tripled" : "Quadrupled";
  return SCALE_LABELS[scale];
}

export function formatScaledAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount === 0) return amount === 0 ? "0" : "";
  if (Number.isInteger(amount)) return String(amount);
  return amount.toFixed(amount < 10 ? 2 : 1).replace(/0+$/, "").replace(/\.$/, "");
}

function parseWrittenAmount(value) {
  const text = String(value || "").trim();
  if (UNICODE_FRACTION_VALUES[text]) return UNICODE_FRACTION_VALUES[text];
  if (text.includes(" ")) return text.split(/\s+/).reduce((sum, part) => sum + parseWrittenAmount(part), 0);
  if (text.includes("/")) {
    const [numerator, denominator] = text.split("/").map(Number);
    return denominator ? numerator / denominator : 0;
  }
  return Number(text) || 0;
}

export function scaleInstructionText(step, value) {
  const scale = normalizeRecipeScale(value);
  const cleaned = String(step || "").replace(/\s+/g, " ").trim();
  if (!cleaned || scale === 1) return cleaned;
  return cleaned.replace(INSTRUCTION_QUANTITY, (_match, amountText, spacing, unit) => {
    const amount = parseWrittenAmount(amountText) * scale;
    return `${formatScaledAmount(amount)}${spacing || " "}${grammaticalUnit(unit, amount)}`;
  });
}

export function scaledRecipeIngredients(ingredients = [], value = 1) {
  const scale = normalizeRecipeScale(value);
  return ingredients.map((ingredient) => ({
    ...ingredient,
    amount: Number(ingredient.amount ?? ingredient.weight ?? 0) * scale,
    ...(ingredient.weight !== undefined ? { weight: Number(ingredient.weight || 0) * scale } : {}),
  }));
}

export function scaledRecipeSteps(steps = [], value = 1) {
  const scale = normalizeRecipeScale(value);
  return steps.map((step) => scaleInstructionText(step, scale));
}

export const RECIPE_SCALE_OPTIONS = [1, 2, 3, 4];
