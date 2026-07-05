import { getFlourProfile } from "../data/flourProfiles";
import { defaultLaborMinutesForRecipe } from "./productCosting";
import { productTypeFor, productTypeSettingsFor } from "./productTypes";
import {
  applyYeastTimingSuggestion,
  defaultTimelineSettingsForProductType,
} from "./recipeTimeline";

const HEADING_RE = /^(ingredients?|formula|for the dough|dough|levain|starter|preferment|brine|sauce|instructions?|directions?|method|steps?|preparation|procedure|notes?)\s*:?\s*$/i;
const INGREDIENT_HEADING_RE = /^(ingredients?|formula|for the dough|dough|levain|starter|preferment|brine|sauce)\s*:?\s*$/i;
const METHOD_HEADING_RE = /^(instructions?|directions?|method|steps?|preparation|procedure)\s*:?\s*$/i;

const FRACTIONS = {
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

const NUMBER_WORDS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  twelve: 12,
};

const UNIT_ALIASES = {
  g: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  l: "l",
  liter: "l",
  liters: "l",
  cup: "cup",
  cups: "cup",
  tbsp: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tsp: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  egg: "egg",
  eggs: "egg",
  clove: "clove",
  cloves: "clove",
  pinch: "pinch",
  pinches: "pinch",
  dash: "dash",
  dashes: "dash",
};

const PRODUCT_TYPE_MATCHERS = [
  ["hot_sauce", /\b(hot\s*sauce|chile\s*sauce|chili\s*sauce|peppers?.*(brine|ferment|vinegar)|lacto.?fermented.*peppers?)\b/i],
  ["vinegar", /\b(vinegar\s*mother|mother\s*of\s*vinegar|apple\s*cider\s*vinegar|wine\s*vinegar|fermented\s*vinegar|shrubs?)\b/i],
  ["infused_oil", /\b(infused\s*oil|olive\s*oil.*infus|garlic\s*oil|chile\s*oil|herb\s*oil)\b/i],
  ["bagel", /\bbagels?\b/i],
  ["bun", /\b(buns?|dinner\s*rolls?|burger\s*buns?|sandwich\s*rolls?|rolls?)\b/i],
  ["cake", /\b(cakes?|frosting|buttercream|batter|cupcakes?)\b/i],
  ["pastry", /\b(croissants?|danish|pastr(y|ies)|laminated|puff\s*pastry)\b/i],
  ["yeast", /\b(instant\s*yeast|active\s*dry\s*yeast|commercial\s*yeast|rapid\s*rise|sandwich\s*bread|milk\s*bread|pan\s*bread)\b/i],
  ["bread", /\b(sourdough|starter|levain|boule|batard|bread|loaf|loaves|autolyse|bulk\s*ferment)\b/i],
];

const FALLBACK_TEMPLATES = {
  bread: [
    ["Bread flour", "flour", 600],
    ["Water", "liquid", 450],
    ["Starter", "starter", 120],
    ["Salt", "salt", 12],
  ],
  yeast: [
    ["Bread flour", "flour", 600],
    ["Water or milk", "liquid", 378],
    ["Instant yeast", "yeast", 7],
    ["Sugar", "sweetener", 30],
    ["Butter or oil", "fat", 30],
    ["Salt", "salt", 12],
  ],
  bagel: [
    ["Bread flour", "flour", 600],
    ["Water", "liquid", 348],
    ["Starter", "starter", 108],
    ["Malt syrup", "sweetener", 18],
    ["Salt", "salt", 12],
  ],
  bun: [
    ["Bread flour", "flour", 600],
    ["Milk", "liquid", 372],
    ["Butter", "fat", 72],
    ["Sugar", "sweetener", 48],
    ["Starter", "starter", 90],
    ["Salt", "salt", 12],
  ],
  cake: [
    ["All-purpose flour", "flour", 250],
    ["Sugar", "sweetener", 215],
    ["Butter", "fat", 140],
    ["Eggs", "liquid", 100],
    ["Milk", "liquid", 115],
    ["Salt", "salt", 4],
  ],
  pastry: [
    ["Bread flour", "flour", 500],
    ["Butter", "fat", 275],
    ["Water", "liquid", 225],
    ["Sugar", "sweetener", 40],
    ["Salt", "salt", 10],
  ],
  hot_sauce: [
    ["Chiles / peppers", "produce", 550],
    ["Vinegar", "acid", 300],
    ["Garlic", "spice", 50],
    ["Sugar or honey", "sweetener", 70],
    ["Salt", "salt", 30],
  ],
  vinegar: [
    ["Fruit, cider, or wine base", "liquid", 920],
    ["Raw vinegar starter", "culture", 80],
  ],
  infused_oil: [
    ["Olive oil", "fat", 920],
    ["Dry herbs, chiles, or aromatics", "spice", 80],
  ],
  other: [
    ["Main ingredient", "other", 500],
  ],
};

function compactSpaces(value = "") {
  return String(value).replace(/[ \t]+/g, " ").replace(/\s+\n/g, "\n").trim();
}

export function textFromHtml(html = "") {
  const entityMap = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    ndash: "–",
    mdash: "—",
  };
  return compactSpaces(String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|h[1-6]|div|section|article|tr|ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#?\w+);/g, (_, entity) => {
      if (entity.startsWith("#x")) return String.fromCharCode(parseInt(entity.slice(2), 16));
      if (entity.startsWith("#")) return String.fromCharCode(parseInt(entity.slice(1), 10));
      return entityMap[entity] || " ";
    }));
}

function normalizeLines(text = "") {
  return textFromHtml(text)
    .split(/\r?\n|(?<=\.)\s+(?=\d+\.\s)/)
    .map((line) => line.replace(/^[•*\-–—]\s*/, "").trim())
    .filter(Boolean)
    .filter((line) => !/^(print|pin|share|jump to recipe|nutrition|advertisement)$/i.test(line));
}

function parseQuantity(value = "") {
  const trimmed = String(value).trim().toLowerCase();
  if (!trimmed) return null;
  if (NUMBER_WORDS[trimmed]) return NUMBER_WORDS[trimmed];
  if (FRACTIONS[trimmed]) return FRACTIONS[trimmed];
  if (/^\d+\s+\d+\/\d+$/.test(trimmed)) {
    const [whole, fraction] = trimmed.split(/\s+/);
    const [top, bottom] = fraction.split("/").map(Number);
    return Number(whole) + top / bottom;
  }
  if (/^\d+\/\d+$/.test(trimmed)) {
    const [top, bottom] = trimmed.split("/").map(Number);
    return top / bottom;
  }
  const unicodeFraction = Object.entries(FRACTIONS).find(([symbol]) => trimmed.includes(symbol));
  if (unicodeFraction) {
    const whole = Number(trimmed.replace(unicodeFraction[0], "").trim() || 0);
    return whole + unicodeFraction[1];
  }
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : null;
}

function categoryForName(name = "") {
  const lower = String(name).toLowerCase();
  if (/\b(flour|semolina|spelt|einkorn|rye|kamut|wheat|00|ap flour|all-purpose)\b/.test(lower)) return "flour";
  if (/\b(water|milk|buttermilk|juice|beer|whey|cream|coffee|tea)\b/.test(lower)) return "liquid";
  if (/\b(starter|levain|sourdough|preferment|poolish|biga)\b/.test(lower)) return "starter";
  if (/\b(yeast|baking powder|baking soda|leavener)\b/.test(lower)) return "yeast";
  if (/\bsalt\b/.test(lower)) return "salt";
  if (/\b(sugar|honey|maple|syrup|molasses|malt|jam)\b/.test(lower)) return "sweetener";
  if (/\b(butter|oil|lard|shortening|ghee|olive oil|fat)\b/.test(lower)) return "fat";
  if (/\b(vinegar|lemon|lime|citric|acid)\b/.test(lower)) return "acid";
  if (/\b(garlic|pepper|cinnamon|cumin|paprika|herb|spice|chile|chili|vanilla)\b/.test(lower)) return "spice";
  if (/\b(apple|berries|fruit|pepper|onion|tomato|carrot|potato|banana|zucchini)\b/.test(lower)) return "produce";
  if (/\b(culture|mother|scoby|brine)\b/.test(lower)) return "culture";
  if (/\b(chocolate|nuts?|seeds?|raisin|cranberry|cheese|olive)\b/.test(lower)) return "inclusion";
  return "other";
}

function gramsPerUnit(unit, name, category) {
  const lower = String(name || "").toLowerCase();
  if (unit === "g") return 1;
  if (unit === "kg") return 1000;
  if (unit === "ml") return 1;
  if (unit === "l") return 1000;
  if (unit === "oz") return 28.3495;
  if (unit === "lb") return 453.592;
  if (unit === "egg") return 50;
  if (unit === "clove") return 5;
  if (unit === "pinch") return 0.4;
  if (unit === "dash") return 0.6;
  if (unit === "cup") {
    if (category === "flour") return 120;
    if (/\b(cocoa)\b/.test(lower)) return 100;
    if (category === "sweetener") return 200;
    if (/\b(butter)\b/.test(lower)) return 227;
    if (category === "fat") return 218;
    if (category === "liquid" || category === "acid") return 240;
    if (category === "inclusion") return 165;
    return 140;
  }
  if (unit === "tbsp") {
    if (category === "flour") return 8;
    if (category === "salt") return 18;
    if (category === "sweetener") return 13;
    if (category === "fat") return 14;
    return 15;
  }
  if (unit === "tsp") {
    if (category === "salt") return 6;
    if (category === "yeast") return 3.1;
    if (category === "spice") return 2.5;
    if (category === "sweetener") return 4;
    return 5;
  }
  return null;
}

function cleanIngredientName(value = "") {
  return String(value)
    .replace(/\([^)]*\)/g, "")
    .replace(/\b(divided|room temperature|melted|softened|plus more.*|as needed|to taste)\b/gi, "")
    .replace(/^[,.\s]+|[,.\s]+$/g, "")
    .replace(/^of\s+/i, "")
    .trim();
}

function parseIngredientLine(line = "") {
  const normalized = line
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/,/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized || HEADING_RE.test(normalized)) return null;
  const patterns = [
    /^((?:\d+\s+\d+\/\d+)|(?:\d+\/\d+)|(?:\d+(?:\.\d+)?)|[¼½¾⅓⅔⅛⅜⅝⅞]|one|two|three|four|five|six|seven|eight|nine|ten|twelve)\s*([a-zA-Z]+)?\s+(.+)$/i,
    /^((?:\d+(?:\.\d+)?))([a-zA-Z]+)\s+(.+)$/i,
  ];
  let match = null;
  for (const pattern of patterns) {
    match = normalized.match(pattern);
    if (match) break;
  }
  if (!match) return null;
  const quantity = parseQuantity(match[1]);
  const unit = UNIT_ALIASES[String(match[2] || "").toLowerCase()] || "";
  const name = cleanIngredientName(match[3]);
  if (!name || !quantity) return null;
  const category = categoryForName(name);
  const grams = unit ? gramsPerUnit(unit, name, category) : null;
  return {
    name: name[0]?.toUpperCase() + name.slice(1),
    category,
    quantity,
    unit,
    weight: grams ? Math.max(1, Math.round(quantity * grams)) : 0,
    raw: line,
  };
}

function looksLikeIngredient(line = "") {
  if (HEADING_RE.test(line)) return false;
  return Boolean(parseIngredientLine(line));
}

function inferProductType(text = "", ingredients = []) {
  const haystack = [
    text,
    ingredients.map((ingredient) => ingredient.name).join(" "),
  ].join(" ");
  const matched = PRODUCT_TYPE_MATCHERS.find(([, regex]) => regex.test(haystack));
  return matched?.[0] || "bread";
}

function titleFromUrl(sourceUrl = "") {
  try {
    const url = new URL(sourceUrl);
    const slug = url.pathname
      .split("/")
      .filter(Boolean)
      .at(-1);
    return slug
      ? slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
      : url.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function extractTitle(lines, sourceUrl) {
  const title = lines.find((line) => (
    line.length >= 4
    && line.length <= 90
    && !HEADING_RE.test(line)
    && !looksLikeIngredient(line)
    && !/^\d+\./.test(line)
    && !/\b(prep|cook|total|servings?|yield)\s*:/i.test(line)
  ));
  return title || titleFromUrl(sourceUrl) || "Imported recipe";
}

function extractIngredientLines(lines) {
  const ingredientHeadingIndex = lines.findIndex((line) => INGREDIENT_HEADING_RE.test(line));
  const methodHeadingIndex = lines.findIndex((line, index) => (
    index > Math.max(ingredientHeadingIndex, -1) && METHOD_HEADING_RE.test(line)
  ));
  if (ingredientHeadingIndex >= 0) {
    const end = methodHeadingIndex >= 0 ? methodHeadingIndex : lines.length;
    return lines.slice(ingredientHeadingIndex + 1, end).filter((line) => !HEADING_RE.test(line));
  }
  return lines.filter(looksLikeIngredient);
}

function extractMethodLines(lines) {
  const methodHeadingIndex = lines.findIndex((line) => METHOD_HEADING_RE.test(line));
  const methodLines = methodHeadingIndex >= 0
    ? lines.slice(methodHeadingIndex + 1)
    : lines.filter((line) => /^\d+[\).]\s+/.test(line));
  return methodLines
    .map((line) => line.replace(/^\d+[\).]\s*/, "").trim())
    .filter((line) => line && !HEADING_RE.test(line))
    .slice(0, 12);
}

function methodStepsFromLines(lines) {
  return lines.map((line, index) => {
    const [title, ...rest] = line.split(":");
    if (rest.length && title.length <= 34) {
      return {
        title: title.trim(),
        body: rest.join(":").trim(),
      };
    }
    const firstSentence = line.split(".")[0];
    return {
      title: firstSentence && firstSentence.length <= 28 ? firstSentence.trim() : `Step ${index + 1}`,
      body: line,
    };
  });
}

function fallbackIngredients(productType) {
  return (FALLBACK_TEMPLATES[productType] || FALLBACK_TEMPLATES.other).map(([name, category, weight], index) => ({
    id: `ingredient-import-fallback-${index}-${Date.now()}`,
    name,
    category,
    weight,
    percent: 0,
    flourType: category === "flour" ? getFlourProfile(name).name : undefined,
    raw: "Fallback ingredient",
  }));
}

function defaultYieldFor(productType) {
  if (productType === "bagel" || productType === "bun") return 12;
  if (productType === "pastry") return 6;
  return 1;
}

function extractYield(text, productType, defaultUnit) {
  const match = String(text).match(/\b(?:makes|yields?|serves?)\s*:?\s*(\d+(?:\.\d+)?)\s*(loaves|loaf|bagels?|buns?|rolls?|bottles?|jars?|cakes?|pastries?|servings?|cookies?|muffins?)\b/i)
    || String(text).match(/\b(\d+(?:\.\d+)?)\s*(loaves|loaf|bagels?|buns?|rolls?|bottles?|jars?|cakes?|pastries?|servings?|cookies?|muffins?)\b/i);
  if (!match) {
    return {
      yieldCount: defaultYieldFor(productType),
      unitName: defaultUnit,
    };
  }
  const unit = match[2].toLowerCase()
    .replace(/ies$/, "y")
    .replace(/ves$/, "f")
    .replace(/s$/, "")
    .replace(/^loaf$/, "loaf");
  return {
    yieldCount: Math.max(1, Number(match[1] || defaultYieldFor(productType))),
    unitName: unit === "serving" ? defaultUnit : unit,
  };
}

function fallbackWeightForCategory(category, baseWeight) {
  const percent = {
    flour: 100,
    liquid: 65,
    starter: 20,
    yeast: 1.2,
    salt: 2,
    sweetener: 5,
    fat: 5,
    acid: 3,
    spice: 1,
    produce: 15,
    culture: 8,
    inclusion: 10,
    other: 5,
  }[category] || 5;
  return Math.max(1, Math.round(baseWeight * percent / 100));
}

function normalizeFormula(rawIngredients, productType, formulaMode, yieldCount) {
  const ingredients = rawIngredients.length ? rawIngredients : fallbackIngredients(productType);
  const knownFlourWeight = ingredients.reduce((sum, ingredient) => (
    ingredient.category === "flour" ? sum + Number(ingredient.weight || 0) : sum
  ), 0);
  const knownTotal = ingredients.reduce((sum, ingredient) => sum + Number(ingredient.weight || 0), 0);
  const fallbackBase = productType === "cake" ? 250 : productType === "hot_sauce" ? 1000 : 600 * Math.max(1, yieldCount || 1);
  const baseWeight = formulaMode === "batch"
    ? Math.max(1, knownTotal || fallbackBase)
    : Math.max(1, knownFlourWeight || fallbackBase);

  const weightedIngredients = ingredients.map((ingredient, index) => {
    const weight = Number(ingredient.weight || 0) || (
      ingredient.category === "flour" && formulaMode === "bakers"
        ? Math.round(baseWeight / Math.max(1, ingredients.filter((item) => item.category === "flour").length || 1))
        : fallbackWeightForCategory(ingredient.category, baseWeight)
    );
    return {
      ...ingredient,
      id: ingredient.id || `ingredient-import-${index}-${Date.now()}`,
      weight,
      flourType: ingredient.category === "flour" ? getFlourProfile(ingredient.flourType || ingredient.name).name : undefined,
    };
  });

  const batchTotal = formulaMode === "batch"
    ? weightedIngredients.reduce((sum, ingredient) => sum + Number(ingredient.weight || 0), 0) || baseWeight
    : baseWeight;

  return {
    baseWeight: batchTotal,
    flourWeight: formulaMode === "batch" ? batchTotal : baseWeight,
    ingredients: weightedIngredients.map((ingredient) => ({
      ...ingredient,
      percent: Number((Number(ingredient.weight || 0) / Math.max(1, batchTotal) * 100).toFixed(3)),
    })),
  };
}

function sourceLabel(sourceUrl = "") {
  if (!sourceUrl) return "pasted recipe";
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return "web recipe";
  }
}

export function parseImportedRecipe(sourceText = "", options = {}) {
  const lines = normalizeLines(sourceText);
  const ingredientLines = extractIngredientLines(lines);
  const parsedIngredients = ingredientLines
    .map(parseIngredientLine)
    .filter(Boolean);
  const productType = inferProductType(sourceText, parsedIngredients);
  const typeSettings = productTypeSettingsFor(options.bakerySettings, productType);
  const productTypeBase = productTypeFor(productType);
  const formulaMode = typeSettings.formulaMode || productTypeBase.formulaMode || "bakers";
  const title = extractTitle(lines, options.sourceUrl);
  const { yieldCount, unitName } = extractYield(sourceText, productType, typeSettings.unitName || productTypeBase.unitName || "item");
  const formula = normalizeFormula(parsedIngredients, productType, formulaMode, yieldCount);
  const methodLines = extractMethodLines(lines);
  const instructions = methodStepsFromLines(methodLines);
  const salesOptions = (typeSettings.packagePresets || []).map((option, index) => ({
    id: `import-preset-${productType}-${index}-${Date.now()}`,
    label: option.label,
    units: Number(option.units || 1),
    price: Number(option.price || 0),
    capacityUnits: Number(option.capacityUnits ?? 1),
  }));
  const hydration = formula.ingredients.reduce((sum, ingredient) => (
    ingredient.category === "liquid" ? sum + Number(ingredient.percent || 0) : sum
  ), 0);
  const warnings = [];

  if (!parsedIngredients.length) warnings.push("I could not confidently find an ingredient section, so I created a starter formula you can edit.");
  if (!methodLines.length) warnings.push("I did not find clear step-by-step instructions, so the recipe will use the app’s default production notes until you edit it.");
  if (ingredientLines.length && parsedIngredients.length < Math.min(ingredientLines.length, 4)) warnings.push("Some ingredient lines did not include a clear quantity or unit and were skipped.");
  if (options.sourceUrl) warnings.push("Web imports can be messy. Review the draft before selling or scheduling it.");

  const recipe = applyYeastTimingSuggestion({
    id: `recipe-import-${Date.now()}`,
    name: title,
    note: `Imported from ${sourceLabel(options.sourceUrl)}. Review and tune before selling.`,
    productType,
    formulaMode,
    photoUrl: "",
    photoAlt: title,
    available: true,
    soldOut: false,
    unavailableThisWeek: false,
    hiddenThisWeek: false,
    availabilityNote: "",
    badges: productType === "hot_sauce" ? ["spicy", "limited_batch"] : ["preorder"],
    yield: yieldCount,
    unitName,
    price: salesOptions.length ? Math.min(...salesOptions.map((option) => Number(option.price || 0))) : 0,
    salesOptions,
    flourWeight: formula.flourWeight,
    baseWeight: formula.baseWeight,
    hydration,
    economics: {
      laborMinutes: defaultLaborMinutesForRecipe({ productType }),
      laborRate: 20,
      overheadPercent: 10,
      packageCost: 0,
    },
    timelineSettings: defaultTimelineSettingsForProductType(productType),
    versionNote: "Imported recipe draft",
    importedAt: new Date().toISOString(),
    importSourceUrl: options.sourceUrl || "",
    importSourceText: String(sourceText || "").slice(0, 8000),
    instructions,
    productionInstructions: instructions,
    isNew: true,
    ingredients: formula.ingredients.map(({ raw, quantity, unit, ...ingredient }) => ingredient),
  }, { force: true });

  return {
    recipe,
    warnings,
    parsedIngredientCount: parsedIngredients.length,
    lineCount: lines.length,
  };
}
