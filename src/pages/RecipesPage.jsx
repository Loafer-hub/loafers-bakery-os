import {
  ChevronRight,
  CircleDollarSign,
  Droplets,
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
import { FLOUR_PROFILES, getFlourProfile } from "../data/flourProfiles";

const INGREDIENT_CATEGORIES = [
  { value: "flour", label: "Flour" },
  { value: "liquid", label: "Liquid" },
  { value: "starter", label: "Starter / preferment" },
  { value: "salt", label: "Salt" },
  { value: "inclusion", label: "Inclusion" },
  { value: "other", label: "Other" },
];

const DEFAULT_INGREDIENTS = [
  { key: "flour", name: "Bread flour", category: "flour", percent: 100 },
  { key: "water", name: "Water", category: "liquid", percent: 75 },
  { key: "starter", name: "Starter", category: "starter", percent: 20 },
  { key: "salt", name: "Salt", category: "salt", percent: 2 },
];

function ingredientCategory(ingredient) {
  if (ingredient.category) return ingredient.category;
  const name = ingredient.name.toLowerCase();
  if (name.includes("flour") || FLOUR_PROFILES.some((profile) => (
    [profile.name, ...profile.aliases].some((alias) => name.includes(alias.toLowerCase()))
  ))) return "flour";
  if (name.includes("water") || name.includes("milk") || name.includes("juice")) return "liquid";
  if (name.includes("starter") || name.includes("levain")) return "starter";
  if (name.includes("salt")) return "salt";
  return "inclusion";
}

function flourWeightFor(recipe) {
  const flourWeight = recipe.ingredients.reduce((sum, ingredient) => (
    ingredientCategory(ingredient) === "flour" ? sum + Number(ingredient.weight || 0) : sum
  ), 0);
  return flourWeight || Number(recipe.flourWeight) || Number(recipe.yield || 1) * 600;
}

function recipeForm(recipe) {
  const stamp = Date.now();
  if (!recipe) {
    return {
      id: `recipe-${stamp}`,
      name: "",
      note: "",
      yield: 4,
      price: 13,
      flourWeight: 2400,
      isNew: true,
      ingredients: DEFAULT_INGREDIENTS.map((ingredient) => ({
        ...ingredient,
        id: `ingredient-${ingredient.key}-${stamp}`,
      })),
    };
  }
  return {
    ...recipe,
    isNew: false,
    flourWeight: flourWeightFor(recipe),
    ingredients: recipe.ingredients.map((ingredient, index) => ({
      ...ingredient,
      id: ingredient.id || `ingredient-${index}-${stamp}`,
      category: ingredientCategory(ingredient),
      flourType: ingredientCategory(ingredient) === "flour"
        ? getFlourProfile(ingredient.flourType || ingredient.name).name
        : undefined,
      percent: Number(ingredient.percent || 0),
    })),
  };
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

export default function RecipesPage({ inventory, recipes, onDeleteRecipe, onSaveRecipe }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [loaves, setLoaves] = useState(1);
  const [showEditor, setShowEditor] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState(() => recipeForm());
  const [formError, setFormError] = useState("");
  const selected = recipes.find((recipe) => recipe.id === selectedId);
  const filtered = useMemo(
    () => recipes.filter((recipe) => recipe.name.toLowerCase().includes(query.toLowerCase())),
    [query, recipes],
  );

  function openEditor(recipe) {
    setForm(recipeForm(recipe));
    setFormError("");
    setShowEditor(true);
  }

  function updateIngredient(id, changes) {
    setForm((current) => ({
      ...current,
      ingredients: current.ingredients.map((ingredient) => (
        ingredient.id === id ? { ...ingredient, ...changes } : ingredient
      )),
    }));
  }

  function submitRecipe(event) {
    event.preventDefault();
    if (!form.name.trim()) return;
    const flourTotal = form.ingredients.reduce((sum, ingredient) => (
      ingredient.category === "flour" ? sum + Number(ingredient.percent || 0) : sum
    ), 0);
    if (Math.abs(flourTotal - 100) > 0.1) {
      setFormError(`Flour percentages must total 100%. They currently total ${flourTotal.toFixed(1)}%.`);
      return;
    }
    const liquidTotal = form.ingredients.reduce((sum, ingredient) => (
      ingredient.category === "liquid" ? sum + Number(ingredient.percent || 0) : sum
    ), 0);
    const flourWeight = Number(form.flourWeight);
    onSaveRecipe({
      ...form,
      name: form.name.trim(),
      note: form.note.trim() || "Your custom house formula",
      yield: Number(form.yield),
      hydration: liquidTotal,
      price: Number(form.price),
      flourWeight,
      ingredients: form.ingredients.map(({ id, key, ...ingredient }) => ({
        ...ingredient,
        name: ingredient.category === "flour"
          ? getFlourProfile(ingredient.flourType || ingredient.name).name
          : ingredient.name.trim(),
        flourType: ingredient.category === "flour"
          ? getFlourProfile(ingredient.flourType || ingredient.name).name
          : undefined,
        percent: Number(ingredient.percent),
        weight: Math.round(flourWeight * Number(ingredient.percent) / 100),
      })),
    });
    setShowEditor(false);
  }

  if (selected) {
    const factor = loaves / selected.yield;
    const total = selected.ingredients.reduce((sum, item) => sum + Math.round(item.weight * factor), 0);
    const batchCost = selected.ingredients.reduce((sum, ingredient) => (
      sum + inventoryCostForIngredient(ingredient, Number(ingredient.weight) * factor, inventory)
    ), 0);
    const price = Number(selected.price || 0);
    const ingredientCostPerLoaf = batchCost / Math.max(1, loaves);
    return (
      <main className="page recipe-detail">
        <button className="text-back" onClick={() => setSelectedId(null)}>← Recipes</button>
        <div className="recipe-detail-heading">
          <span className="recipe-icon"><Wheat /></span>
          <div><h1>{selected.name}</h1><p>{selected.note}</p></div>
        </div>
        <div className="recipe-facts">
          <span><Droplets size={17} /> {selected.hydration}% hydration</span>
          <span>${price.toFixed(2)} per loaf</span>
          <button className="inline-edit-button" type="button" onClick={() => openEditor(selected)}><Pencil size={14} /> Edit recipe</button>
        </div>
        <div className="section-title-line">
          <h2>Formula</h2>
          <div className="compact-stepper">
            <button onClick={() => setLoaves((value) => Math.max(1, value - 1))}>−</button>
            <span>{loaves} {loaves === 1 ? "loaf" : "loaves"}</span>
            <button onClick={() => setLoaves((value) => Math.min(40, value + 1))}>+</button>
          </div>
        </div>
        <div className="formula-table large">
          <div className="formula-head"><span>Ingredient</span><span>Weight</span><span>Baker’s %</span></div>
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
            <strong>${batchCost.toFixed(2)} batch · ${ingredientCostPerLoaf.toFixed(2)} / loaf</strong>
            <small>Estimated gross margin ${(price - ingredientCostPerLoaf).toFixed(2)} per loaf. Ingredients match inventory by name.</small>
          </div>
        </section>
        <section className="recipe-flour-science">
          <div className="section-title-line">
            <div><span className="eyebrow-label dark">Research-informed tendencies</span><h2>Flour behavior</h2></div>
          </div>
          <FlourBlendScience flours={selected.ingredients.filter((ingredient) => ingredientCategory(ingredient) === "flour").map((ingredient) => ingredient.flourType || ingredient.name)} />
          <p className="model-note">The multipliers are planning heuristics. Your flour brand, extraction, crop, milling, temperature, and starter ecology can shift the result.</p>
        </section>
        <section className="method-notes">
          <h2>Method notes</h2>
          <ol>
            <li><b>Mix</b><span>Rest flour and 90% of water for 30 minutes.</span></li>
            <li><b>Develop</b><span>Add starter and salt. Four folds over two hours.</span></li>
            <li><b>Shape</b><span>Shape at roughly 50% bulk rise, then cold proof.</span></li>
            <li><b>Bake</b><span>475°F covered, then finish uncovered at 450°F.</span></li>
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
            setForm={setForm}
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
        subtitle="Every ingredient is editable. Your flour total stays at 100%."
        action={<button className="round-action" onClick={() => openEditor()} aria-label="Add recipe"><Plus size={21} /></button>}
      />
      <label className="search-field full">
        <Search size={17} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search recipes" />
      </label>
      <section className="recipe-list">
        {filtered.length ? filtered.map((recipe) => (
          <button className="recipe-row" key={recipe.id} onClick={() => {
            setSelectedId(recipe.id);
            setLoaves(recipe.yield);
          }}>
            <span className="recipe-icon"><Wheat size={24} /></span>
            <span className="recipe-copy">
              <strong>{recipe.name}</strong>
              <small>{recipe.note}</small>
              <span>{recipe.hydration}% hydration · {recipe.yield}-loaf base</span>
            </span>
            <ChevronRight size={19} />
          </button>
        )) : <EmptyState title={recipes.length ? "No matching recipes" : "No recipes yet"} body={recipes.length ? "Try another recipe name." : "Use the plus button to add your first formula."} />}
      </section>
      <aside className="bakers-percent-note">
        <Droplets size={21} />
        <div>
          <h3>Baker’s percentage, without the math headache</h3>
          <p>Add flours, liquids, inclusions, salt, or preferments. Loafers recalculates every gram when you change the loaf count.</p>
        </div>
      </aside>
      {showEditor ? (
        <RecipeEditor
          form={form}
          formError={formError}
          onClose={() => setShowEditor(false)}
          onSubmit={submitRecipe}
          setForm={setForm}
          updateIngredient={updateIngredient}
        />
      ) : null}
    </main>
  );
}

function RecipeEditor({ form, formError, onClose, onSubmit, setForm, updateIngredient }) {
  const flourTotal = form.ingredients.reduce((sum, ingredient) => (
    ingredient.category === "flour" ? sum + Number(ingredient.percent || 0) : sum
  ), 0);
  const hydration = form.ingredients.reduce((sum, ingredient) => (
    ingredient.category === "liquid" ? sum + Number(ingredient.percent || 0) : sum
  ), 0);
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
          <label>Base yield<input type="number" min="1" max="40" value={form.yield} onChange={(event) => setForm({ ...form, yield: Number(event.target.value) })} /></label>
          <label>Price per loaf<input type="number" min="0" step="0.25" value={form.price} onChange={(event) => setForm({ ...form, price: Number(event.target.value) })} /></label>
        </div>
        <label>Total flour in base batch (g)<input type="number" min="100" step="50" value={form.flourWeight} onChange={(event) => setForm({ ...form, flourWeight: Number(event.target.value) })} /></label>
        <div className="ingredient-editor-heading">
          <div><strong>Ingredients</strong><small>Flours total {flourTotal.toFixed(1)}% · hydration {hydration.toFixed(1)}%</small></div>
          <span className="ingredient-add-actions">
            <button type="button" aria-label="Add flour" onClick={() => setForm((current) => ({
              ...current,
              ingredients: [...current.ingredients, {
                id: `ingredient-flour-${Date.now()}`,
                name: "Whole wheat",
                flourType: "Whole wheat",
                category: "flour",
                percent: 10,
              }],
            }))}><Wheat size={14} /> Flour</button>
            <button type="button" aria-label="Add other ingredient" onClick={() => setForm((current) => ({
              ...current,
              ingredients: [...current.ingredients, {
                id: `ingredient-${Date.now()}`,
                name: "",
                category: "inclusion",
                percent: 5,
              }],
            }))}><Plus size={15} /> Other</button>
          </span>
        </div>
        <div className="ingredient-editor-list">
          {form.ingredients.map((ingredient) => (
            <div className="ingredient-editor-row" key={ingredient.id}>
              {ingredient.category === "flour" ? (
                <select className="ingredient-name-control" aria-label={`${ingredient.flourType || ingredient.name} flour type`} value={ingredient.flourType || getFlourProfile(ingredient.name).name} onChange={(event) => updateIngredient(ingredient.id, { name: event.target.value, flourType: event.target.value })}>
                  {FLOUR_PROFILES.map((profile) => <option value={profile.name} key={profile.name}>{profile.name}</option>)}
                </select>
              ) : (
                <input className="ingredient-name-control" aria-label="Ingredient name" value={ingredient.name} onChange={(event) => updateIngredient(ingredient.id, { name: event.target.value })} placeholder="Ingredient" required />
              )}
              <select className="ingredient-category-control" aria-label={`${ingredient.name || "Ingredient"} category`} value={ingredient.category} onChange={(event) => updateIngredient(ingredient.id, {
                category: event.target.value,
                ...(event.target.value === "flour" ? { name: "Bread flour", flourType: "Bread flour" } : { flourType: undefined }),
              })}>
                {INGREDIENT_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
              </select>
              <label><span>Baker’s %</span><input aria-label={`${ingredient.name || "Ingredient"} baker's percent`} type="number" min="0" step="0.1" value={ingredient.percent} onChange={(event) => updateIngredient(ingredient.id, { percent: Number(event.target.value) })} /></label>
              <button type="button" className="remove-ingredient-button" aria-label={`Remove ${ingredient.name || "ingredient"}`} disabled={form.ingredients.length <= 1} onClick={() => setForm((current) => ({
                ...current,
                ingredients: current.ingredients.filter((item) => item.id !== ingredient.id),
              }))}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
        <div className="recipe-builder-science">
          <div className="section-title-line"><h3>What these flours change</h3><span>Dough + starter</span></div>
          <FlourBlendScience compact flours={form.ingredients.filter((ingredient) => ingredient.category === "flour").map((ingredient) => ingredient.flourType || ingredient.name)} />
        </div>
        {formError ? <p className="form-error" role="alert">{formError}</p> : null}
        <p className="form-help">Mark every flour as “Flour.” Those flour percentages must total 100%; all other ingredients use that flour weight as their baker’s-percentage base.</p>
        <button className="primary-button" type="submit">{form.isNew ? "Add recipe" : "Save recipe changes"}</button>
      </form>
    </Modal>
  );
}
