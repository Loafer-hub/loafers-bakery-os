import {
  Cloud,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteReadyShelfItem,
  listReadyShelfItems,
  saveReadyShelfItem,
} from "../lib/cloud";
import { shelfAgeLabel } from "../lib/pickupHours";
import { productTypeFor } from "../lib/productTypes";
import { normalizedSalesOptions, pluralUnit } from "../lib/salesOptions";
import { EmptyState, Modal } from "./Primitives";

function todayKey() {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function blankShelfItem() {
  return {
    name: "",
    description: "",
    baked_on: todayKey(),
    quantity: 1,
    price: 13,
    active: true,
    isNew: true,
    sourceType: "custom",
    recipeId: "",
  };
}

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeKey(value) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function recipeKey(recipe = {}, index = 0) {
  return cleanText(recipe.id || recipe.slug || recipe.name || `recipe-${index}`);
}

function recipeIngredientSummary(recipe = {}) {
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const names = [...new Set(ingredients.map((ingredient) => cleanText(ingredient.name)).filter(Boolean))];
  if (!names.length) return "";
  const visibleNames = names.slice(0, 8);
  return `Ingredients: ${visibleNames.join(", ")}${names.length > visibleNames.length ? ` + ${names.length - visibleNames.length} more` : ""}.`;
}

function recipeOptionSummary(recipe = {}) {
  const unitName = cleanText(recipe.unitName) || productTypeFor(recipe.productType || "bread").unitName || "item";
  const options = normalizedSalesOptions(recipe);
  if (!options.length) return "";
  return `Shelf pricing: ${options.slice(0, 3).map((option) => (
    `${option.label} (${option.units} ${pluralUnit(unitName, option.units)}) $${Number(option.price || 0).toFixed(2)}`
  )).join(" · ")}${options.length > 3 ? " · more options saved on recipe" : ""}.`;
}

function recipeDetails(recipe = {}) {
  const type = productTypeFor(recipe.productType || "bread");
  const unitName = cleanText(recipe.unitName) || type.unitName || "item";
  const yieldCount = Number(recipe.yield || 1);
  const lines = [
    cleanText(recipe.note || recipe.description),
    `${type.label} · saved recipe${yieldCount ? ` · batch makes ${yieldCount} ${pluralUnit(unitName, yieldCount)}` : ""}.`,
    Number(recipe.hydration) > 0 ? `Formula: ${Number(recipe.hydration).toFixed(0)}% hydration.` : "",
    recipeIngredientSummary(recipe),
    recipeOptionSummary(recipe),
  ].filter(Boolean);
  return lines.join("\n");
}

function recipeShelfPrice(recipe = {}) {
  const prices = normalizedSalesOptions(recipe)
    .map((option) => Number(option.price || 0))
    .filter((price) => Number.isFinite(price) && price >= 0);
  if (prices.length) return Math.min(...prices);
  return Math.max(0, Number(recipe.price || 0));
}

function shelfItemFromRecipe(recipe = {}) {
  return {
    ...blankShelfItem(),
    sourceType: "recipe",
    recipeId: recipeKey(recipe),
    name: cleanText(recipe.name) || "Ready shelf item",
    description: recipeDetails(recipe),
    price: recipeShelfPrice(recipe),
  };
}

function buildShelfItem(recipes = []) {
  return recipes.length ? shelfItemFromRecipe(recipes[0]) : blankShelfItem();
}

function findRecipeByForm(recipes = [], form = {}) {
  const requestedKey = cleanText(form.recipeId);
  if (requestedKey) {
    const exactMatch = recipes.find((recipe, index) => recipeKey(recipe, index) === requestedKey);
    if (exactMatch) return exactMatch;
  }
  const nameKey = normalizeKey(form.name);
  return nameKey ? recipes.find((recipe) => normalizeKey(recipe.name) === nameKey) : null;
}

function shelfFormFromItem(item = {}, recipes = []) {
  const recipe = findRecipeByForm(recipes, item);
  return {
    ...item,
    price: Number(item.price_cents || 0) / 100,
    isNew: false,
    sourceType: recipe ? "recipe" : "custom",
    recipeId: recipe ? recipeKey(recipe) : "",
  };
}

function applyRecipeToShelfForm(current = {}, recipe = {}) {
  return {
    ...current,
    sourceType: "recipe",
    recipeId: recipeKey(recipe),
    name: cleanText(recipe.name) || current.name,
    description: recipeDetails(recipe),
    price: recipeShelfPrice(recipe),
  };
}

export function ReadyShelf({ cloudAccount, enabled = true, onShelfChange, recipes = [] }) {
  const bakeryId = cloudAccount.workspace?.bakeryId;
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const sortedRecipes = useMemo(() => [...recipes].sort((a, b) => (
    `${productTypeFor(a.productType || "bread").label} ${a.name || ""}`
      .localeCompare(`${productTypeFor(b.productType || "bread").label} ${b.name || ""}`)
  )), [recipes]);

  const loadShelf = useCallback(async () => {
    if (!bakeryId) {
      setItems([]);
      onShelfChange?.([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const nextItems = await listReadyShelfItems(bakeryId);
      setItems(nextItems);
      onShelfChange?.(nextItems);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setLoading(false);
    }
  }, [bakeryId, onShelfChange]);

  useEffect(() => {
    loadShelf();
  }, [loadShelf]);

  async function submitShelfItem(event) {
    event.preventDefault();
    setError("");
    const selectedRecipe = findRecipeByForm(sortedRecipes, form);
    try {
      await saveReadyShelfItem(bakeryId, {
        ...form,
        name: cleanText(form.name),
        description: (form.description || (selectedRecipe ? recipeDetails(selectedRecipe) : "")).trim(),
        quantity: Number(form.quantity),
        price_cents: Math.round(Number(form.price) * 100),
      });
      setForm(null);
      await loadShelf();
    } catch (nextError) {
      setError(nextError.message);
    }
  }

  async function removeShelfItem(item) {
    setError("");
    try {
      await deleteReadyShelfItem(item.id);
      await loadShelf();
    } catch (nextError) {
      setError(nextError.message);
    }
  }

  return (
    <section className="ready-shelf-panel">
      <div className="section-title-line">
        <div>
          <span className="eyebrow-label dark">Prebaked inventory</span>
          <h2>Ready-to-go shelf</h2>
          <small>Fresh stock customers can reserve without using bake capacity.</small>
        </div>
        <button
          type="button"
          className="round-action small"
          disabled={!bakeryId || !enabled}
          onClick={() => setForm(buildShelfItem(sortedRecipes))}
          aria-label="Add a loaf to the ready shelf"
        >
          <Plus size={18} />
        </button>
      </div>

      {!enabled ? (
        <div className="shelf-cloud-note"><PackageCheck size={17} /><span>The customer shelf is hidden. Turn it on in Bakery Settings when you have prebaked stock.</span></div>
      ) : null}
      {!bakeryId ? (
        <div className="shelf-cloud-note"><Cloud size={17} /><span>Sign in to your bakery cloud account to stock the public shelf.</span></div>
      ) : null}
      {loading ? <p className="shelf-loading">Checking the shelf…</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <div className={enabled ? "ready-shelf-list" : "ready-shelf-list feature-hidden"}>
        {items.map((item) => (
          <article className={item.active && item.quantity > 0 ? "ready-shelf-row" : "ready-shelf-row inactive"} key={item.id}>
            <span className="shelf-icon"><PackageCheck size={20} /></span>
            <span className="shelf-copy">
              <strong>{item.name}</strong>
              <small>{shelfAgeLabel(item.baked_on)} · {item.quantity} ready · {item.active ? "Visible to customers" : "Hidden"}</small>
            </span>
            <strong>${(Number(item.price_cents || 0) / 100).toFixed(2)}</strong>
            <button type="button" onClick={() => setForm(shelfFormFromItem(item, sortedRecipes))} aria-label={`Edit ${item.name}`}><Pencil size={15} /></button>
          </article>
        ))}
        {!loading && bakeryId && !items.length ? <EmptyState title="The shelf is empty" body="Add baked loaves, their bake date, quantity, and current shelf price." /> : null}
      </div>

      {form ? (
        <Modal title={form.isNew ? "Stock the ready shelf" : `Edit ${form.name}`} onClose={() => setForm(null)}>
          <form className="form-stack" onSubmit={submitShelfItem}>
            <div className="ready-shelf-source-grid">
              <label>Item source
                <select
                  value={sortedRecipes.length ? (form.sourceType || "custom") : "custom"}
                  onChange={(event) => {
                    if (event.target.value === "recipe" && sortedRecipes.length) {
                      setForm(applyRecipeToShelfForm(form, sortedRecipes[0]));
                      return;
                    }
                    setForm({ ...form, sourceType: "custom", recipeId: "" });
                  }}
                >
                  {sortedRecipes.length ? <option value="recipe">Saved recipe</option> : null}
                  <option value="custom">Custom item</option>
                </select>
              </label>
              {sortedRecipes.length && (form.sourceType || "custom") === "recipe" ? (
                <label>Saved recipe
                  <select
                    value={form.recipeId || recipeKey(sortedRecipes[0])}
                    onChange={(event) => {
                      const nextRecipe = sortedRecipes.find((recipe, index) => recipeKey(recipe, index) === event.target.value);
                      if (nextRecipe) setForm(applyRecipeToShelfForm(form, nextRecipe));
                    }}
                  >
                    {sortedRecipes.map((recipe, index) => {
                      const type = productTypeFor(recipe.productType || "bread");
                      return <option key={recipeKey(recipe, index)} value={recipeKey(recipe, index)}>{type.label} · {recipe.name}</option>;
                    })}
                  </select>
                </label>
              ) : null}
            </div>
            {sortedRecipes.length && (form.sourceType || "custom") === "recipe" ? (
              <button
                className="secondary-button compact"
                type="button"
                onClick={() => {
                  const selectedRecipe = findRecipeByForm(sortedRecipes, form) || sortedRecipes[0];
                  setForm(applyRecipeToShelfForm(form, selectedRecipe));
                }}
              >
                <RefreshCw size={14} /> Refresh details from recipe
              </button>
            ) : null}
            <label>Item name<input autoFocus required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Country sourdough" /></label>
            <label>Customer item details<textarea className="ready-shelf-details-input" value={form.description || ""} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Crackly crust, mild tang, ingredients, storage notes, or other details customers should see." /></label>
            <div className="form-grid">
              <label>Baked on<input required type="date" value={form.baked_on} onChange={(event) => setForm({ ...form, baked_on: event.target.value })} /></label>
              <label>Quantity ready<input required min="0" max="24" type="number" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label>
            </div>
            <label>Price per item<input required min="0" step="0.01" type="number" value={form.price ?? Number(form.price_cents || 0) / 100} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label>
            <label className="checkbox-line"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /><span>Show this item on the customer shelf</span></label>
            <p className="form-help">{shelfAgeLabel(form.baked_on)}. Setting quantity to zero will mark it sold out.</p>
            <button className="primary-button" type="submit">Save shelf item</button>
            {!form.isNew ? <button className="delete-order-button" type="button" onClick={() => {
              removeShelfItem(form);
              setForm(null);
            }}><Trash2 size={15} /> Remove from shelf</button> : null}
          </form>
        </Modal>
      ) : null}
    </section>
  );
}
