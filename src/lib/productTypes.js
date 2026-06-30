// product-type-settings-v1
// customer-options-v1
// yeast-breads-v1
export const PRODUCT_TYPES = [
  { value: "bread", label: "Bread", unitName: "loaf", formulaMode: "bakers", icon: "🥖" },
  { value: "yeast", label: "Yeast breads", unitName: "loaf", formulaMode: "bakers", icon: "🍞" },
  { value: "bagel", label: "Bagels", unitName: "bagel", formulaMode: "bakers", icon: "🥯" },
  { value: "bun", label: "Buns / rolls", unitName: "bun", formulaMode: "bakers", icon: "🍞" },
  { value: "cake", label: "Cakes", unitName: "cake", formulaMode: "bakers", icon: "🍰" },
  { value: "pastry", label: "Pastries", unitName: "pastry", formulaMode: "bakers", icon: "🥐" },
  { value: "hot_sauce", label: "Hot sauces", unitName: "bottle", formulaMode: "batch", icon: "🌶️" },
  { value: "vinegar", label: "Vinegars", unitName: "bottle", formulaMode: "batch", icon: "🍾" },
  { value: "infused_oil", label: "Infused oils", unitName: "bottle", formulaMode: "batch", icon: "🫒" },
  { value: "other", label: "Other item", unitName: "item", formulaMode: "batch", icon: "🏷️" },
];

export const PRODUCT_TYPE_ORDER = PRODUCT_TYPES.map((type) => type.value);

const DEFAULT_PRODUCT_TYPE_COPY = {
  bread: {
    description: "Naturally leavened loaves baked in small batches.",
    safetyNotes: "Contains wheat. May share equipment with dairy, seeds, and other allergens.",
    customerOptions: [
      {
        id: "slicing",
        label: "Slicing preference",
        type: "select",
        enabled: true,
        required: false,
        help: "Show this only when slicing is available this week.",
        choices: ["Do not slice", "Slice if possible", "Please slice"],
      },
      {
        id: "crust-finish",
        label: "Crust finish",
        type: "select",
        enabled: false,
        required: false,
        help: "Optional weekly choice for lighter or darker crust requests.",
        choices: ["Baker's choice", "Lighter bake", "Darker bake"],
      },
    ],
    presets: [
      { label: "Loaf", units: 1, price: 13, capacityUnits: 1 },
      { label: "Half loaf", units: 0.5, price: 7, capacityUnits: 1 },
    ],
  },
  yeast: {
    description: "Commercial-yeast breads such as sandwich loaves, milk bread, dinner bread, and enriched pan loaves.",
    safetyNotes: "Contains wheat and commercial yeast. Enriched recipes may contain dairy, eggs, butter, or oil.",
    customerOptions: [
      {
        id: "yeast-slicing",
        label: "Slicing preference",
        type: "select",
        enabled: true,
        required: false,
        help: "Turn this off during weeks when you do not want to offer slicing.",
        choices: ["Do not slice", "Slice if possible", "Please slice"],
      },
      {
        id: "loaf-style",
        label: "Loaf style",
        type: "select",
        enabled: false,
        required: false,
        help: "Optional when you offer multiple finishes for the same yeast bread.",
        choices: ["Baker's choice", "Soft sandwich loaf", "Darker crust", "Pullman style if available"],
      },
    ],
    presets: [
      { label: "Loaf", units: 1, price: 10, capacityUnits: 1 },
      { label: "Two loaves", units: 2, price: 18, capacityUnits: 2 },
    ],
  },
  bagel: {
    description: "Chewy sourdough bagels sold in useful breakfast packs.",
    safetyNotes: "Contains wheat. Toppings may include seeds, dairy, or alliums.",
    customerOptions: [
      {
        id: "bagel-sliced",
        label: "Slice bagels",
        type: "select",
        enabled: false,
        required: false,
        help: "Turn on only when you want to offer pre-sliced bagels.",
        choices: ["Leave whole", "Slice if possible"],
      },
      {
        id: "topping-style",
        label: "Topping preference",
        type: "select",
        enabled: false,
        required: false,
        help: "Useful for special bagel runs with multiple toppings.",
        choices: ["Baker's choice", "Plain", "Seeded", "Everything"],
      },
    ],
    presets: [
      { label: "Half dozen", units: 6, price: 15, capacityUnits: 1 },
      { label: "Dozen", units: 12, price: 28, capacityUnits: 2 },
    ],
  },
  bun: {
    description: "Soft rolls and buns for dinners, sandwiches, and gatherings.",
    safetyNotes: "Contains wheat and may contain dairy, eggs, or butter depending on the recipe.",
    customerOptions: [
      {
        id: "bun-sliced",
        label: "Split buns",
        type: "select",
        enabled: false,
        required: false,
        help: "Show this if you are willing to split sandwich buns before pickup.",
        choices: ["Leave whole", "Split if possible"],
      },
      {
        id: "seeded-top",
        label: "Seeded tops",
        type: "select",
        enabled: false,
        required: false,
        help: "Optional topping choice for weekly bun runs.",
        choices: ["Baker's choice", "No seeds", "Sesame", "Everything"],
      },
    ],
    presets: [
      { label: "Half dozen", units: 6, price: 16, capacityUnits: 1 },
      { label: "Dozen", units: 12, price: 30, capacityUnits: 2 },
    ],
  },
  cake: {
    description: "Small-batch cakes and sweet bakes made to order.",
    safetyNotes: "May contain wheat, dairy, eggs, nuts, chocolate, or other common allergens.",
    customerOptions: [
      {
        id: "occasion-message",
        label: "Occasion or message",
        type: "text",
        enabled: true,
        required: false,
        help: "Let customers share a birthday, celebration, or label note.",
        choices: [],
      },
      {
        id: "frosting-style",
        label: "Frosting style",
        type: "select",
        enabled: false,
        required: false,
        help: "Turn on for cake weeks where you want customers choosing a finish.",
        choices: ["Baker's choice", "Light frosting", "Extra frosting", "No frosting"],
      },
    ],
    presets: [
      { label: "Whole cake", units: 1, price: 24, capacityUnits: 2 },
      { label: "Half cake", units: 0.5, price: 14, capacityUnits: 1 },
    ],
  },
  pastry: {
    description: "Laminated, enriched, and pastry-style bakes for special runs.",
    safetyNotes: "Usually contains wheat and butter. May contain eggs, dairy, nuts, or chocolate.",
    customerOptions: [
      {
        id: "packaging",
        label: "Packaging preference",
        type: "select",
        enabled: false,
        required: false,
        help: "Show this for gift boxes or mixed pastry pickups.",
        choices: ["Box together", "Separate boxes", "Gift wrap if available"],
      },
      {
        id: "warm-pickup",
        label: "Warm pickup preference",
        type: "select",
        enabled: false,
        required: false,
        help: "Only enable if you can coordinate a warm pastry pickup window.",
        choices: ["No preference", "Warm if possible", "Fully cooled"],
      },
    ],
    presets: [
      { label: "Each", units: 1, price: 5, capacityUnits: 1 },
      { label: "Half dozen", units: 6, price: 27, capacityUnits: 2 },
    ],
  },
  hot_sauce: {
    description: "Bright fermented or cooked sauces bottled in small batches.",
    safetyNotes: "Refrigerate after opening. Heat level and acidity vary by batch; ask before ordering if you have sensitivities.",
    customerOptions: [
      {
        id: "spice-level",
        label: "Preferred spice level",
        type: "select",
        enabled: true,
        required: false,
        help: "Hide this when the batch has one fixed heat level.",
        choices: ["Mild", "Medium", "Hot", "Extra hot"],
      },
      {
        id: "flavor-direction",
        label: "Flavor direction",
        type: "select",
        enabled: false,
        required: false,
        help: "Useful for custom sauce weeks.",
        choices: ["Baker's choice", "Fruit-forward", "Garlic-forward", "Smoky", "Extra tangy"],
      },
    ],
    presets: [
      { label: "Bottle", units: 1, price: 9, capacityUnits: 0 },
      { label: "Three-pack", units: 3, price: 24, capacityUnits: 0 },
    ],
  },
  vinegar: {
    description: "Designed vinegars for cooking, finishing, shrubs, and dressings.",
    safetyNotes: "Acidic product. Use clean utensils, keep capped, and follow the baker’s storage guidance.",
    customerOptions: [
      {
        id: "vinegar-use",
        label: "How will you use it?",
        type: "select",
        enabled: false,
        required: false,
        help: "Show this if you want to steer customers toward the right acidity/flavor.",
        choices: ["Finishing", "Cooking", "Shrub / drink mixer", "Gift"],
      },
      {
        id: "sweetness",
        label: "Sweetness preference",
        type: "select",
        enabled: false,
        required: false,
        help: "Optional for drinking vinegars or shrubs.",
        choices: ["Dry", "Balanced", "Slightly sweet"],
      },
    ],
    presets: [
      { label: "Bottle", units: 1, price: 12, capacityUnits: 0 },
      { label: "Three-pack", units: 3, price: 33, capacityUnits: 0 },
    ],
  },
  infused_oil: {
    description: "Infused oils for dipping, finishing, and savory cooking.",
    safetyNotes: "Follow storage directions closely. Refrigerate if instructed, especially for garlic, herbs, or fresh produce infusions.",
    customerOptions: [
      {
        id: "infusion-style",
        label: "Infusion preference",
        type: "select",
        enabled: false,
        required: false,
        help: "Show this only if you are offering multiple infusion directions.",
        choices: ["Mild", "Herb-forward", "Garlic-forward", "Chile-forward"],
      },
      {
        id: "oil-use",
        label: "How will you use it?",
        type: "select",
        enabled: false,
        required: false,
        help: "Helps match oils to dipping, cooking, or finishing.",
        choices: ["Dipping", "Finishing", "Cooking", "Gift"],
      },
    ],
    presets: [
      { label: "Bottle", units: 1, price: 12, capacityUnits: 0 },
      { label: "Half dozen", units: 6, price: 66, capacityUnits: 0 },
    ],
  },
  other: {
    description: "Other small-batch goods and seasonal experiments.",
    safetyNotes: "Ingredients and storage vary by item. Check the product details and ask about allergens.",
    customerOptions: [
      {
        id: "gift-note",
        label: "Gift or label note",
        type: "text",
        enabled: false,
        required: false,
        help: "Optional note customers can leave for seasonal items.",
        choices: [],
      },
    ],
    presets: [
      { label: "Each", units: 1, price: 10, capacityUnits: 1 },
    ],
  },
};

function slug(value) {
  return String(value || "option")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "option";
}

const CUSTOMER_OPTION_TYPES = new Set(["select", "text"]);

function normalizeCustomerOptionChoices(choices) {
  const rawChoices = Array.isArray(choices)
    ? choices
    : String(choices || "").split(/[\n,]/);
  return rawChoices
    .map((choice) => String(choice || "").trim())
    .filter(Boolean);
}

function normalizeCustomerOptions(rawOptions, defaultOptions = []) {
  const source = Array.isArray(rawOptions) ? rawOptions : defaultOptions;
  return source.map((option, index) => {
    const label = String(option.label || `Choice ${index + 1}`).trim();
    const type = CUSTOMER_OPTION_TYPES.has(option.type) ? option.type : "select";
    const choices = normalizeCustomerOptionChoices(option.choices);
    return {
      id: String(option.id || `${slug(label)}-${index + 1}`),
      label,
      type,
      enabled: option.enabled !== false,
      required: option.required === true,
      help: String(option.help || option.note || "").trim(),
      choices: type === "select" ? (choices.length ? choices : ["Yes", "No"]) : choices,
    };
  });
}

export function productTypeFor(value) {
  const key = typeof value === "string" ? value : value?.productType || value?.value;
  return PRODUCT_TYPES.find((type) => type.value === key) || PRODUCT_TYPES[0];
}

export function productTypeMap(settings) {
  return new Map(normalizeProductTypeSettings(settings).map((type) => [type.value, type]));
}

export function normalizeProductTypeSettings(settings = {}) {
  const rawTypes = Array.isArray(settings.productTypes) ? settings.productTypes : [];
  const byValue = new Map(rawTypes.map((type) => [type.value, type]));
  return PRODUCT_TYPES.map((base, defaultIndex) => {
    const incoming = byValue.get(base.value) || {};
    const copy = DEFAULT_PRODUCT_TYPE_COPY[base.value] || DEFAULT_PRODUCT_TYPE_COPY.other;
    const rawPresets = Array.isArray(incoming.packagePresets) && incoming.packagePresets.length
      ? incoming.packagePresets
      : copy.presets;
    return {
      ...base,
      enabled: incoming.enabled !== false,
      order: Number.isFinite(Number(incoming.order)) ? Number(incoming.order) : defaultIndex,
      unitName: String(incoming.unitName || base.unitName).trim() || base.unitName,
      description: String(incoming.description ?? copy.description).trim(),
      safetyNotes: String(incoming.safetyNotes ?? copy.safetyNotes).trim(),
      customerOptions: normalizeCustomerOptions(incoming.customerOptions, copy.customerOptions || []),
      packagePresets: rawPresets.map((preset, index) => ({
        id: String(preset.id || `${base.value}-${slug(preset.label)}-${index + 1}`),
        label: String(preset.label || `Option ${index + 1}`).trim(),
        units: Math.max(0.5, Number(preset.units || 1)),
        price: Math.max(0, Number(preset.price || 0)),
        capacityUnits: Math.max(0, Math.min(6, Number(preset.capacityUnits ?? 1))),
      })),
    };
  }).sort((a, b) => a.order - b.order);
}

export function productTypeSettingsFor(settings, value) {
  const normalized = normalizeProductTypeSettings(settings);
  return normalized.find((type) => type.value === value) || normalized[0];
}

export function enabledCustomerOptionsFor(settings, value) {
  return (productTypeSettingsFor(settings, value)?.customerOptions || [])
    .filter((option) => option.enabled !== false);
}
