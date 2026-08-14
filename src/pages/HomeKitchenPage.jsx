import {
  CalendarDays,
  Check,
  ChefHat,
  ChevronDown,
  Clock3,
  CookingPot,
  ListChecks,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePersistentState } from "../hooks/usePersistentState";
import { recipeUsesStarter } from "../lib/recipeTimeline";

const COOKBOOK_KEY = "loafers-cookbook-v1";
const FILTERS = ["all", "planned", "active", "completed"];

function localDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function dateLabel(value) {
  if (!value) return "Unscheduled";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function normalizedLibraryRecipe(recipe, source = "cookbook") {
  return {
    ...recipe,
    source,
    id: source === "catalog" ? `catalog-${recipe.id}` : recipe.id,
    sourceRecipeId: recipe.id,
    servings: Number(recipe.servings || recipe.yield || 1),
    ingredients: recipe.ingredients || [],
    steps: recipe.steps?.length
      ? recipe.steps
      : recipe.instructions?.length
        ? recipe.instructions
        : ["Review the saved recipe and add the cooking steps you want to track."],
  };
}

export default function HomeKitchenPage({
  recipes = [],
  homeKitchenJobs = [],
  homeKitchenFocus,
  onScheduleCookbookRecipe,
  onSaveHomeKitchenJob,
  onDeleteHomeKitchenJob,
}) {
  const [cookbook] = usePersistentState(COOKBOOK_KEY, { recipes: [], plans: [], manualShopping: [] });
  const [filter, setFilter] = useState("all");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [recipeId, setRecipeId] = useState("");
  const [scheduledDate, setScheduledDate] = useState(localDateKey());
  const [servings, setServings] = useState(1);

  const library = useMemo(() => {
    const cookbookRecipes = (cookbook?.recipes || []).map((recipe) => normalizedLibraryRecipe(recipe, "cookbook"));
    const directRecipes = recipes
      .filter((recipe) => !recipeUsesStarter(recipe))
      .map((recipe) => normalizedLibraryRecipe(recipe, "catalog"));
    const seen = new Set();
    return [...cookbookRecipes, ...directRecipes].filter((recipe) => {
      const key = String(recipe.name || "").trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [cookbook?.recipes, recipes]);

  useEffect(() => {
    if (!recipeId && library[0]) {
      setRecipeId(library[0].id);
      setServings(Math.max(1, Number(library[0].servings || 1)));
    }
  }, [library, recipeId]);

  useEffect(() => {
    if (!homeKitchenFocus?.planId) return;
    const job = homeKitchenJobs.find((item) => item.planId === homeKitchenFocus.planId);
    if (job) {
      setSelectedJobId(job.id);
      setFilter("all");
    }
  }, [homeKitchenFocus, homeKitchenJobs]);

  const selectedRecipe = library.find((recipe) => recipe.id === recipeId) || library[0] || null;
  const visibleJobs = useMemo(() => [...homeKitchenJobs]
    .filter((job) => filter === "all" || job.status === filter)
    .sort((a, b) => `${a.scheduledDate || ""}-${a.createdAt || ""}`.localeCompare(`${b.scheduledDate || ""}-${b.createdAt || ""}`)), [filter, homeKitchenJobs]);
  const today = localDateKey();
  const plannedCount = homeKitchenJobs.filter((job) => job.status === "planned").length;
  const activeCount = homeKitchenJobs.filter((job) => job.status === "active").length;
  const completedCount = homeKitchenJobs.filter((job) => job.status === "completed").length;
  const todayCount = homeKitchenJobs.filter((job) => job.scheduledDate === today && job.status !== "completed").length;

  function scheduleRecipe() {
    if (!selectedRecipe) return;
    onScheduleCookbookRecipe?.(selectedRecipe, {
      date: scheduledDate,
      servings: Math.max(1, Number(servings || 1)),
      source: selectedRecipe.source,
    });
  }

  function updateJob(job, changes) {
    onSaveHomeKitchenJob?.({ ...job, ...changes, updatedAt: new Date().toISOString() });
  }

  function toggleStep(job, index) {
    const checks = { ...(job.checks || {}), [index]: !job.checks?.[index] };
    updateJob(job, { checks });
  }

  return (
    <main className="page home-kitchen-page">
      <section className="home-kitchen-hero">
        <div>
          <span className="eyebrow-label dark">Home cooking workspace</span>
          <h1>Home Kitchen</h1>
          <p>Plan cookbook meals and direct or yeast recipes, then track every cooking step without mixing them into the sourdough bench.</p>
        </div>
        <CookingPot size={42} />
      </section>

      <section className="home-kitchen-metrics" aria-label="Home Kitchen status">
        <article><CalendarDays /><span><small>Planned</small><strong>{plannedCount}</strong></span></article>
        <article><Clock3 /><span><small>Today</small><strong>{todayCount}</strong></span></article>
        <article><ChefHat /><span><small>Cooking</small><strong>{activeCount}</strong></span></article>
        <article><Check /><span><small>Completed</small><strong>{completedCount}</strong></span></article>
      </section>

      <section className="home-kitchen-scheduler">
        <div className="home-kitchen-section-title">
          <span><Plus size={18} /></span>
          <div><small>Quick plan</small><h2>Put a recipe on the Production calendar</h2></div>
        </div>
        <div className="home-kitchen-schedule-grid">
          <label>Recipe<select value={recipeId} onChange={(event) => {
            const nextId = event.target.value;
            const nextRecipe = library.find((recipe) => recipe.id === nextId);
            setRecipeId(nextId);
            setServings(Math.max(1, Number(nextRecipe?.servings || 1)));
          }}>{library.map((recipe) => <option value={recipe.id} key={recipe.id}>{recipe.name} · {recipe.source === "catalog" ? "Bakery recipe" : "Cookbook"}</option>)}</select></label>
          <label>Cooking date<input type="date" min={today} value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} /></label>
          <label>Servings / items<input type="number" min="1" value={servings} onChange={(event) => setServings(event.target.value)} /></label>
          <button className="primary-button" type="button" disabled={!selectedRecipe} onClick={scheduleRecipe}><CalendarDays size={17} /> Add to calendar</button>
        </div>
        {!library.length ? <p className="home-kitchen-empty">Add a recipe in the Cookbook or save a non-starter recipe in Menu first.</p> : null}
      </section>

      <section className="home-kitchen-board">
        <div className="home-kitchen-board-heading">
          <div><span className="eyebrow-label dark">Cooking queue</span><h2>Recipe work</h2></div>
          <div className="home-kitchen-filters" aria-label="Filter Home Kitchen jobs">
            {FILTERS.map((item) => <button type="button" className={filter === item ? "selected" : ""} onClick={() => setFilter(item)} key={item}>{item === "all" ? "All" : item === "active" ? "Cooking" : item[0].toUpperCase() + item.slice(1)}</button>)}
          </div>
        </div>

        <div className="home-kitchen-job-list">
          {visibleJobs.map((job) => {
            const open = selectedJobId === job.id;
            const completeSteps = Object.values(job.checks || {}).filter(Boolean).length;
            return (
              <article className={`home-kitchen-job ${job.status}`} key={job.id}>
                <button className="home-kitchen-job-summary" type="button" onClick={() => setSelectedJobId(open ? "" : job.id)}>
                  <span className="home-kitchen-job-photo">{job.photo ? <img src={job.photo} alt="" /> : <UtensilsCrossed size={22} />}</span>
                  <span><small>{dateLabel(job.scheduledDate)} · {job.servings || 1} servings</small><strong>{job.recipeName}</strong><em>{job.status === "active" ? `${completeSteps}/${job.steps?.length || 0} steps complete` : job.source === "catalog" ? "Bakery recipe" : "Cookbook recipe"}</em></span>
                  <b>{job.status === "active" ? "Cooking" : job.status}</b>
                  <ChevronDown className={open ? "open" : ""} size={19} />
                </button>
                {open ? (
                  <div className="home-kitchen-job-detail">
                    <div className="home-kitchen-recipe-grid">
                      <section><h3>Ingredients</h3><ul>{(job.ingredients || []).map((ingredient, index) => <li key={ingredient.id || `${ingredient.name}-${index}`}><span>{ingredient.name}</span><b>{ingredient.amount || ingredient.weight || ""} {ingredient.unit || ""}</b></li>)}</ul></section>
                      <section><h3>Cooking checklist</h3><ol>{(job.steps || []).map((step, index) => <li className={job.checks?.[index] ? "done" : ""} key={`${index}-${step}`}><button type="button" onClick={() => toggleStep(job, index)}><span>{job.checks?.[index] ? <Check size={15} /> : index + 1}</span><p>{step}</p></button></li>)}</ol></section>
                    </div>
                    {job.notes || job.temps ? <div className="home-kitchen-notes">{job.temps ? <span><Clock3 size={15} /> {job.temps}</span> : null}{job.notes ? <p>{job.notes}</p> : null}</div> : null}
                    <div className="home-kitchen-job-actions">
                      {job.status === "planned" ? <button className="primary-button" type="button" onClick={() => updateJob(job, { status: "active", startedAt: new Date().toISOString() })}><Play size={16} /> Start cooking</button> : null}
                      {job.status === "active" ? <button className="primary-button" type="button" onClick={() => updateJob(job, { status: "completed", completedAt: new Date().toISOString() })}><Check size={16} /> Complete</button> : null}
                      {job.status === "completed" ? <button className="secondary-button" type="button" onClick={() => updateJob(job, { status: "active", completedAt: "" })}><RotateCcw size={16} /> Reopen</button> : null}
                      <button className="secondary-button danger" type="button" onClick={() => onDeleteHomeKitchenJob?.(job.id)}><Trash2 size={16} /> Remove</button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
          {!visibleJobs.length ? <div className="home-kitchen-empty"><ListChecks size={24} /><strong>No {filter === "all" ? "Home Kitchen" : filter} recipes yet.</strong><span>Schedule one above or use Add to Production in the Cookbook.</span></div> : null}
        </div>
      </section>
    </main>
  );
}
