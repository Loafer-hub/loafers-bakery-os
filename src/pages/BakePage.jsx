import {
  AlertTriangle,
  Check,
  Clock3,
  Minus,
  Pencil,
  Plus,
  Thermometer,
  TrendingUp,
  Wheat,
} from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeading } from "../components/AppChrome";
import { Modal } from "../components/Primitives";

function formatTime(value) {
  if (!value) return "";
  const [hourString, minute] = value.split(":");
  const hour = Number(hourString);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${suffix}`;
}

export default function BakePage({
  recipes,
  schedule,
  setSchedule,
  onPlanCreated,
  onStarterLogged,
}) {
  const [view, setView] = useState("plan");
  const [recipeId, setRecipeId] = useState("country");
  const [loaves, setLoaves] = useState(8);
  const [editing, setEditing] = useState(null);
  const [starterModal, setStarterModal] = useState(false);
  const [starterForm, setStarterForm] = useState({ ratio: "1:2:2", temperature: 76, rise: 2.1, note: "" });
  const recipe = recipes.find((item) => item.id === recipeId) ?? recipes[0];

  const scaledIngredients = useMemo(() => {
    const factor = loaves / recipe.yield;
    return recipe.ingredients.map((item) => ({ ...item, scaledWeight: Math.round(item.weight * factor) }));
  }, [loaves, recipe]);

  const totalDough = scaledIngredients.reduce((sum, item) => sum + item.scaledWeight, 0);

  function updateTime(id, time) {
    setSchedule((current) => current.map((item) => item.id === id ? { ...item, time } : item));
    setEditing(null);
  }

  function submitStarter(event) {
    event.preventDefault();
    onStarterLogged(starterForm);
    setStarterModal(false);
  }

  return (
    <main className="page bake-page">
      <PageHeading
        title={view === "plan" ? "Plan a bake" : "Starter"}
        subtitle="Saturday, June 20"
        action={view === "plan" ? <button className="heading-action" onClick={() => onPlanCreated("Bake plan saved")}>Save</button> : null}
      />
      <div className="view-switch">
        <button className={view === "plan" ? "selected" : ""} onClick={() => setView("plan")}>Planner</button>
        <button className={view === "starter" ? "selected" : ""} onClick={() => setView("starter")}>Starter</button>
      </div>

      {view === "plan" ? (
        <>
          <section className="capacity-heading">
            <span><b>10 loaf</b> oven capacity</span>
            <span>{loaves} planned</span>
          </section>

          <section className="schedule-list" aria-label="Bake schedule">
            {schedule.map((item) => (
              <div className="schedule-row" key={item.id}>
                <span className="schedule-dot" />
                <strong>{item.label}</strong>
                <span>{formatTime(item.time)}{item.endTime ? `–${formatTime(item.endTime)}` : ""}</span>
                <small>{item.day}</small>
                <button className="edit-time" onClick={() => setEditing(item)} aria-label={`Edit ${item.label} time`}>
                  <Pencil size={16} />
                </button>
              </div>
            ))}
          </section>

          <div className="warning-callout">
            <AlertTriangle size={20} />
            Starter peaks 45 min before mix
          </div>

          <section className="formula-panel">
            <div className="formula-title-row">
              <div>
                <select value={recipeId} onChange={(event) => setRecipeId(event.target.value)} aria-label="Recipe">
                  {recipes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <span>· {loaves} loaves</span>
              </div>
              <span>{recipe.hydration}% hydration</span>
            </div>
            <div className="formula-table" role="table" aria-label="Baker's percentage formula">
              <div className="formula-head" role="row">
                <span>Ingredient</span><span>Weight</span><span>Baker’s %</span>
              </div>
              {scaledIngredients.map((item) => (
                <div className="formula-row" role="row" key={item.name}>
                  <span>{item.name}</span>
                  <span>{item.scaledWeight.toLocaleString()} g</span>
                  <span>{item.percent}%</span>
                </div>
              ))}
              <div className="formula-row total" role="row">
                <span>Total dough</span><span>{totalDough.toLocaleString()} g</span><span />
              </div>
            </div>
          </section>

          <div className="stepper-row">
            <strong>Loaves</strong>
            <div className="stepper">
              <button onClick={() => setLoaves((current) => Math.max(1, current - 1))} aria-label="Decrease loaves"><Minus /></button>
              <span>{loaves}</span>
              <button onClick={() => setLoaves((current) => Math.min(24, current + 1))} aria-label="Increase loaves"><Plus /></button>
            </div>
          </div>

          <button className="primary-button" onClick={() => onPlanCreated(`${loaves}-loaf ${recipe.name} plan created`)}>
            Create bake plan
          </button>
        </>
      ) : (
        <section className="starter-lab">
          <div className="starter-hero">
            <span className="starter-jar"><Wheat size={46} /></span>
            <div>
              <p>Your starter</p>
              <h2>Mabel</h2>
              <span className="starter-live"><i /> Active · fed 3h ago</span>
            </div>
          </div>

          <div className="starter-reading-grid">
            <div><TrendingUp /><strong>2.1×</strong><span>current rise</span></div>
            <div><Thermometer /><strong>76°F</strong><span>jar temp</span></div>
            <div><Clock3 /><strong>1h 20m</strong><span>until peak</span></div>
          </div>

          <div className="starter-curve">
            <div className="section-title-line">
              <h3>Rise trend</h3>
              <span>Last 12 hours</span>
            </div>
            <svg viewBox="0 0 320 110" role="img" aria-label="Starter rise trend increasing toward peak">
              <path className="chart-fill" d="M0 100 C55 98,80 86,115 76 S175 50,205 35 S265 16,320 20 L320 110 L0 110 Z" />
              <path className="chart-line" d="M0 100 C55 98,80 86,115 76 S175 50,205 35 S265 16,320 20" />
              <circle cx="285" cy="18" r="5" />
            </svg>
            <div className="chart-labels"><span>6 AM</span><span>Noon</span><span>Now</span></div>
          </div>

          <div className="starter-history">
            <div className="section-title-line"><h3>Recent feeds</h3><button onClick={() => setStarterModal(true)}>Log feed</button></div>
            {[
              ["Today · 7:30 AM", "1:2:2", "Peak in 4h 10m"],
              ["Yesterday · 8:10 PM", "1:3:3", "Peak in 6h 05m"],
              ["Tuesday · 6:45 AM", "1:2:2", "Peak in 4h 22m"],
            ].map(([date, ratio, result]) => (
              <div className="history-row" key={date}>
                <Check size={16} />
                <span><strong>{date}</strong><small>{ratio} feed</small></span>
                <small>{result}</small>
              </div>
            ))}
          </div>
        </section>
      )}

      {editing ? (
        <Modal title={`Edit ${editing.label}`} onClose={() => setEditing(null)}>
          <form className="form-stack" onSubmit={(event) => {
            event.preventDefault();
            updateTime(editing.id, event.currentTarget.time.value);
          }}>
            <label>Start time<input name="time" type="time" defaultValue={editing.time} /></label>
            <button className="primary-button" type="submit">Update schedule</button>
          </form>
        </Modal>
      ) : null}

      {starterModal ? (
        <Modal title="Log a starter feed" onClose={() => setStarterModal(false)}>
          <form className="form-stack" onSubmit={submitStarter}>
            <div className="form-grid">
              <label>Feed ratio<input value={starterForm.ratio} onChange={(e) => setStarterForm({ ...starterForm, ratio: e.target.value })} /></label>
              <label>Temperature<input type="number" value={starterForm.temperature} onChange={(e) => setStarterForm({ ...starterForm, temperature: e.target.value })} /></label>
            </div>
            <label>Rise<input type="number" step="0.1" value={starterForm.rise} onChange={(e) => setStarterForm({ ...starterForm, rise: e.target.value })} /></label>
            <label>Notes<textarea value={starterForm.note} onChange={(e) => setStarterForm({ ...starterForm, note: e.target.value })} placeholder="Aroma, texture, flour blend…" /></label>
            <button className="primary-button" type="submit">Save starter log</button>
          </form>
        </Modal>
      ) : null}
    </main>
  );
}
