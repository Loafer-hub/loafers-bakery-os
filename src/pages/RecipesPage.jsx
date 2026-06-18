import { ChevronRight, Droplets, Plus, Search, Wheat } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeading } from "../components/AppChrome";

export default function RecipesPage({ recipes }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [loaves, setLoaves] = useState(1);
  const selected = recipes.find((recipe) => recipe.id === selectedId);
  const filtered = useMemo(() => recipes.filter((recipe) => recipe.name.toLowerCase().includes(query.toLowerCase())), [query, recipes]);

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
      </main>
    );
  }

  return (
    <main className="page">
      <PageHeading
        title="Recipes"
        subtitle="Every formula scales itself. Your flour is always 100%."
        action={<button className="round-action" aria-label="Add recipe"><Plus size={21} /></button>}
      />
      <label className="search-field full">
        <Search size={17} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search recipes" />
      </label>
      <section className="recipe-list">
        {filtered.map((recipe) => (
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
        ))}
      </section>
      <aside className="bakers-percent-note">
        <Droplets size={21} />
        <div>
          <h3>Baker’s percentage, without the math headache</h3>
          <p>Change the loaf count and Loafers recalculates every ingredient while preserving your formula.</p>
        </div>
      </aside>
    </main>
  );
}
