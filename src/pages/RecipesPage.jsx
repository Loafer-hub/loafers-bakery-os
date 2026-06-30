import {
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Database,
  Droplets,
  Lightbulb,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wheat,
} from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeading } from "../components/AppChrome";
import { FlourBlendScience } from "../components/FlourScience";
import { EmptyState, Modal } from "../components/Primitives";
import { FLOUR_DATABASE_CATEGORIES, FLOUR_PROFILES, getFlourProfile } from "../data/flourProfiles";
import {
  PRODUCT_TYPES,
  productTypeFor as productTypeMetaFor,
  productTypeSettingsFor,
} from "../lib/productTypes";
import {
  lowestSalesPrice,
  normalizedSalesOptions,
  pluralUnit,
  SALES_OPTION_PRESETS,
} from "../lib/salesOptions";
import {
  applyYeastTimingSuggestion,
  defaultTimelineSettingsForProductType,
  normalizeTimelineSettings,
  recipeAllowsStarterIngredient,
  suggestYeastTimeline,
} from "../lib/recipeTimeline";

// yeast-breads-v1
// recipe-grams-entry-v1
// recipe-timeline-controls-v1
// yeast-rise-science-v1

const INGREDIENT_CATEGORIES = [
  { value: "flour", label: "Flour" },
  { value: "liquid", label: "Liquid" },
  { value: "starter", label: "Starter / preferment" },
  { value: "yeast", label: "Yeast / leavener" },
  { value: "salt", label: "Salt" },
  { value: "sweetener", label: "Sweetener" },
  { value: "fat", label: "Fat / oil" },
  { value: "acid", label: "Acid / vinegar" },
  { value: "spice", label: "Spice / herb" },
  { value: "produce", label: "Fruit / vegetable" },
  { value: "culture", label: "Culture / ferment" },
  { value: "inclusion", label: "Inclusion" },
  { value: "other", label: "Other" },
];

const DEFAULT_INGREDIENTS = [
  { key: "flour", name: "Bread flour", category: "flour", percent: 100 },
  { key: "water", name: "Water", category: "liquid", percent: 75 },
  { key: "starter", name: "Starter", category: "starter", percent: 20 },
  { key: "salt", name: "Salt", category: "salt", percent: 2 },
];

const PRODUCT_TEMPLATES = {
  bread: DEFAULT_INGREDIENTS,
  yeast: [
    { key: "flour", name: "Bread flour", category: "flour", percent: 100 },
    { key: "water", name: "Water or milk", category: "liquid", percent: 63 },
    { key: "yeast", name: "Instant yeast", category: "yeast", percent: 1.2 },
    { key: "sugar", name: "Sugar", category: "sweetener", percent: 5 },
    { key: "fat", name: "Butter or oil", category: "fat", percent: 5 },
    { key: "salt", name: "Salt", category: "salt", percent: 2 },
  ],
  bagel: [
    { key: "flour", name: "Bread flour", category: "flour", percent: 100 },
    { key: "water", name: "Water", category: "liquid", percent: 58 },
    { key: "starter", name: "Starter", category: "starter", percent: 18 },
    { key: "salt", name: "Salt", category: "salt", percent: 2 },
    { key: "malt", name: "Malt syrup", category: "sweetener", percent: 3 },
  ],
  bun: [
    { key: "flour", name: "Bread flour", category: "flour", percent: 100 },
    { key: "milk", name: "Milk", category: "liquid", percent: 62 },
    { key: "butter", name: "Butter", category: "fat", percent: 12 },
    { key: "sugar", name: "Sugar", category: "sweetener", percent: 8 },
    { key: "starter", name: "Starter", category: "starter", percent: 15 },
    { key: "salt", name: "Salt", category: "salt", percent: 2 },
  ],
  cake: [
    { key: "flour", name: "All-purpose flour", category: "flour", percent: 100 },
    { key: "sugar", name: "Sugar", category: "sweetener", percent: 85 },
    { key: "butter", name: "Butter", category: "fat", percent: 55 },
    { key: "eggs", name: "Eggs", category: "liquid", percent: 50 },
    { key: "milk", name: "Milk", category: "liquid", percent: 45 },
    { key: "salt", name: "Salt", category: "salt", percent: 1.5 },
  ],
  pastry: [
    { key: "flour", name: "Bread flour", category: "flour", percent: 100 },
    { key: "butter", name: "Butter", category: "fat", percent: 55 },
    { key: "water", name: "Water", category: "liquid", percent: 45 },
    { key: "sugar", name: "Sugar", category: "sweetener", percent: 8 },
    { key: "salt", name: "Salt", category: "salt", percent: 2 },
  ],
  hot_sauce: [
    { key: "peppers", name: "Chiles / peppers", category: "produce", percent: 55 },
    { key: "vinegar", name: "Vinegar", category: "acid", percent: 30 },
    { key: "garlic", name: "Garlic", category: "spice", percent: 5 },
    { key: "sweetener", name: "Honey or sugar", category: "sweetener", percent: 7 },
    { key: "salt", name: "Salt", category: "salt", percent: 3 },
  ],
  vinegar: [
    { key: "base", name: "Fruit, cider, or wine base", category: "liquid", percent: 92 },
    { key: "culture", name: "Raw vinegar starter", category: "culture", percent: 8 },
  ],
  infused_oil: [
    { key: "oil", name: "Olive oil", category: "fat", percent: 92 },
    { key: "herbs", name: "Herbs, chiles, or garlic", category: "spice", percent: 8 },
  ],
  other: [
    { key: "main", name: "Main ingredient", category: "other", percent: 100 },
  ],
};

const TYPE_DEFAULT_UNITS = new Set(PRODUCT_TYPES.map((type) => type.unitName.toLowerCase()));

// recipe-type-collapse-v1
// product-type-settings-v1
// checkout-flow-v1
const PRODUCT_BADGE_OPTIONS = [
  { value: "preorder", label: "Preorder" },
  { value: "ready_now", label: "Ready now" },
  { value: "spicy", label: "Spicy" },
  { value: "dairy", label: "Contains dairy" },
  { value: "gluten", label: "Gluten" },
  { value: "limited_batch", label: "Limited batch" },
];
function productTypeFor(recipe = {}) {
  return productTypeMetaFor(recipe.productType || recipe.value);
}

function productTypeLabel(value) {
  return productTypeFor({ productType: value }).label;
}

function productTypeIcon(recipe = {}) {
  return productTypeFor(recipe).icon;
}

function unitNameFor(recipe = {}) {
  return recipe.unitName || productTypeFor(recipe).unitName || "item";
}

function defaultIngredientsForType(productType, stamp = Date.now()) {
  const template = PRODUCT_TEMPLATES[productType] || PRODUCT_TEMPLATES.other;
  return template.map((ingredient) => ({
    ...ingredient,
    id: `ingredient-${ingredient.key}-${stamp}`,
  }));
}

function sanitizeIngredientsForTimeline(ingredients, recipe) {
  const allowsStarter = recipeAllowsStarterIngredient(recipe);
  if (allowsStarter) return ingredients;
  return ingredients.filter((ingredient) => ingredient.category !== "starter");
}

function refreshRecipeTiming(recipe, options = {}) {
  const sanitized = {
    ...recipe,
    ingredients: sanitizeIngredientsForTimeline(recipe.ingredients || [], recipe),
  };
  return applyYeastTimingSuggestion(sanitized, options);
}

function isUntouchedDefaultFormula(recipe) {
  if (!recipe.isNew) return false;
  if (recipe.ingredients.length !== DEFAULT_INGREDIENTS.length) return false;
  return DEFAULT_INGREDIENTS.every((ingredient, index) => (
    recipe.ingredients[index]?.name === ingredient.name
    && recipe.ingredients[index]?.category === ingredient.category
    && Number(recipe.ingredients[index]?.percent) === Number(ingredient.percent)
  ));
}

function formulaModeFor(recipe = {}) {
  return recipe.formulaMode || productTypeFor(recipe).formulaMode || "bakers";
}

function safePositiveNumber(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function formulaBaseFor(recipe = {}) {
  return safePositiveNumber(recipe.baseWeight || recipe.flourWeight, 1);
}

function ingredientWeightFromPercent(ingredient, baseWeight) {
  return formulaBaseFor({ baseWeight }) * Number(ingredient.percent || 0) / 100;
}

function roundForInput(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  if (Math.abs(number) >= 100) return Math.round(number);
  return Number(number.toFixed(1));
}

function percentForDisplay(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return Number(number.toFixed(1)).toString();
}

function recalculateFormulaFromWeights(recipe, editedIngredientId, editedWeight) {
  const formulaMode = formulaModeFor(recipe);
  const currentBase = formulaBaseFor(recipe);
  const nextWeights = recipe.ingredients.map((ingredient) => ({
    id: ingredient.id,
    category: ingredient.category,
    weight: ingredient.id === editedIngredientId
      ? Math.max(0, Number(editedWeight || 0))
      : Math.max(0, ingredientWeightFromPercent(ingredient, currentBase)),
  }));
  const nextBase = formulaMode === "batch"
    ? nextWeights.reduce((sum, ingredient) => sum + ingredient.weight, 0)
    : nextWeights.reduce((sum, ingredient) => (
      ingredient.category === "flour" ? sum + ingredient.weight : sum
    ), 0);
  const safeBase = Math.max(1, nextBase);
  return {
    ...recipe,
    baseWeight: safeBase,
    flourWeight: safeBase,
    ingredients: recipe.ingredients.map((ingredient) => {
      const weight = nextWeights.find((item) => item.id === ingredient.id)?.weight || 0;
      return {
        ...ingredient,
        percent: Number((weight / safeBase * 100).toFixed(3)),
      };
    }),
  };
}

function baseWeightFor(recipe) {
  if (formulaModeFor(recipe) === "batch") {
    return Number(recipe.baseWeight || recipe.flourWeight) || Number(recipe.yield || 1) * 250;
  }
  return flourWeightFor(recipe);
}

function ratioLabelFor(recipe) {
  if (formulaModeFor(recipe) === "batch") return "Batch %";
  return `${Number(recipe.hydration || 0).toFixed(0)}% hydration`;
}

function defaultMethodNotes(recipe) {
  const type = productTypeFor(recipe).value;
  if (type === "yeast") {
    return [
      ["Mix", "Mix until hydrated, then knead or fold until the dough is smooth and elastic."],
      ["Bulk rise", "Rise warm until roughly doubled. Yeast dough responds faster to warmth than sourdough."],
      ["Shape", "Degas gently, shape for a loaf pan or rolls, and proof until puffy."],
      ["Bake", "Bake when the dough springs slowly to the touch; cool fully before slicing or bagging."],
    ];
  }
  if (type === "hot_sauce") {
    return [
      ["Prep", "Wash, trim, and weigh peppers and aromatics."],
      ["Blend", "Blend with vinegar and seasonings until the texture is consistent."],
      ["Cook or ferment", "Cook gently for a shelf-stable style, or ferment safely before blending."],
      ["Bottle", "Bottle cleanly, label the batch date, and refrigerate if needed."],
    ];
  }
  if (type === "vinegar") {
    return [
      ["Start", "Combine the base with raw vinegar culture in a clean vessel."],
      ["Ferment", "Cover with breathable cloth and ferment away from direct sun."],
      ["Taste", "Check acidity and aroma regularly before bottling."],
      ["Bottle", "Strain, bottle, date, and store according to your process."],
    ];
  }
  if (type === "infused_oil") {
    return [
      ["Prep", "Use dry herbs, chiles, or aromatics to reduce water activity."],
      ["Infuse", "Steep gently, then strain for a clean finish."],
      ["Bottle", "Bottle in sanitized containers and label the batch date."],
      ["Store", "Follow safe storage guidance for oil infusions."],
    ];
  }
  if (type === "cake") {
    return [
      ["Prep", "Scale ingredients, prepare pans, and bring butter or eggs to the right temperature."],
      ["Mix", "Cream or combine according to the cake style; avoid overmixing after flour."],
      ["Bake", "Bake until the center is set and a tester comes out clean."],
      ["Cool", "Cool fully before frosting, packing, or slicing."],
    ];
  }
  return [
    ["Mix", "Rest flour and 90% of water for 30 minutes."],
    ["Develop", "Add starter and salt. Four folds over two hours."],
    ["Shape", "Shape at roughly 50% bulk rise, then cold proof."],
    ["Bake", "475°F covered, then finish uncovered at 450°F."],
  ];
}

function resizeImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith("image/")) {
      reject(new Error("Choose an image file for the recipe photo."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("That image could not be read."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("That image could not be prepared."));
      image.onload = () => {
        const maxSide = 1100;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

function ingredientCategory(ingredient) {
  if (ingredient.category) return ingredient.category;
  const name = ingredient.name.toLowerCase();
  if (name.includes("flour") || FLOUR_PROFILES.some((profile) => (
    [profile.name, ...profile.aliases].some((alias) => name.includes(alias.toLowerCase()))
  ))) return "flour";
  if (name.includes("water") || name.includes("milk") || name.includes("juice")) return "liquid";
  if (name.includes("starter") || name.includes("levain")) return "starter";
  if (name.includes("yeast") || name.includes("leavener")) return "yeast";
  if (name.includes("salt")) return "salt";
  return "inclusion";
}

function flourWeightFor(recipe) {
  const flourWeight = recipe.ingredients.reduce((sum, ingredient) => (
    ingredientCategory(ingredient) === "flour" ? sum + Number(ingredient.weight || 0) : sum
  ), 0);
  return flourWeight || Number(recipe.flourWeight) || Number(recipe.yield || 1) * 600;
}

function salesOptionsForProductType(settings, productType, stamp = Date.now()) {
  return productTypeSettingsFor(settings, productType).packagePresets.map((option, index) => ({
    ...option,
    id: `type-preset-${productType}-${index}-${stamp}`,
  }));
}

function recipeForm(recipe, bakerySettings) {
  const stamp = Date.now();
  if (!recipe) {
    const typeSettings = productTypeSettingsFor(bakerySettings, "bread");
    const salesOptions = salesOptionsForProductType(bakerySettings, "bread", stamp);
    const timelineSettings = defaultTimelineSettingsForProductType("bread");
    return {
      id: `recipe-${stamp}`,
      name: "",
      note: "",
      productType: "bread",
      formulaMode: "bakers",
      photoUrl: "",
      photoAlt: "",
      available: true,
      soldOut: false,
      unavailableThisWeek: false,
      hiddenThisWeek: false,
      availabilityNote: "",
      badges: [],
      yield: 4,
      unitName: typeSettings.unitName || "loaf",
      price: Math.min(...salesOptions.map((option) => Number(option.price || 0))),
      salesOptions,
      flourWeight: 2400,
      baseWeight: 2400,
      timelineSettings,
      isNew: true,
      ingredients: defaultIngredientsForType("bread", stamp),
    };
  }
  const productType = recipe.productType || "bread";
  const typeSettings = productTypeSettingsFor(bakerySettings, productType);
  const formulaMode = recipe.formulaMode || productTypeFor({ productType }).formulaMode;
  const timelineSettings = normalizeTimelineSettings(recipe);
  const baseWeight = formulaMode === "batch"
    ? Number(recipe.baseWeight || recipe.flourWeight) || Number(recipe.yield || 1) * 250
    : flourWeightFor(recipe);
  return refreshRecipeTiming({
    ...recipe,
    isNew: false,
    productType,
    formulaMode,
    photoUrl: recipe.photoUrl || "",
    photoAlt: recipe.photoAlt || "",
    available: recipe.available !== false,
    soldOut: recipe.soldOut === true,
    unavailableThisWeek: recipe.unavailableThisWeek === true,
    hiddenThisWeek: recipe.hiddenThisWeek === true,
    availabilityNote: recipe.availabilityNote || "",
    badges: Array.isArray(recipe.badges) ? recipe.badges : [],
    unitName: recipe.unitName || typeSettings.unitName || unitNameFor({ productType }),
    salesOptions: (Array.isArray(recipe.salesOptions) && recipe.salesOptions.length
      ? normalizedSalesOptions(recipe)
      : salesOptionsForProductType(bakerySettings, productType, stamp)
    ).map((option, index) => ({ ...option, id: option.id || `sale-option-${index}-${stamp}` })),
    flourWeight: baseWeight,
    baseWeight,
    timelineSettings,
    ingredients: sanitizeIngredientsForTimeline(recipe.ingredients.map((ingredient, index) => ({
      ...ingredient,
      id: ingredient.id || `ingredient-${index}-${stamp}`,
      category: ingredientCategory(ingredient),
      flourType: ingredientCategory(ingredient) === "flour"
        ? getFlourProfile(ingredient.flourType || ingredient.name).name
        : undefined,
      percent: Number(ingredient.percent || 0),
    })), { productType, timelineSettings }),
  });
}

function inventoryCostForIngredient(ingredient, weight, inventory) {
  const matched = inventory.find((item) => item.name.trim().toLowerCase() === ingredient.name.trim().toLowerCase());
  if (!matched || !Number(matched.unitCost)) return 0;
  const unit = String(matched.unit || "").toLowerCase();
  if (["kg", "kilogram", "kilograms"].includes(unit)) return weight / 1000 * Number(matched.unitCost);
  if (["g", "gram", "grams"].includes(unit)) return weight * Number(matched.unitCost);
  if (["lb", "pound", "pounds"].includes(unit)) return weight / 453.592 * Number(matched.unitCost);
  if (["oz", "ounce", "ounces"].includes(unit)) return weight / 28.3495 * Number(matched.unitCost);
  return 0;
}

function RecipeVisual({ recipe, large = false }) {
  const photoUrl = String(recipe.photoUrl || "").trim();
  const className = large ? "recipe-visual large" : "recipe-visual";
  if (photoUrl) {
    return (
      <span className={className}>
        <img src={photoUrl} alt={recipe.photoAlt || recipe.name} />
      </span>
    );
  }
  return <span className={`${className} empty`} aria-hidden="true">{productTypeIcon(recipe)}</span>;
}

function FlourDatabase() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState(FLOUR_DATABASE_CATEGORIES[0]?.id || "");
  const selectedCategory = FLOUR_DATABASE_CATEGORIES.find((category) => category.id === selectedCategoryId) || FLOUR_DATABASE_CATEGORIES[0];
  const [selectedId, setSelectedId] = useState(selectedCategory?.records[0]?.id || "");
  const selected = selectedCategory?.records.find((flour) => flour.id === selectedId) || selectedCategory?.records[0];
  const profile = getFlourProfile(selected?.closestProfile);

  if (!selectedCategory) return null;

  function chooseCategory(category) {
    setSelectedCategoryId(category.id);
    setSelectedId(category.records[0]?.id || "");
  }

  return (
    <section className={isOpen ? "flour-database-panel open" : "flour-database-panel"} id="flour-database" aria-label="Flour database">
      <button className="collapsible-section-header flour-database-header" type="button" onClick={() => setIsOpen((value) => !value)} aria-expanded={isOpen}>
        <Database size={21} />
        <span>
          <small>Flour database</small>
          <strong>Type-first flour field guide</strong>
          <em>{isOpen ? `${FLOUR_DATABASE_CATEGORIES.length} flour categories · brand records underneath each type` : "Collapsed · tap to compare flour types, brands, protein, ash, absorption, and strength"}</em>
        </span>
        <ChevronDown size={20} />
      </button>
      {isOpen ? (
        <div className="collapsible-section-body">
          <p className="flour-database-intro">
            Start with the flour type, then compare brand records. Protein, ash, absorption, and strength change fermentation speed, starter behavior, dough feel, and how much water a recipe can hold.
          </p>
          <div className="flour-type-tabs" role="tablist" aria-label="Flour types">
            {FLOUR_DATABASE_CATEGORIES.map((category) => (
              <button
                type="button"
                className={category.id === selectedCategory.id ? "selected" : ""}
                key={category.id}
                onClick={() => chooseCategory(category)}
                role="tab"
                aria-selected={category.id === selectedCategory.id}
              >
                <strong>{category.shortName}</strong>
                <span>{category.records.length} records</span>
              </button>
            ))}
          </div>
          <div className="flour-category-summary">
            <span>{selectedCategory.name}</span>
            <p>{selectedCategory.summary}</p>
            <small>{selectedCategory.science}</small>
          </div>
          <div className="flour-database-layout">
            <div className="flour-brand-tabs" role="tablist" aria-label={`${selectedCategory.name} brands`}>
              {selectedCategory.records.map((flour) => (
                <button
                  type="button"
                  className={flour.id === selected.id ? "selected" : ""}
                  key={flour.id}
                  onClick={() => setSelectedId(flour.id)}
                  role="tab"
                  aria-selected={flour.id === selected.id}
                >
                  <strong>{flour.brand}</strong>
                  <span>{flour.name}</span>
                </button>
              ))}
            </div>
            {selected ? (
              <div className="flour-database-detail">
                <div className="flour-spec-card">
                  <Wheat size={24} />
                  <div>
                    <span>{selectedCategory.name} · {selected.brand}</span>
                    <h3>{selected.name}</h3>
                    <p>{selected.style}</p>
                  </div>
                </div>
                <div className="flour-spec-grid">
                  <span><b>Protein</b>{selected.protein}</span>
                  <span><b>Ash</b>{selected.ash}</span>
                  <span><b>Absorption</b>{selected.absorption}</span>
                  <span><b>Strength</b>{selected.strength}</span>
                </div>
                <div className="flour-use-grid">
                  <article>
                    <h4><Lightbulb size={16} /> Recipe effect</h4>
                    <p>{selected.recipeEffect}</p>
                  </article>
                  <article>
                    <h4><Wheat size={16} /> Starter effect</h4>
                    <p>{selected.starterEffect}</p>
                  </article>
                  <article>
                    <h4><Droplets size={16} /> Adjustment</h4>
                    <p>{selected.adjustment}</p>
                  </article>
                </div>
                <div className="flour-database-footer">
                  <span>Use in recipe builder as <b>{profile.name}</b></span>
                  <small>{selected.sourceStatus}</small>
                  {selected.sourceUrl ? <a href={selected.sourceUrl} target="_blank" rel="noreferrer">Public record</a> : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function RecipeTypeSection({ recipes, type, onOpenRecipe }) {
  if (!recipes.length) return null;
  return (
    <details className="recipe-type-section">
      <summary className="collapsible-section-header recipe-type-header">
        <span className="recipe-type-symbol" aria-hidden="true">{type.icon}</span>
        <span>
          <small>Item type</small>
          <strong>{type.label}</strong>
          <em>{recipes.length} recipe{recipes.length === 1 ? "" : "s"} · {type.formulaMode === "bakers" ? "baker’s %" : "batch %"}</em>
        </span>
        <ChevronDown size={20} />
      </summary>
      <div className="recipe-type-body">
        {recipes.map((recipe) => (
          <button className="recipe-row" key={recipe.id} onClick={() => onOpenRecipe(recipe)}>
            <RecipeVisual recipe={recipe} />
            <span className="recipe-copy">
              <em>{productTypeLabel(recipe.productType)}</em>
              <strong>{recipe.name}</strong>
              <small>{recipe.note}</small>
              <span>{ratioLabelFor(recipe)} · {recipe.yield} {pluralUnit(unitNameFor(recipe), recipe.yield)} per base batch · from ${lowestSalesPrice(recipe).toFixed(2)}</span>
            </span>
            <ChevronRight size={19} />
          </button>
        ))}
      </div>
    </details>
  );
}

export default function RecipesPage({ bakerySettings, inventory, recipes, onDeleteRecipe, onSaveRecipe, setActive, onLogStarter }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [loaves, setLoaves] = useState(1);
  const [showEditor, setShowEditor] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState(() => recipeForm(null, bakerySettings));
  const [formError, setFormError] = useState("");
  const selected = recipes.find((recipe) => recipe.id === selectedId);
  const filtered = useMemo(
    () => recipes.filter((recipe) => recipe.name.toLowerCase().includes(query.toLowerCase())),
    [query, recipes],
  );
  const groupedRecipes = useMemo(() => (
    PRODUCT_TYPES.map((type) => ({
      type,
      recipes: filtered.filter((recipe) => productTypeFor(recipe).value === type.value),
    })).filter((group) => group.recipes.length)
  ), [filtered]);

  function openEditor(recipe) {
    setForm(recipeForm(recipe, bakerySettings));
    setFormError("");
    setShowEditor(true);
  }

  function updateIngredient(id, changes) {
    setForm((current) => refreshRecipeTiming({
      ...current,
      ingredients: current.ingredients.map((ingredient) => (
        ingredient.id === id ? { ...ingredient, ...changes } : ingredient
      )),
    }));
  }

  function submitRecipe(event) {
    event.preventDefault();
    if (!form.name.trim()) return;
    const formulaMode = formulaModeFor(form);
    const timelineSettings = normalizeTimelineSettings(form);
    const ingredientsForSave = sanitizeIngredientsForTimeline(form.ingredients, { ...form, timelineSettings });
    const flourTotal = ingredientsForSave.reduce((sum, ingredient) => (
      ingredient.category === "flour" ? sum + Number(ingredient.percent || 0) : sum
    ), 0);
    const batchTotal = ingredientsForSave.reduce((sum, ingredient) => sum + Number(ingredient.percent || 0), 0);
    if (formulaMode === "bakers" && Math.abs(flourTotal - 100) > 0.1) {
      setFormError(`Flour percentages must total 100%. They currently total ${flourTotal.toFixed(1)}%.`);
      return;
    }
    if (formulaMode === "batch" && Math.abs(batchTotal - 100) > 0.1) {
      setFormError(`Batch percentages must total 100%. They currently total ${batchTotal.toFixed(1)}%.`);
      return;
    }
    const liquidTotal = ingredientsForSave.reduce((sum, ingredient) => (
      ingredient.category === "liquid" ? sum + Number(ingredient.percent || 0) : sum
    ), 0);
    const baseWeight = Math.max(1, Number(form.baseWeight || form.flourWeight));
    onSaveRecipe({
      ...form,
      name: form.name.trim(),
      note: form.note.trim() || "Your custom house formula",
      productType: form.productType || "bread",
      formulaMode,
      photoUrl: form.photoUrl?.trim() || "",
      photoAlt: form.photoAlt?.trim() || form.name.trim(),
      available: form.available !== false,
      soldOut: form.soldOut === true,
      unavailableThisWeek: form.unavailableThisWeek === true,
      hiddenThisWeek: form.hiddenThisWeek === true,
      availabilityNote: form.availabilityNote?.trim() || "",
      badges: Array.isArray(form.badges) ? form.badges : [],
      timelineSettings,
      yield: Number(form.yield),
      unitName: form.unitName.trim() || "item",
      hydration: liquidTotal,
      salesOptions: form.salesOptions.map((option, index) => ({
        id: option.id || `sale-option-${index + 1}`,
        label: option.label.trim() || `Option ${index + 1}`,
        units: Math.max(0.5, Number(option.units || 1)),
        price: Math.max(0, Number(option.price || 0)),
        capacityUnits: Math.max(0, Math.min(6, Number(option.capacityUnits ?? 1))),
      })),
      price: Math.min(...form.salesOptions.map((option) => Math.max(0, Number(option.price || 0)))),
      flourWeight: baseWeight,
      baseWeight,
      ingredients: ingredientsForSave.map(({ id, key, ...ingredient }) => ({
        ...ingredient,
        name: ingredient.category === "flour"
          ? getFlourProfile(ingredient.flourType || ingredient.name).name
          : ingredient.name.trim(),
        flourType: ingredient.category === "flour"
          ? getFlourProfile(ingredient.flourType || ingredient.name).name
          : undefined,
        percent: Number(ingredient.percent),
        weight: Math.round(baseWeight * Number(ingredient.percent) / 100),
      })),
    });
    setShowEditor(false);
  }

  if (selected) {
    const formulaMode = formulaModeFor(selected);
    const unitName = unitNameFor(selected);
    const factor = loaves / selected.yield;
    const total = selected.ingredients.reduce((sum, item) => sum + Math.round(item.weight * factor), 0);
    const batchCost = selected.ingredients.reduce((sum, ingredient) => (
      sum + inventoryCostForIngredient(ingredient, Number(ingredient.weight) * factor, inventory)
    ), 0);
    const salesOptions = normalizedSalesOptions(selected);
    const price = lowestSalesPrice(selected);
    const ingredientCostPerLoaf = batchCost / Math.max(1, loaves);
    const selectedFlours = selected.ingredients.filter((ingredient) => ingredientCategory(ingredient) === "flour");
    const methodNotes = defaultMethodNotes(selected);
    return (
      <main className="page recipe-detail">
        <button className="text-back" onClick={() => setSelectedId(null)}>← Recipes</button>
        <div className="recipe-detail-heading">
          <RecipeVisual recipe={selected} large />
          <div><span className="recipe-type-pill">{productTypeLabel(selected.productType)}</span><h1>{selected.name}</h1><p>{selected.note}</p></div>
        </div>
        <div className="recipe-facts">
          <span><Droplets size={17} /> {ratioLabelFor(selected)}</span>
          <span>From ${price.toFixed(2)}</span>
          <span>{selected.yield} {pluralUnit(unitName, selected.yield)} / base batch</span>
          <span>{selected.available === false ? "Unavailable this week" : "Available this week"}</span>
          <button className="inline-edit-button" type="button" onClick={() => openEditor(selected)}><Pencil size={14} /> Edit recipe</button>
        </div>
        <section className="recipe-package-pricing">
          <div className="section-title-line">
            <div><span className="eyebrow-label dark">Customer menu</span><h2>Package pricing</h2></div>
            <Package size={19} />
          </div>
          <div className="recipe-package-list">
            {salesOptions.map((option) => (
              <div key={option.id}>
                <span><strong>{option.label}</strong><small>{option.units} {pluralUnit(unitName, option.units)} · {option.capacityUnits} bake slot{option.capacityUnits === 1 ? "" : "s"}</small></span>
                <strong>${option.price.toFixed(2)}</strong>
              </div>
            ))}
          </div>
        </section>
        <div className="section-title-line">
          <h2>{formulaMode === "batch" ? "Batch formula" : "Formula"}</h2>
          <div className="compact-stepper">
            <button onClick={() => setLoaves((value) => Math.max(1, value - 1))}>−</button>
            <span>{loaves} {pluralUnit(unitName, loaves)}</span>
            <button onClick={() => setLoaves((value) => Math.min(40, value + 1))}>+</button>
          </div>
        </div>
        <div className="formula-table large">
          <div className="formula-head"><span>Ingredient</span><span>Weight</span><span>{formulaMode === "batch" ? "Batch %" : "Baker’s %"}</span></div>
          {selected.ingredients.map((item, index) => (
            <div className="formula-row" key={`${item.name}-${index}`}>
              <span>{item.name}</span>
              <span>{Math.round(item.weight * factor).toLocaleString()} g</span>
              <span>{item.percent}%</span>
            </div>
          ))}
          <div className="formula-row total"><span>Total dough</span><span>{total.toLocaleString()} g</span><span /></div>
        </div>
        <section className="recipe-cost-card">
          <CircleDollarSign size={20} />
          <div>
            <span>Matched inventory cost</span>
            <strong>${batchCost.toFixed(2)} batch · ${ingredientCostPerLoaf.toFixed(2)} / {unitName}</strong>
            <small>Estimated gross margin from ${(price - ingredientCostPerLoaf).toFixed(2)} per base unit. Ingredients match inventory by name.</small>
          </div>
        </section>
        {selectedFlours.length ? (
          <section className="recipe-flour-science">
            <div className="section-title-line">
              <div><span className="eyebrow-label dark">Research-informed tendencies</span><h2>Flour behavior</h2></div>
            </div>
            <FlourBlendScience flours={selectedFlours.map((ingredient) => ingredient.flourType || ingredient.name)} />
            <p className="model-note">The multipliers are planning heuristics. Your flour brand, extraction, crop, milling, temperature, and starter ecology can shift the result.</p>
          </section>
        ) : null}
        <section className="method-notes">
          <h2>Production notes</h2>
          <ol>
            {methodNotes.map(([step, note]) => <li key={step}><b>{step}</b><span>{note}</span></li>)}
          </ol>
        </section>
        {confirmDelete ? (
          <div className="delete-confirmation recipe-delete-confirmation">
            <span>Delete “{selected.name}” permanently?</span>
            <div>
              <button type="button" className="text-button" onClick={() => setConfirmDelete(false)}>Keep recipe</button>
              <button type="button" className="danger-button" onClick={() => {
                onDeleteRecipe(selected.id);
                setSelectedId(null);
                setConfirmDelete(false);
              }}>Delete recipe</button>
            </div>
          </div>
        ) : (
          <button className="delete-order-button" type="button" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={15} />
            Delete this recipe
          </button>
        )}
        {showEditor ? (
          <RecipeEditor
            form={form}
            formError={formError}
            onClose={() => setShowEditor(false)}
            onSubmit={submitRecipe}
            setFormError={setFormError}
            setForm={setForm}
            bakerySettings={bakerySettings}
            updateIngredient={updateIngredient}
          />
        ) : null}
      </main>
    );
  }

  return (
    <main className="page">
      <PageHeading
        title="Recipes"
        subtitle="Bread, cakes, sauces, vinegars, oils, and any other small-batch item you want to sell."
        action={<button className="round-action" onClick={() => openEditor()} aria-label="Add recipe"><Plus size={21} /></button>}
      />
      <label className="search-field full">
        <Search size={17} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search recipes" />
      </label>
      <FlourDatabase />
      <section className="recipe-list">
        {groupedRecipes.length ? groupedRecipes.map((group) => (
          <RecipeTypeSection
            key={group.type.value}
            recipes={group.recipes}
            type={group.type}
            onOpenRecipe={(recipe) => {
              setSelectedId(recipe.id);
              setLoaves(recipe.yield);
            }}
          />
        )) : <EmptyState title={recipes.length ? "No matching recipes" : "No recipes yet"} body={recipes.length ? "Try another recipe name." : "Use the plus button to add your first formula."} />}
      </section>
      <aside className="bakers-percent-note">
        <Droplets size={21} />
        <div>
          <h3>Baker’s percentage, without the math headache</h3>
          <p>Add flours, liquids, yeast, starters, inclusions, salt, cultures, oils, produce, and spices. Bread and yeast breads can stay in baker’s %, while non-bread items can use batch %.</p>
        </div>
      </aside>
      {showEditor ? (
        <RecipeEditor
          form={form}
          formError={formError}
          onClose={() => setShowEditor(false)}
          onSubmit={submitRecipe}
          setFormError={setFormError}
          setForm={setForm}
          bakerySettings={bakerySettings}
          updateIngredient={updateIngredient}
        />
      ) : null}
    </main>
  );
}

function RecipeEditor({ bakerySettings, form, formError, onClose, onSubmit, setForm, setFormError, updateIngredient }) {
  const [ingredientEntryMode, setIngredientEntryMode] = useState("grams");
  const formulaMode = formulaModeFor(form);
  const activeBaseWeight = formulaBaseFor(form);
  const timelineSettings = normalizeTimelineSettings(form);
  const allowsStarterIngredient = recipeAllowsStarterIngredient({ ...form, timelineSettings });
  const yeastTimingSuggestion = form.productType === "yeast" ? suggestYeastTimeline(form) : null;
  const flourTotal = form.ingredients.reduce((sum, ingredient) => (
    ingredient.category === "flour" ? sum + Number(ingredient.percent || 0) : sum
  ), 0);
  const batchTotal = form.ingredients.reduce((sum, ingredient) => sum + Number(ingredient.percent || 0), 0);
  const hydration = form.ingredients.reduce((sum, ingredient) => (
    ingredient.category === "liquid" ? sum + Number(ingredient.percent || 0) : sum
  ), 0);
  const productType = productTypeFor(form);
  const photoUrl = String(form.photoUrl || "").trim();

  function updateIngredientWeight(ingredientId, nextWeight) {
    setForm((current) => refreshRecipeTiming(recalculateFormulaFromWeights(current, ingredientId, nextWeight)));
  }

  function updateTimelineSetting(key, value) {
    setForm((current) => {
      const manualTimingOverride = ["primaryRiseHours", "finalProofHours"].includes(key);
      const nextSettings = normalizeTimelineSettings({
        ...current,
        timelineSettings: {
          ...current.timelineSettings,
          ...(manualTimingOverride ? { autoYeastTiming: false } : {}),
          [key]: value,
        },
      });
      return {
        ...current,
        timelineSettings: nextSettings,
        ingredients: sanitizeIngredientsForTimeline(current.ingredients, {
          ...current,
          timelineSettings: nextSettings,
        }),
      };
    });
  }

  function toggleAutoYeastTiming(checked) {
    setForm((current) => {
      const next = {
        ...current,
        timelineSettings: normalizeTimelineSettings({
          ...current,
          timelineSettings: {
            ...current.timelineSettings,
            autoYeastTiming: checked,
          },
        }),
      };
      return checked ? refreshRecipeTiming(next, { force: true }) : next;
    });
  }

  function applyYeastSuggestion() {
    setForm((current) => refreshRecipeTiming({
      ...current,
      timelineSettings: {
        ...current.timelineSettings,
        autoYeastTiming: true,
      },
    }, { force: true }));
  }

  async function handlePhotoFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setFormError("");
      const photoDataUrl = await resizeImageFile(file);
      setForm((current) => ({
        ...current,
        photoUrl: photoDataUrl,
        photoAlt: current.photoAlt || current.name || file.name.replace(/\.[^.]+$/, ""),
      }));
    } catch (error) {
      setFormError(error.message);
    } finally {
      event.target.value = "";
    }
  }

  return (
    <Modal title={form.isNew ? "Add a recipe" : `Edit ${form.name}`} onClose={onClose}>
      <form className="form-stack recipe-editor-form" onSubmit={onSubmit}>
        <label>
          Recipe name
          <input autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Rosemary sea salt" />
        </label>
        <label>
          Short note
          <input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Fragrant · savory · weekend loaf" />
        </label>
        <div className="form-grid">
          <label>
            Product category
            <select value={form.productType || "bread"} onChange={(event) => {
                const nextType = productTypeSettingsFor(bakerySettings, event.target.value);
                setForm((current) => {
                  const shouldSwapTemplate = isUntouchedDefaultFormula(current);
                  const nextTimelineSettings = defaultTimelineSettingsForProductType(nextType.value);
                  const currentUnit = String(current.unitName || "").toLowerCase();
                const shouldUseTypeUnit = !currentUnit || TYPE_DEFAULT_UNITS.has(currentUnit);
                const shouldSwapPackages = current.isNew || current.salesOptions.every((option) => (
                  String(option.id || "").startsWith("type-preset-") || option.id === "default"
                ));
                const nextSalesOptions = shouldSwapPackages
                  ? salesOptionsForProductType(bakerySettings, nextType.value)
                  : current.salesOptions.map((option, index) => (
                    index === 0 && shouldUseTypeUnit ? {
                      ...option,
                      label: nextType.unitName === "loaf" ? "Loaf" : `Each ${nextType.unitName}`,
                    } : option
                  ));
                const nextIngredients = shouldSwapTemplate ? defaultIngredientsForType(nextType.value) : current.ingredients;
                return refreshRecipeTiming({
                  ...current,
                  productType: nextType.value,
                  formulaMode: nextType.formulaMode,
                  timelineSettings: nextTimelineSettings,
                  unitName: shouldUseTypeUnit ? nextType.unitName : current.unitName,
                  salesOptions: nextSalesOptions,
                  ingredients: sanitizeIngredientsForTimeline(nextIngredients, {
                    ...current,
                    productType: nextType.value,
                    timelineSettings: nextTimelineSettings,
                  }),
                }, { force: nextType.value === "yeast" });
              });
            }}>
              {PRODUCT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.icon} {type.label}</option>)}
            </select>
          </label>
          <label>
            Formula style
            <select value={formulaMode} onChange={(event) => setForm((current) => ({ ...current, formulaMode: event.target.value }))}>
              <option value="bakers">Baker’s % — flours total 100%</option>
              <option value="batch">Batch % — all ingredients total 100%</option>
            </select>
          </label>
        </div>
        <section className="recipe-timeline-settings">
          <div className="ingredient-editor-heading">
            <div>
              <strong>Timeline + Kitchen planner</strong>
              <small>Choose which calculated steps this recipe should use on Bake, Kitchen, and Today.</small>
            </div>
          </div>
          <div className="timeline-toggle-grid">
            <label className="timeline-check">
              <input
                type="checkbox"
                disabled={form.productType === "yeast"}
                checked={timelineSettings.useStarter}
                onChange={(event) => updateTimelineSetting("useStarter", event.target.checked)}
              />
              <span><strong>Use starter / levain</strong><small>{form.productType === "yeast" ? "Starter is locked off for yeast breads." : "Adds starter feed timing and levain ratio controls."}</small></span>
            </label>
            <label className="timeline-check">
              <input
                type="checkbox"
                disabled={!timelineSettings.useStarter}
                checked={timelineSettings.includeStarterFeed}
                onChange={(event) => updateTimelineSetting("includeStarterFeed", event.target.checked)}
              />
              <span><strong>Starter feed reminder</strong><small>Add feed timing before mix when this recipe uses starter.</small></span>
            </label>
            <label className="timeline-check">
              <input
                type="checkbox"
                disabled={!timelineSettings.useStarter}
                checked={timelineSettings.useBulkFermentRules}
                onChange={(event) => updateTimelineSetting("useBulkFermentRules", event.target.checked)}
              />
              <span><strong>Apply sourdough bulk rules</strong><small>Uses temp, hydration, flour behavior, and starter strength.</small></span>
            </label>
            <label className="timeline-check">
              <input
                type="checkbox"
                checked={timelineSettings.includeStretchFolds}
                onChange={(event) => updateTimelineSetting("includeStretchFolds", event.target.checked)}
              />
              <span><strong>Stretch & folds</strong><small>Show fold checkpoints in Kitchen and planner timelines.</small></span>
            </label>
            <label className="timeline-check">
              <input
                type="checkbox"
                checked={timelineSettings.includeShape}
                onChange={(event) => updateTimelineSetting("includeShape", event.target.checked)}
              />
              <span><strong>Shape step</strong><small>Turn off for pan pours, sauces, oils, or no-shape workflows.</small></span>
            </label>
            <label className="timeline-check">
              <input
                type="checkbox"
                checked={timelineSettings.includeFinalProof}
                onChange={(event) => updateTimelineSetting("includeFinalProof", event.target.checked)}
              />
              <span><strong>Final proof / second rise</strong><small>Useful for yeast breads after shaping.</small></span>
            </label>
            <label className="timeline-check">
              <input
                type="checkbox"
                checked={timelineSettings.includeColdProof}
                onChange={(event) => updateTimelineSetting("includeColdProof", event.target.checked)}
              />
              <span><strong>Cold proof</strong><small>Keep for retarded sourdough; off by default for yeast breads.</small></span>
            </label>
            <label className="timeline-check">
              <input
                type="checkbox"
                checked={timelineSettings.includePreheat}
                onChange={(event) => updateTimelineSetting("includePreheat", event.target.checked)}
              />
              <span><strong>Preheat reminder</strong><small>Add or remove oven preheat from generated schedules.</small></span>
            </label>
          </div>
          <div className="timeline-number-grid">
            <label>
              Main step name
              <input value={timelineSettings.primaryLabel} onChange={(event) => updateTimelineSetting("primaryLabel", event.target.value)} placeholder="Rise, bulk ferment, prep" />
            </label>
            <label>
              Fixed rise hours
              <input type="number" min="0.25" max="24" step="0.25" value={timelineSettings.primaryRiseHours} onChange={(event) => updateTimelineSetting("primaryRiseHours", Number(event.target.value))} />
            </label>
            <label>
              Fold count
              <input type="number" min="0" max="12" value={timelineSettings.stretchFoldCount} disabled={!timelineSettings.includeStretchFolds} onChange={(event) => updateTimelineSetting("stretchFoldCount", Number(event.target.value))} />
            </label>
            <label>
              Fold spacing min
              <input type="number" min="5" max="360" step="5" value={timelineSettings.foldIntervalMinutes} disabled={!timelineSettings.includeStretchFolds} onChange={(event) => updateTimelineSetting("foldIntervalMinutes", Number(event.target.value))} />
            </label>
            <label>
              First fold after min
              <input type="number" min="0" max="360" step="5" value={timelineSettings.firstFoldMinutes} disabled={!timelineSettings.includeStretchFolds} onChange={(event) => updateTimelineSetting("firstFoldMinutes", Number(event.target.value))} />
            </label>
            <label>
              Shape minutes
              <input type="number" min="0" max="240" step="5" value={timelineSettings.shapeMinutes} disabled={!timelineSettings.includeShape} onChange={(event) => updateTimelineSetting("shapeMinutes", Number(event.target.value))} />
            </label>
            <label>
              Final proof hours
              <input type="number" min="0" max="24" step="0.25" value={timelineSettings.finalProofHours} disabled={!timelineSettings.includeFinalProof} onChange={(event) => updateTimelineSetting("finalProofHours", Number(event.target.value))} />
            </label>
            <label>
              Cold proof hours
              <input type="number" min="0" max="72" step="0.5" value={timelineSettings.defaultColdProofHours} disabled={!timelineSettings.includeColdProof} onChange={(event) => updateTimelineSetting("defaultColdProofHours", Number(event.target.value))} />
            </label>
            <label>
              Preheat minutes
              <input type="number" min="0" max="180" step="5" value={timelineSettings.preheatMinutes} disabled={!timelineSettings.includePreheat} onChange={(event) => updateTimelineSetting("preheatMinutes", Number(event.target.value))} />
            </label>
          </div>
          {yeastTimingSuggestion ? (
            <div className="yeast-timing-suggestion">
              <div>
                <span className="eyebrow-label dark">Yeast timing science</span>
                <strong>{yeastTimingSuggestion.firstRiseHours}h rise · {yeastTimingSuggestion.finalProofHours}h final proof</strong>
                <p>{yeastTimingSuggestion.summary} Baseline assumes a 76°F dough; Bake/Kitchen still adjust for the dough temp you enter there.</p>
              </div>
              <div className="yeast-timing-actions">
                <label>
                  <input
                    type="checkbox"
                    checked={timelineSettings.autoYeastTiming}
                    onChange={(event) => toggleAutoYeastTiming(event.target.checked)}
                  />
                  Auto-update from formula
                </label>
                <button type="button" onClick={applyYeastSuggestion}>Apply suggestion</button>
              </div>
              <div className="yeast-factor-pills">
                {yeastTimingSuggestion.reasons.map((reason) => (
                  <span className={reason.tone} key={reason.label}>
                    <strong>{reason.label}</strong>
                    <small>{reason.value}</small>
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </section>
        <div className="recipe-photo-editor">
          <div className="recipe-photo-preview">
            {photoUrl ? <img src={photoUrl} alt={form.photoAlt || form.name || "Recipe preview"} /> : <span>{productType.icon}</span>}
          </div>
          <div className="recipe-photo-fields">
            <label>
              Recipe photo URL
              <input
                value={photoUrl.startsWith("data:") ? "" : photoUrl}
                onChange={(event) => setForm({ ...form, photoUrl: event.target.value })}
                placeholder="https://… or upload below"
              />
            </label>
            <label>
              Upload photo
              <input type="file" accept="image/*" onChange={handlePhotoFile} />
            </label>
            <label>
              Photo description
              <input value={form.photoAlt || ""} onChange={(event) => setForm({ ...form, photoAlt: event.target.value })} placeholder="Chocolate cake on a cooling rack" />
            </label>
            {photoUrl ? <button type="button" className="small-action-button" onClick={() => setForm({ ...form, photoUrl: "", photoAlt: "" })}>Clear photo</button> : null}
          </div>
        </div>
        <section className="recipe-sales-state-editor">
          <div className="ingredient-editor-heading">
            <div><strong>Customer menu status</strong><small>Control what shoppers see this week before you publish.</small></div>
          </div>
          <label className="recipe-availability-toggle">
            <input
              type="checkbox"
              checked={form.available !== false}
              onChange={(event) => setForm({ ...form, available: event.target.checked })}
            />
            <span>{form.available !== false ? "Available to order this week" : "Sold out / unavailable this week"}</span>
          </label>
          <label>
            Availability note
            <input
              value={form.availabilityNote || ""}
              onChange={(event) => setForm({ ...form, availabilityNote: event.target.value })}
              placeholder={form.available === false ? "Example: Sold out until next bake day" : "Optional note customers can see"}
            />
          </label>
          <fieldset className="recipe-badge-picker">
            <legend>Product badges</legend>
            <div>
              {PRODUCT_BADGE_OPTIONS.map((badge) => {
                const selected = (form.badges || []).includes(badge.value);
                return (
                  <label className={selected ? "selected" : ""} key={badge.value}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(event) => setForm((current) => ({
                        ...current,
                        badges: event.target.checked
                          ? [...(current.badges || []), badge.value]
                          : (current.badges || []).filter((item) => item !== badge.value),
                      }))}
                    />
                    {badge.label}
                  </label>
                );
              })}
            </div>
          </fieldset>
        </section>
        <div className="form-grid">
          <label>Base batch yield<input type="number" min="1" max="120" value={form.yield} onChange={(event) => setForm({ ...form, yield: Number(event.target.value) })} /></label>
          <label>Item name<input value={form.unitName} onChange={(event) => setForm({ ...form, unitName: event.target.value })} placeholder="loaf, bagel, bun" /></label>
        </div>
        <div className="package-pricing-editor">
          <div className="ingredient-editor-heading">
            <div><strong>Package pricing</strong><small>Offer singles, half dozens, dozens, loaves, or custom packs.</small></div>
            <button type="button" onClick={() => setForm((current) => ({
              ...current,
              salesOptions: [...current.salesOptions, {
                id: `sale-option-${Date.now()}`,
                label: "Half dozen",
                units: 6,
                price: 15,
                capacityUnits: 1,
              }],
            }))}><Plus size={15} /> Package</button>
          </div>
          <div className="package-pricing-list">
            {form.salesOptions.map((option) => (
              <div className="package-pricing-row" key={option.id}>
                <label>
                  Package
                  <select value={SALES_OPTION_PRESETS.some((preset) => preset.label === option.label) ? option.label : "Custom pack"} onChange={(event) => {
                    const preset = SALES_OPTION_PRESETS.find((item) => item.label === event.target.value);
                    setForm((current) => ({
                      ...current,
                      salesOptions: current.salesOptions.map((item) => item.id === option.id ? {
                        ...item,
                        label: preset.label,
                        units: preset.units,
                      } : item),
                    }));
                  }}>
                    {SALES_OPTION_PRESETS.map((preset) => <option key={preset.label}>{preset.label}</option>)}
                  </select>
                </label>
                <label>
                  Label
                  <input value={option.label} onChange={(event) => setForm((current) => ({
                    ...current,
                    salesOptions: current.salesOptions.map((item) => item.id === option.id ? { ...item, label: event.target.value } : item),
                  }))} />
                </label>
                <label>
                  Items
                  <input type="number" min="0.5" max="120" step="0.5" value={option.units} onChange={(event) => setForm((current) => ({
                    ...current,
                    salesOptions: current.salesOptions.map((item) => item.id === option.id ? { ...item, units: Number(event.target.value) } : item),
                  }))} />
                </label>
                <label>
                  Price
                  <input type="number" min="0" step="0.25" value={option.price} onChange={(event) => setForm((current) => ({
                    ...current,
                    salesOptions: current.salesOptions.map((item) => item.id === option.id ? { ...item, price: Number(event.target.value) } : item),
                  }))} />
                </label>
                <label>
                  Bake slots
                  <input type="number" min="0" max="6" value={option.capacityUnits} onChange={(event) => setForm((current) => ({
                    ...current,
                    salesOptions: current.salesOptions.map((item) => item.id === option.id ? { ...item, capacityUnits: Number(event.target.value) } : item),
                  }))} />
                </label>
                <button type="button" className="remove-ingredient-button" aria-label={`Remove ${option.label} package`} disabled={form.salesOptions.length <= 1} onClick={() => setForm((current) => ({
                  ...current,
                  salesOptions: current.salesOptions.filter((item) => item.id !== option.id),
                }))}><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
          <p className="form-help">“Bake slots” controls the six-per-day capacity. Example: one half-dozen bagel package can use one bake slot; use 0 for goods that should not reserve oven capacity.</p>
        </div>
        <label>
          {formulaMode === "batch" ? "Total base batch weight (g)" : "Total flour in base batch (g)"}
          <input
            type="number"
            min="100"
            step="50"
            value={form.baseWeight || form.flourWeight}
            onChange={(event) => setForm({ ...form, baseWeight: Number(event.target.value), flourWeight: Number(event.target.value) })}
          />
        </label>
        <div className="ingredient-entry-mode-card">
          <div>
            <strong>Ingredient entry</strong>
            <small>
              {ingredientEntryMode === "grams"
                ? (formulaMode === "batch"
                  ? "Type grams and the app recalculates batch % from the total batch weight."
                  : "Type grams and the app recalculates baker’s % from your flour grams.")
                : "Type percentages and the app shows the matching grams for this base batch."}
            </small>
          </div>
          <div className="entry-mode-toggle" role="group" aria-label="Ingredient entry mode">
            <button
              type="button"
              className={ingredientEntryMode === "grams" ? "selected" : ""}
              onClick={() => setIngredientEntryMode("grams")}
            >
              Grams
            </button>
            <button
              type="button"
              className={ingredientEntryMode === "percent" ? "selected" : ""}
              onClick={() => setIngredientEntryMode("percent")}
            >
              %
            </button>
          </div>
        </div>
        <div className="ingredient-editor-heading">
          <div>
            <strong>Ingredients</strong>
            <small>
              {formulaMode === "batch"
                ? `Batch total ${batchTotal.toFixed(1)}% · ${Math.round(activeBaseWeight).toLocaleString()}g`
                : `Flours total ${flourTotal.toFixed(1)}% · hydration ${hydration.toFixed(1)}% · ${Math.round(activeBaseWeight).toLocaleString()}g flour`}
            </small>
          </div>
          <span className="ingredient-add-actions">
            <button type="button" aria-label="Add flour" onClick={() => setForm((current) => {
              const id = `ingredient-flour-${Date.now()}`;
              const ingredient = {
                id,
                name: "Whole wheat",
                flourType: "Whole wheat",
                category: "flour",
                percent: ingredientEntryMode === "grams" ? 0 : 10,
              };
              const next = {
                ...current,
                ingredients: [...current.ingredients, ingredient],
              };
              return ingredientEntryMode === "grams"
                ? refreshRecipeTiming(recalculateFormulaFromWeights(next, id, formulaBaseFor(current) * 0.1))
                : refreshRecipeTiming(next);
            })}><Wheat size={14} /> Flour</button>
            <button type="button" aria-label="Add other ingredient" onClick={() => setForm((current) => {
              const id = `ingredient-${Date.now()}`;
              const currentFormulaMode = formulaModeFor(current);
              const ingredient = {
                id,
                name: "",
                category: currentFormulaMode === "batch" ? "other" : "inclusion",
                percent: ingredientEntryMode === "grams"
                  ? 0
                  : (currentFormulaMode === "batch" ? Math.max(0, 100 - batchTotal) : 5),
              };
              const next = {
                ...current,
                ingredients: [...current.ingredients, ingredient],
              };
              return ingredientEntryMode === "grams"
                ? refreshRecipeTiming(recalculateFormulaFromWeights(next, id, formulaBaseFor(current) * 0.05))
                : refreshRecipeTiming(next);
            })}><Plus size={15} /> Other</button>
          </span>
        </div>
        <div className="ingredient-editor-list">
          {form.ingredients.map((ingredient) => {
            const ingredientWeight = ingredientWeightFromPercent(ingredient, activeBaseWeight);
            const categoryOptions = allowsStarterIngredient
              ? INGREDIENT_CATEGORIES
              : INGREDIENT_CATEGORIES.filter((category) => category.value !== "starter");
            return (
              <div className="ingredient-editor-row" key={ingredient.id}>
                {ingredient.category === "flour" ? (
                  <select className="ingredient-name-control" aria-label={`${ingredient.flourType || ingredient.name} flour type`} value={ingredient.flourType || getFlourProfile(ingredient.name).name} onChange={(event) => updateIngredient(ingredient.id, { name: event.target.value, flourType: event.target.value })}>
                    {FLOUR_PROFILES.map((profile) => <option value={profile.name} key={profile.name}>{profile.name}</option>)}
                  </select>
                ) : (
                  <input className="ingredient-name-control" aria-label="Ingredient name" value={ingredient.name} onChange={(event) => updateIngredient(ingredient.id, { name: event.target.value })} placeholder="Ingredient" required />
                )}
                <select className="ingredient-category-control" aria-label={`${ingredient.name || "Ingredient"} category`} value={ingredient.category} onChange={(event) => {
                  const nextCategory = event.target.value;
                  const currentWeight = ingredientWeightFromPercent(ingredient, activeBaseWeight);
                  setForm((current) => {
                    const next = {
                      ...current,
                      ingredients: current.ingredients.map((item) => item.id === ingredient.id ? {
                        ...item,
                        category: nextCategory,
                        ...(nextCategory === "flour" ? { name: "Bread flour", flourType: "Bread flour" } : { flourType: undefined }),
                      } : item),
                    };
                    return ingredientEntryMode === "grams"
                      ? refreshRecipeTiming(recalculateFormulaFromWeights(next, ingredient.id, currentWeight))
                      : refreshRecipeTiming(next);
                  });
                }}>
                  {categoryOptions.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                </select>
                {ingredientEntryMode === "grams" ? (
                  <label className="ingredient-measure-control">
                    <span>Grams</span>
                    <input
                      aria-label={`${ingredient.name || "Ingredient"} grams`}
                      type="number"
                      min="0"
                      step="1"
                      value={roundForInput(ingredientWeight)}
                      onChange={(event) => updateIngredientWeight(ingredient.id, event.target.value)}
                    />
                    <small>{percentForDisplay(ingredient.percent)}%</small>
                  </label>
                ) : (
                  <label className="ingredient-measure-control">
                    <span>{formulaMode === "batch" ? "Batch %" : "Baker’s %"}</span>
                    <input
                      aria-label={`${ingredient.name || "Ingredient"} percent`}
                      type="number"
                      min="0"
                      step="0.1"
                      value={ingredient.percent}
                      onChange={(event) => updateIngredient(ingredient.id, { percent: Number(event.target.value) })}
                    />
                    <small>{Math.round(ingredientWeight).toLocaleString()}g</small>
                  </label>
                )}
                <button type="button" className="remove-ingredient-button" aria-label={`Remove ${ingredient.name || "ingredient"}`} disabled={form.ingredients.length <= 1} onClick={() => setForm((current) => refreshRecipeTiming({
                  ...current,
                  ingredients: current.ingredients.filter((item) => item.id !== ingredient.id),
                }))}><Trash2 size={15} /></button>
              </div>
            );
          })}
        </div>
        {form.ingredients.some((ingredient) => ingredient.category === "flour") ? <div className="recipe-builder-science">
          <div className="section-title-line"><h3>What these flours change</h3><span>Dough + starter</span></div>
          <FlourBlendScience compact flours={form.ingredients.filter((ingredient) => ingredient.category === "flour").map((ingredient) => ingredient.flourType || ingredient.name)} />
        </div> : null}
        {formError ? <p className="form-error" role="alert">{formError}</p> : null}
        <p className="form-help">
          {formulaMode === "batch"
            ? "Batch % is best for hot sauces, vinegars, oils, and non-flour items. All ingredient percentages should total 100%."
            : "Mark every flour as “Flour.” Those flour percentages must total 100%; all other ingredients use that flour weight as their baker’s-percentage base."}
        </p>
        <button className="primary-button" type="submit">{form.isNew ? "Add recipe" : "Save recipe changes"}</button>
      </form>
    </Modal>
  );
}
