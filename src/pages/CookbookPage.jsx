import { useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Camera,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  ExternalLink,
  FileText,
  Link2,
  ListPlus,
  Minus,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  ShoppingBasket,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { usePersistentState } from "../hooks/usePersistentState";

const STORAGE_KEY = "loafers-cookbook-v1";
const TYPES = ["All types", "Bread", "Yeast bread", "Breakfast", "Main", "Side", "Dessert", "Sauce", "Drink", "Other"];
const CATEGORIES = ["All categories", "Baking", "Weeknight", "Family", "Seasonal", "Holiday", "Pantry", "Favorites"];

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function titleFromText(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)
    ?.replace(/^#+\s*/, "") || "Untitled recipe";
}

function nextId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeIngredient(ingredient = {}) {
  return {
    id: ingredient.id || nextId("ingredient"),
    name: ingredient.name || "Ingredient",
    amount: toNumber(ingredient.amount ?? ingredient.weight, 0),
    unit: ingredient.unit || (ingredient.weight ? "g" : ""),
    note: ingredient.note || "",
  };
}

function starterCookbook(recipes = []) {
  const bakeryRecipes = recipes.slice(0, 12).map((recipe) => ({
    id: `bakery-${recipe.id}`,
    name: recipe.name,
    type: recipe.productType === "cake" ? "Dessert" : recipe.productType?.includes("sauce") ? "Sauce" : "Bread",
    category: "Baking",
    servings: toNumber(recipe.yield, 1),
    sourceUrl: "",
    photo: recipe.photo || recipe.image || "",
    notes: recipe.note || "Imported from your Loafers product catalog.",
    temps: recipe.hydration ? `Hydration ${recipe.hydration}%` : "",
    ingredients: (recipe.ingredients || []).map(normalizeIngredient),
    steps: recipe.steps?.length ? recipe.steps : ["Review the original bakery recipe and add your preferred home-kitchen method."],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
  return {
    recipes: bakeryRecipes,
    plans: [],
    manualShopping: [],
  };
}

const UNICODE_FRACTIONS = {
  "¼": "1/4",
  "½": "1/2",
  "¾": "3/4",
  "⅓": "1/3",
  "⅔": "2/3",
  "⅛": "1/8",
  "⅜": "3/8",
  "⅝": "5/8",
  "⅞": "7/8",
};

const UNIT_ALIASES = [
  [/^(?:cups?|c\.?)(?=\s|$)/i, "cup"],
  [/^(?:tablespoons?|tbsp\.?|tbs\.?)(?=\s|$)/i, "tbsp"],
  [/^(?:teaspoons?|tsp\.?)(?=\s|$)/i, "tsp"],
  [/^(?:ounces?|oz\.?)(?=\s|$)/i, "oz"],
  [/^(?:pounds?|lbs?\.?)(?=\s|$)/i, "lb"],
  [/^(?:kilograms?|kgs?|kg)(?=\s|$)/i, "kg"],
  [/^(?:grams?|g)(?=\s|$)/i, "g"],
  [/^(?:millilit(?:ers?|res?)|ml)(?=\s|$)/i, "ml"],
  [/^(?:lit(?:ers?|res?)|l)(?=\s|$)/i, "l"],
  [/^(?:cloves?)(?=\s|$)/i, "clove"],
  [/^(?:cans?)(?=\s|$)/i, "can"],
  [/^(?:jars?)(?=\s|$)/i, "jar"],
  [/^(?:bottles?)(?=\s|$)/i, "bottle"],
  [/^(?:packages?|pkgs?\.?|packs?)(?=\s|$)/i, "package"],
  [/^(?:containers?)(?=\s|$)/i, "container"],
  [/^(?:sticks?)(?=\s|$)/i, "stick"],
  [/^(?:slices?)(?=\s|$)/i, "slice"],
  [/^(?:pieces?)(?=\s|$)/i, "piece"],
  [/^(?:pinch(?:es)?)(?=\s|$)/i, "pinch"],
  [/^(?:bunch(?:es)?)(?=\s|$)/i, "bunch"],
  [/^(?:heads?)(?=\s|$)/i, "head"],
  [/^(?:dozen|doz\.?)(?=\s|$)/i, "dozen"],
  [/^(?:each|ea\.?)(?=\s|$)/i, "each"],
];

const WORD_NUMBERS = {
  a: 1,
  an: 1,
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
};

function normalizeFractionText(value) {
  return String(value || "")
    .replace(/(\d)([¼½¾⅓⅔⅛⅜⅝⅞])/g, "$1 $2")
    .replace(/[¼½¾⅓⅔⅛⅜⅝⅞]/g, (fraction) => UNICODE_FRACTIONS[fraction] || fraction)
    .replace(/(\d)\s*-\s*(\d+\/\d+)/g, "$1 $2")
    .replace(/[–—]/g, "-")
    .trim();
}

function fractionToNumber(value) {
  const text = String(value || "").trim();
  if (!text) return 0;
  return text.split(/\s+/).reduce((total, part) => {
    if (!part.includes("/")) return total + Number(part || 0);
    const [numerator, denominator] = part.split("/").map(Number);
    return total + (denominator ? numerator / denominator : 0);
  }, 0);
}

function parseIngredientLine(line) {
  const cleaned = normalizeFractionText(line)
    .replace(/^[-*•]\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/^ingredients?\s*:\s*/i, "")
    .trim();
  if (!cleaned) return null;

  // Covers 500g flour, 1 1/2 cups flour, 1-1/2 tsp salt, and "a pinch of salt".
  // The space before the unit is optional because copied web recipes often use "500g".
  const quantityMatch = cleaned.match(/^(?:(a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+|((?:(?:\d+(?:\.\d+)?\s+)?\d+\/\d+|\d+(?:\.\d+)?)(?:\s*-\s*(?:(?:\d+(?:\.\d+)?\s+)?\d+\/\d+|\d+(?:\.\d+)?))?)\s*)(.*)$/i);
  if (!quantityMatch) return normalizeIngredient({ name: cleaned, amount: 0, unit: "" });

  const amount = quantityMatch[1] ? WORD_NUMBERS[quantityMatch[1].toLowerCase()] : fractionToNumber(quantityMatch[2].split("-")[0]);
  let remainder = quantityMatch[3].trim();
  let unit = "";
  const parentheticalNotes = [];

  // Move copied metric equivalents and optional notes out of the ingredient name.
  // Examples: "2 cups (480g) flour" and "1 tsp vanilla (optional)".
  remainder = remainder.replace(/\(([^)]+)\)/g, (match, note) => {
    parentheticalNotes.push(note.trim());
    return " ";
  }).replace(/\s{2,}/g, " ").trim();

  for (const [pattern, normalizedUnit] of UNIT_ALIASES) {
    const match = remainder.match(pattern);
    if (match) {
      unit = normalizedUnit;
      remainder = remainder.slice(match[0].length).trim();
      break;
    }
  }

  // Treat ordinary produce/counts as a quantity, not as part of the ingredient name.
  if (!unit && /^(?:eggs?|lemons?|limes?|apples?|bananas?|avocados?|onions?|potatoes?|carrots?|peppers?)\b/i.test(remainder)) unit = "each";
  remainder = remainder.replace(/^of\s+/i, "").trim();

  const [namePart, ...noteParts] = remainder.split(/[,;]/).map((part) => part.trim()).filter(Boolean);
  return normalizeIngredient({
    name: namePart || cleaned,
    amount: Number.isFinite(amount) ? amount : 0,
    unit,
    note: [...parentheticalNotes, ...noteParts].filter(Boolean).join(" · "),
  });
}

function parseRecipe(text, sourceUrl = "") {
  const raw = String(text || "").trim();
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const ingredientHeading = lines.findIndex((line) => /^(?:#+\s*)?ingredients?\b/i.test(line));
  const instructionHeading = lines.findIndex((line) => /^(?:#+\s*)?(instructions?|method|directions?|steps?)\b/i.test(line));
  const ingredientHeadingTail = ingredientHeading >= 0
    ? lines[ingredientHeading].replace(/^(?:#+\s*)?ingredients?\s*:?\s*/i, "").trim()
    : "";
  const ingredientLines = ingredientHeading >= 0
    ? [ingredientHeadingTail, ...lines.slice(ingredientHeading + 1, instructionHeading >= 0 ? instructionHeading : undefined)]
    : lines.filter((line) => {
      const normalized = normalizeFractionText(line).replace(/^[-*•]\s*/, "").trim();
      // Keep numbered ingredient rows such as "1. 200 g flour", but do not turn
      // a method line such as "1. Heat the oven" into an ingredient.
      return /^(?:(?:\d|[¼½¾⅓⅔⅛⅜⅝⅞])|(?:a|an|one|two|three)\s+)/i.test(normalized)
        && !/^\d+[.)]\s+[A-Za-z]/.test(normalized);
    });
  const stepLines = instructionHeading >= 0
    ? lines.slice(instructionHeading + 1)
    : lines.filter((line) => /^(step\s*\d+|\d+[.)])\s*/i.test(line));

  const ingredients = ingredientLines
    .filter((line) => {
      const normalized = normalizeFractionText(line).replace(/^[-*•]\s*/, "").trim();
      // Section labels such as "For the sauce:" belong in the recipe structure, not the ingredient list.
      return normalized && !/^[A-Za-z][A-Za-z &/()-]{0,50}:\s*$/.test(normalized);
    })
    .map(parseIngredientLine)
    .filter((ingredient) => ingredient?.name);

  return {
    id: nextId("recipe"),
    name: titleFromText(raw),
    type: "Other",
    category: "Pantry",
    servings: 4,
    sourceUrl,
    photo: "",
    notes: "Imported from pasted recipe. Review amounts, yields, and instructions before cooking.",
    temps: "",
    ingredients: ingredients.length ? ingredients : [normalizeIngredient({ name: "Add ingredients from source", amount: 0 })],
    steps: stepLines.length ? stepLines.map((step) => step.replace(/^\d+[.)]\s*/, "")) : ["Add cooking instructions from the source recipe."],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatAmount(value) {
  if (!value) return "–";
  return Number.isInteger(value) ? String(value) : value.toFixed(value < 10 ? 2 : 1).replace(/\.0$/, "");
}

function emptyRecipe() {
  return {
    id: nextId("recipe"), name: "New recipe", type: "Other", category: "Pantry", servings: 4,
    sourceUrl: "", photo: "", notes: "", temps: "", ingredients: [normalizeIngredient({ name: "Ingredient", amount: 0 })],
    steps: ["Add the first step."], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

export default function CookbookPage({ recipes: bakeryRecipes = [], setActive }) {
  const [cookbook, setCookbook] = usePersistentState(STORAGE_KEY, starterCookbook(bakeryRecipes));
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All types");
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [scale, setScale] = useState(1);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [importText, setImportText] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [plannerMonth, setPlannerMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [manualItem, setManualItem] = useState("");
  const photoInput = useRef(null);

  const cookbookRecipes = cookbook?.recipes || [];
  const selected = cookbookRecipes.find((recipe) => recipe.id === selectedId) || cookbookRecipes[0] || null;
  const visibleRecipes = useMemo(() => cookbookRecipes.filter((recipe) => {
    const haystack = `${recipe.name} ${recipe.type} ${recipe.category} ${recipe.notes}`.toLowerCase();
    return (!query || haystack.includes(query.toLowerCase()))
      && (typeFilter === "All types" || recipe.type === typeFilter)
      && (categoryFilter === "All categories" || recipe.category === categoryFilter);
  }), [cookbookRecipes, query, typeFilter, categoryFilter]);

  const month = monthKey(plannerMonth);
  const shoppingLines = useMemo(() => {
    const totals = new Map();
    (cookbook.plans || []).filter((plan) => plan.date?.startsWith(month)).forEach((plan) => {
      const recipe = cookbookRecipes.find((item) => item.id === plan.recipeId);
      if (!recipe) return;
      const factor = toNumber(plan.servings, recipe.servings || 1) / Math.max(1, toNumber(recipe.servings, 1));
      recipe.ingredients.forEach((ingredient) => {
        const key = `${ingredient.name.toLowerCase()}|${ingredient.unit}`;
        const current = totals.get(key) || { name: ingredient.name, unit: ingredient.unit, amount: 0, recipes: [] };
        current.amount += toNumber(ingredient.amount) * factor;
        if (!current.recipes.includes(recipe.name)) current.recipes.push(recipe.name);
        totals.set(key, current);
      });
    });
    return [...totals.values(), ...(cookbook.manualShopping || []).map((item) => ({ ...item, manual: true }))];
  }, [cookbook, cookbookRecipes, month]);

  const updateCookbook = (updater) => setCookbook((current) => updater(current || starterCookbook(bakeryRecipes)));
  const chooseRecipe = (recipe) => { setSelectedId(recipe.id); setScale(1); setIsEditing(false); setDraft(null); };
  const openEditor = (recipe = selected || emptyRecipe()) => { setDraft(structuredClone(recipe)); setIsEditing(true); };

  const saveDraft = () => {
    if (!draft?.name?.trim()) return;
    const saved = { ...draft, name: draft.name.trim(), updatedAt: new Date().toISOString() };
    updateCookbook((current) => ({
      ...current,
      recipes: current.recipes.some((recipe) => recipe.id === saved.id)
        ? current.recipes.map((recipe) => recipe.id === saved.id ? saved : recipe)
        : [saved, ...current.recipes],
    }));
    setSelectedId(saved.id); setIsEditing(false); setDraft(null);
  };

  const removeRecipe = (recipe) => {
    if (!recipe || !window.confirm(`Remove ${recipe.name} from this cookbook?`)) return;
    updateCookbook((current) => ({
      ...current,
      recipes: current.recipes.filter((item) => item.id !== recipe.id),
      plans: current.plans.filter((plan) => plan.recipeId !== recipe.id),
    }));
    setSelectedId("");
  };

  const addToPlan = (recipe = selected) => {
    if (!recipe) return;
    const id = nextId("meal");
    updateCookbook((current) => ({ ...current, plans: [...current.plans, { id, date: selectedDay, recipeId: recipe.id, servings: recipe.servings || 1 }] }));
  };

  const importRecipe = () => {
    if (!importText.trim()) return;
    const imported = parseRecipe(importText, importUrl.trim());
    updateCookbook((current) => ({ ...current, recipes: [imported, ...current.recipes] }));
    setSelectedId(imported.id); setImportText(""); setImportUrl(""); setIsEditing(false);
  };

  const onPhotoUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file || !draft) return;
    const reader = new FileReader();
    reader.onload = () => setDraft((current) => ({ ...current, photo: String(reader.result || "") }));
    reader.readAsDataURL(file);
  };

  const addManualItem = () => {
    const name = manualItem.trim(); if (!name) return;
    updateCookbook((current) => ({ ...current, manualShopping: [...current.manualShopping, { id: nextId("shop"), name, amount: 1, unit: "", recipes: ["Manual item"] }] }));
    setManualItem("");
  };

  const exportShopping = () => {
    const csv = ["Item,Amount,Unit,Planned recipes", ...shoppingLines.map((item) => [item.name, formatAmount(item.amount), item.unit, item.recipes.join(" + ")].map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `loafer-shopping-${month}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };

  const calendarDays = useMemo(() => {
    const first = new Date(plannerMonth.getFullYear(), plannerMonth.getMonth(), 1);
    const start = new Date(first); start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, index) => { const day = new Date(start); day.setDate(start.getDate() + index); return day; });
  }, [plannerMonth]);

  return (
    <main className="page cookbook-page">
      <section className="cookbook-hero">
        <span className="eyebrow">LOAFERS RESOURCE HUB</span>
        <div>
          <div>
            <h1>Cookbook</h1>
            <p>Your personal recipe shelf for baking, meals, notes, and the next shopping run.</p>
          </div>
          <button className="primary-button cookbook-new" type="button" onClick={() => openEditor(emptyRecipe())}><Plus size={18} /> Add recipe</button>
        </div>
      </section>

      <section className="cookbook-toolbar" aria-label="Cookbook filters">
        <label className="cookbook-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search recipes, notes, or ingredients" /></label>
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>{TYPES.map((type) => <option key={type}>{type}</option>)}</select>
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select>
        <button className="secondary-button" type="button" onClick={() => setActive?.("resources", { navKey: "resources" })}>Back to Resource Hub</button>
      </section>

      <section className="cookbook-layout">
        <aside className="cookbook-library">
          <div className="cookbook-section-heading"><span><BookIcon /><strong>Recipe library</strong></span><small>{visibleRecipes.length} saved</small></div>
          <div className="cookbook-list">
            {visibleRecipes.map((recipe) => <button className={selected?.id === recipe.id ? "cookbook-recipe-row active" : "cookbook-recipe-row"} key={recipe.id} type="button" onClick={() => chooseRecipe(recipe)}>
              <span className="cookbook-thumb">{recipe.photo ? <img src={recipe.photo} alt="" /> : <FileText size={19} />}</span>
              <span><b>{recipe.name}</b><small>{recipe.type} · {recipe.category}</small><em>{recipe.servings || 1} servings</em></span>
              <ChevronRight size={17} />
            </button>)}
            {!visibleRecipes.length ? <div className="cookbook-empty">No recipes match these filters.</div> : null}
          </div>
          <div className="cookbook-import-mini"><Sparkles size={18} /><span><b>Paste a full recipe</b><small>Import a web recipe after you copy it.</small></span></div>
        </aside>

        <section className="cookbook-reader">
          {selected && !isEditing ? <>
            <div className="cookbook-recipe-header">
              <div className="cookbook-image">{selected.photo ? <img src={selected.photo} alt={selected.name} /> : <Camera size={34} />}</div>
              <div><span className="eyebrow">{selected.type} · {selected.category}</span><h2>{selected.name}</h2><p>{selected.notes || "Add a note to describe this recipe."}</p><div className="cookbook-tags">{selected.temps ? <span>🌡 {selected.temps}</span> : null}{selected.sourceUrl ? <a href={selected.sourceUrl} target="_blank" rel="noreferrer"><Link2 size={14} /> Source</a> : null}</div></div>
              <div className="cookbook-actions"><button type="button" className="icon-button" aria-label="Edit recipe" onClick={() => openEditor(selected)}><Pencil size={18} /></button><button type="button" className="icon-button danger" aria-label="Remove recipe" onClick={() => removeRecipe(selected)}><Trash2 size={18} /></button></div>
            </div>
            <div className="cookbook-scale"><span><strong>Scale recipe</strong><small>All quantities adjust below.</small></span><button type="button" onClick={() => setScale((value) => Math.max(.25, value - .25))}><Minus size={16} /></button><strong>{formatAmount(scale)}×</strong><button type="button" onClick={() => setScale((value) => Math.min(20, value + .25))}><Plus size={16} /></button><span className="cookbook-serving-note">Makes {formatAmount((selected.servings || 1) * scale)} servings</span></div>
            <div className="cookbook-content-grid">
              <section className="cookbook-card"><div className="cookbook-card-title"><ShoppingBasket size={18} /><h3>Ingredients</h3></div><ul className="cookbook-ingredients">{selected.ingredients.map((ingredient) => <li key={ingredient.id}><span>{ingredient.name}{ingredient.note ? <small>{ingredient.note}</small> : null}</span><b>{formatAmount(ingredient.amount * scale)} {ingredient.unit}</b></li>)}</ul></section>
              <section className="cookbook-card"><div className="cookbook-card-title"><ClipboardList size={18} /><h3>Method</h3></div><ol className="cookbook-steps">{selected.steps.map((step, index) => <li key={`${step}-${index}`}><span>{index + 1}</span><p>{step}</p></li>)}</ol></section>
            </div>
            <section className="cookbook-plan-quick"><CalendarDays size={19} /><span><b>Plan this recipe</b><small>Add {selected.name} to {new Date(`${selectedDay}T12:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}.</small></span><input type="date" value={selectedDay} onChange={(event) => setSelectedDay(event.target.value)} /><button className="primary-button" type="button" onClick={() => addToPlan(selected)}><ListPlus size={17} /> Add to planner</button></section>
          </> : isEditing && draft ? <RecipeEditor draft={draft} setDraft={setDraft} photoInput={photoInput} onPhotoUpload={onPhotoUpload} onSave={saveDraft} onCancel={() => { setIsEditing(false); setDraft(null); }} /> : <div className="cookbook-empty">Choose a recipe or create a new one.</div>}
        </section>

        <aside className="cookbook-planner">
          <div className="cookbook-section-heading"><span><CalendarDays size={19} /><strong>Monthly meals</strong></span><small>{monthLabel(plannerMonth)}</small></div>
          <div className="cookbook-month-controls"><button type="button" onClick={() => setPlannerMonth((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))}><ChevronLeft size={17} /></button><strong>{monthLabel(plannerMonth)}</strong><button type="button" onClick={() => setPlannerMonth((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))}><ChevronRight size={17} /></button></div>
          <div className="cookbook-calendar"><div className="cookbook-weekdays">{["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div><div className="cookbook-days">{calendarDays.map((day) => { const date = day.toISOString().slice(0, 10); const meals = (cookbook.plans || []).filter((plan) => plan.date === date); return <button key={date} type="button" className={`${day.getMonth() === plannerMonth.getMonth() ? "" : "muted "}${selectedDay === date ? "selected" : ""}`} onClick={() => setSelectedDay(date)}><b>{day.getDate()}</b>{meals.slice(0, 2).map((meal) => <small key={meal.id}>{cookbookRecipes.find((recipe) => recipe.id === meal.recipeId)?.name || "Saved meal"}</small>)}</button>; })}</div></div>
          <div className="cookbook-shopping"><div className="cookbook-card-title"><ShoppingBasket size={18} /><h3>Shopping list</h3><button type="button" className="icon-button" aria-label="Export shopping list" onClick={exportShopping}><Download size={16} /></button></div><p>{shoppingLines.length} items for {monthLabel(plannerMonth)}.</p><div className="cookbook-shopping-add"><input value={manualItem} onChange={(event) => setManualItem(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addManualItem()} placeholder="Add a manual item" /><button type="button" onClick={addManualItem}><Plus size={16} /></button></div><ul>{shoppingLines.slice(0, 10).map((item, index) => <li key={`${item.name}-${index}`}><span>{item.name}<small>{item.recipes.join(", ")}</small></span><b>{formatAmount(item.amount)} {item.unit}</b></li>)}</ul><button type="button" className="secondary-button cookbook-export" onClick={exportShopping}><Download size={16} /> Export shopping list</button></div>
        </aside>
      </section>

      <section className="cookbook-import-panel"><div><span className="eyebrow">RECIPE IMPORT</span><h2>Paste a recipe, keep the source.</h2><p>Paste the full recipe from a website, then review and edit the imported card. Website links are saved as a source reference.</p></div><label><span><Link2 size={16} /> Original recipe link (optional)</span><input value={importUrl} onChange={(event) => setImportUrl(event.target.value)} placeholder="https://example.com/recipe" /></label><label><span><FileText size={16} /> Full recipe text</span><textarea value={importText} onChange={(event) => setImportText(event.target.value)} placeholder={"Recipe title\n\nIngredients\n500 g flour\n350 g water\n\nInstructions\n1. Mix ingredients.\n2. Rest and bake."} /></label><button className="primary-button" type="button" onClick={importRecipe}><Sparkles size={17} /> Import pasted recipe</button></section>
    </main>
  );
}

function BookIcon() { return <FileText size={19} />; }

function RecipeEditor({ draft, setDraft, photoInput, onPhotoUpload, onSave, onCancel }) {
  const update = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  const updateIngredient = (index, field, value) => setDraft((current) => ({ ...current, ingredients: current.ingredients.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: field === "amount" ? toNumber(value) : value } : item) }));
  const updateStep = (index, value) => setDraft((current) => ({ ...current, steps: current.steps.map((step, stepIndex) => stepIndex === index ? value : step) }));
  return <div className="cookbook-editor">
    <div className="cookbook-editor-heading"><span><Pencil size={19} /><strong>{draft.id.startsWith("recipe-") ? "New recipe" : "Edit recipe"}</strong></span><button type="button" className="icon-button" aria-label="Close editor" onClick={onCancel}><X size={18} /></button></div>
    <div className="cookbook-editor-basics"><label>Recipe name<input value={draft.name} onChange={(event) => update("name", event.target.value)} /></label><label>Type<select value={draft.type} onChange={(event) => update("type", event.target.value)}>{TYPES.slice(1).map((type) => <option key={type}>{type}</option>)}</select></label><label>Category<select value={draft.category} onChange={(event) => update("category", event.target.value)}>{CATEGORIES.slice(1).map((category) => <option key={category}>{category}</option>)}</select></label><label>Servings<input type="number" min="1" value={draft.servings} onChange={(event) => update("servings", toNumber(event.target.value, 1))} /></label><label>Temperatures / timing<input value={draft.temps} onChange={(event) => update("temps", event.target.value)} placeholder="350°F · 45 minutes" /></label><label>Source website<input value={draft.sourceUrl} onChange={(event) => update("sourceUrl", event.target.value)} placeholder="https://" /></label></div>
    <div className="cookbook-photo-editor"><div>{draft.photo ? <img src={draft.photo} alt="Recipe preview" /> : <Camera size={25} />}</div><span><b>Recipe photo</b><small>Upload one photo, or replace it anytime.</small></span><input ref={photoInput} type="file" accept="image/*" onChange={onPhotoUpload} hidden /><button className="secondary-button" type="button" onClick={() => photoInput.current?.click()}><Upload size={16} /> Upload photo</button>{draft.photo ? <button className="text-button" type="button" onClick={() => update("photo", "")}>Remove</button> : null}</div>
    <label className="cookbook-notes-field">Notes<textarea value={draft.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Family notes, substitutions, serving suggestions..." /></label>
    <div className="cookbook-editor-grid"><section><div className="cookbook-card-title"><ShoppingBasket size={18} /><h3>Ingredients</h3><button className="icon-button" type="button" aria-label="Add ingredient" onClick={() => setDraft((current) => ({ ...current, ingredients: [...current.ingredients, normalizeIngredient({ name: "Ingredient", amount: 0 })] }))}><Plus size={16} /></button></div>{draft.ingredients.map((ingredient, index) => <div className="cookbook-editor-row" key={ingredient.id}><input value={ingredient.name} onChange={(event) => updateIngredient(index, "name", event.target.value)} /><input type="number" value={ingredient.amount} onChange={(event) => updateIngredient(index, "amount", event.target.value)} /><input value={ingredient.unit} onChange={(event) => updateIngredient(index, "unit", event.target.value)} placeholder="g" /><button type="button" className="icon-button danger" aria-label="Remove ingredient" onClick={() => setDraft((current) => ({ ...current, ingredients: current.ingredients.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 size={15} /></button></div>)}</section><section><div className="cookbook-card-title"><ClipboardList size={18} /><h3>Instructions</h3><button className="icon-button" type="button" aria-label="Add step" onClick={() => setDraft((current) => ({ ...current, steps: [...current.steps, "New step."] }))}><Plus size={16} /></button></div>{draft.steps.map((step, index) => <div className="cookbook-step-edit" key={`${index}-${step}`}><b>{index + 1}</b><textarea value={step} onChange={(event) => updateStep(index, event.target.value)} /><button type="button" className="icon-button danger" aria-label="Remove step" onClick={() => setDraft((current) => ({ ...current, steps: current.steps.filter((_, stepIndex) => stepIndex !== index) }))}><Trash2 size={15} /></button></div>)}</section></div>
    <div className="cookbook-editor-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button type="button" className="primary-button" onClick={onSave}><PackagePlus size={17} /> Save cookbook recipe</button></div>
  </div>;
}
