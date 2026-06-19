import { ChevronRight, Droplets, Plus, Search, Trash2, Wheat } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeading } from "../components/AppChrome";
import { EmptyState, Modal } from "../components/Primitives";

const emptyRecipe = {
  name: "",
  note: "",
  yield: 4,
  hydration: 75,
  price: 13,
};

export default function RecipesPage({ recipes, onAddRecipe, onDeleteRecipe }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [loaves, setLoaves] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState(emptyRecipe);
  const selected = recipes.find((recipe) => recipe.id === selectedId);
  const filtered = useMemo(() => recipes.filter((recipe) => recipe.name.toLowerCase().includes(query.toLowerCase())), [query, recipes]);

  function submitRecipe(event) {
    event.preventDefault();
    if (!form.name.trim()) return;
    const flourWeight = form.yield * 500;
    onAddRecipe({
      ...form,
      id: `${form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${Date.now()}`,
      name: form.name.trim(),
      note: form.note.trim() || "Your custom house formula",
      yield: Number(form.yield),
      hydration: Number(form.hydration),
      price: Number(form.price),
      ingredients: [
        { name: "Bread flour", weight: flourWeight, percent: 100 },
        { name: "Water", weight: Math.round(flourWeight * Number(form.hydration) / 100), percent: Number(form.hydration) },
        { name: "Starter", weight: Math.round(flourWeight * .2), percent: 20 },
        { name: "Salt", weight: Math.round(flourWeight * .02), percent: 2 },
      ],
    });
    setForm(emptyRecipe);
    setShowAdd(false);
  }

  if (selected) {
    const factor = loaves / selected.yield;
    const total = selected.ingredients.reduce((sum, item) => sum + Math.round(item.weight * factor), 0);
    return (
      <main className="page recipe-detail">
        <button className="text-back" onClick={() => setSelectedId(null)}>← Recipes</button>
        <div className="recipe-detail-heading">
          <span className="recipe-icon"><Wheat /></span>
          <div><h1>{selected.name}</h1><p>{selected.note}</p></div>
        </div>
        <div className="recipe-facts">
          <span><Droplets size={17} /> {selected.hydration}% hydration</span>
          <span>${selected.price.toFixed(2)} per loaf</span>
        </div>
        <div className="section-title-line">
          <h2>Formula</h2>
          <div className="compact-stepper">
            <button onClick={() => setLoaves((value) => Math.max(1, value - 1))}>−</button>
            <span>{loaves} {loaves === 1 ? "loaf" : "loaves"}</span>
            <button onClick={() => setLoaves((value) => Math.min(24, value + 1))}>+</button>
          </div>
        </div>
        <div className="formula-table large">
          <div className="formula-head"><span>Ingredient</span><span>Weight</span><span>Baker’s %</span></div>
          {selected.ingredients.map((item) => (
            <div className="formula-row" key={item.name}>
              <span>{item.name}</span>
              <span>{Math.round(item.weight * factor).toLocaleString()} g</span>
              <span>{item.percent}%</span>
            </div>
          ))}
          <div className="formula-row total"><span>Total dough</span><span>{total.toLocaleString()} g</span><span /></div>
        </div>
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
      </main>
    );
  }

  return (
    <main className="page">
      <PageHeading
        title="Recipes"
        subtitle="Every formula scales itself. Your flour is always 100%."
        action={<button className="round-action" onClick={() => setShowAdd(true)} aria-label="Add recipe"><Plus size={21} /></button>}
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
          <p>Change the loaf count and Loafers recalculates every ingredient while preserving your formula.</p>
        </div>
      </aside>

      {showAdd ? (
        <Modal title="Add a recipe" onClose={() => setShowAdd(false)}>
          <form className="form-stack" onSubmit={submitRecipe}>
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
                Base yield
                <input type="number" min="1" max="24" value={form.yield} onChange={(event) => setForm({ ...form, yield: Number(event.target.value) })} />
              </label>
              <label>
                Hydration %
                <input type="number" min="50" max="120" value={form.hydration} onChange={(event) => setForm({ ...form, hydration: Number(event.target.value) })} />
              </label>
            </div>
            <label>
              Price per loaf
              <input type="number" min="0" step="0.5" value={form.price} onChange={(event) => setForm({ ...form, price: Number(event.target.value) })} />
            </label>
            <p className="form-help">The starter formula begins with flour, water, starter, and salt. You can scale it immediately with baker’s percentages.</p>
            <button className="primary-button" type="submit">Add recipe</button>
          </form>
        </Modal>
      ) : null}
    </main>
  );
}
