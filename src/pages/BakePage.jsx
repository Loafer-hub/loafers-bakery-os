import {
  AlertTriangle,
  Check,
  Clock3,
  Minus,
  Pencil,
  Plus,
  Thermometer,
  Trash2,
  TrendingUp,
  Wheat,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeading } from "../components/AppChrome";
import { BakeCalendar } from "../components/BakeCalendar";
import { EmptyState, Modal } from "../components/Primitives";

function formatTime(value) {
  if (!value) return "";
  const [hourString, minute] = value.split(":");
  const hour = Number(hourString);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${suffix}`;
}

function formatPlanDate(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function localDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function initialPlanDate() {
  const date = new Date();
  date.setDate(date.getDate() + 2);
  return localDateKey(date);
}

export default function BakePage({
  recipes,
  schedule,
  setSchedule,
  bakePlans,
  onDeleteBakePlan,
  onSaveBakePlan,
  onStarterLogged,
}) {
  const [view, setView] = useState("plan");
  const [recipeId, setRecipeId] = useState(recipes[0]?.id || "");
  const [loaves, setLoaves] = useState(recipes[0]?.yield || 1);
  const [planDate, setPlanDate] = useState(initialPlanDate);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const date = new Date(`${initialPlanDate()}T12:00:00`);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [editing, setEditing] = useState(null);
  const [planModal, setPlanModal] = useState(null);
  const [confirmPlanDelete, setConfirmPlanDelete] = useState(false);
  const [starterModal, setStarterModal] = useState(false);
  const [starterForm, setStarterForm] = useState({ ratio: "1:2:2", temperature: 76, rise: 2.1, note: "" });
  const recipe = recipes.find((item) => item.id === recipeId) ?? recipes[0];

  useEffect(() => {
    if (!recipes.length) {
      setRecipeId("");
      return;
    }
    if (!recipes.some((item) => item.id === recipeId)) {
      setRecipeId(recipes[0].id);
      setLoaves(recipes[0].yield);
    }
  }, [recipeId, recipes]);

  const scaledIngredients = useMemo(() => {
    if (!recipe) return [];
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

  function savePlannerBake() {
    if (!recipe) return;
    onSaveBakePlan({
      id: Date.now(),
      date: planDate,
      recipeId: recipe.id,
      recipeName: recipe.name,
      loaves,
      isNew: true,
    });
    const month = new Date(`${planDate}T12:00:00`);
    setCalendarMonth(new Date(month.getFullYear(), month.getMonth(), 1));
  }

  function openNewPlan(date) {
    const defaultRecipe = recipes[0];
    if (!defaultRecipe) return;
    setPlanModal({
      id: Date.now(),
      date,
      recipeId: defaultRecipe.id,
      recipeName: defaultRecipe.name,
      loaves: defaultRecipe.yield,
      isNew: true,
    });
    setConfirmPlanDelete(false);
  }

  function openExistingPlan(plan) {
    setPlanModal({ ...plan, isNew: false });
    setConfirmPlanDelete(false);
  }

  function submitCalendarPlan(event) {
    event.preventDefault();
    const chosenRecipe = recipes.find((item) => item.id === planModal.recipeId);
    onSaveBakePlan({
      ...planModal,
      recipeName: chosenRecipe?.name || planModal.recipeName,
      loaves: Number(planModal.loaves),
    });
    setPlanModal(null);
  }

  const headingTitle = view === "plan" ? "Plan a bake" : view === "calendar" ? "Bake calendar" : "Starter";
  const headingSubtitle = view === "calendar"
    ? `${bakePlans.length} ${bakePlans.length === 1 ? "planned bake" : "planned bakes"}`
    : view === "plan" ? formatPlanDate(planDate) : "Mabel’s activity and feed history";

  return (
    <main className="page bake-page">
      <PageHeading
        title={headingTitle}
        subtitle={headingSubtitle}
        action={view === "calendar" && recipes.length ? (
          <button className="round-action" type="button" onClick={() => openNewPlan(localDateKey(new Date()))} aria-label="Add planned bake">
            <Plus size={20} />
          </button>
        ) : null}
      />
      <div className="view-switch bake-view-switch">
        <button className={view === "plan" ? "selected" : ""} onClick={() => setView("plan")}>Planner</button>
        <button className={view === "calendar" ? "selected" : ""} onClick={() => setView("calendar")}>Calendar</button>
        <button className={view === "starter" ? "selected" : ""} onClick={() => setView("starter")}>Starter</button>
      </div>

      {view === "plan" ? (
        recipe ? (
          <>
            <label className="plan-date-field">
              Bake date
              <input type="date" value={planDate} onChange={(event) => setPlanDate(event.target.value)} />
            </label>
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
                  <select value={recipeId} onChange={(event) => {
                    const nextRecipe = recipes.find((item) => item.id === event.target.value);
                    setRecipeId(event.target.value);
                    if (nextRecipe) setLoaves(nextRecipe.yield);
                  }} aria-label="Recipe">
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

            <button className="primary-button" onClick={savePlannerBake}>
              Add bake to calendar
            </button>
          </>
        ) : (
          <EmptyState title="Add a recipe first" body="The planner needs at least one formula. Add one from the Recipes tab." />
        )
      ) : null}

      {view === "calendar" ? (
        <BakeCalendar
          month={calendarMonth}
          plans={bakePlans}
          onChangeMonth={(amount) => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1))}
          onSelectDate={openNewPlan}
          onOpenPlan={openExistingPlan}
        />
      ) : null}

      {view === "starter" ? (
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
      ) : null}

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

      {planModal ? (
        <Modal title={planModal.isNew ? "Plan a bake" : "Change planned bake"} onClose={() => setPlanModal(null)}>
          <form className="form-stack" onSubmit={submitCalendarPlan}>
            <label>
              Bake date
              <input type="date" value={planModal.date} onChange={(event) => setPlanModal({ ...planModal, date: event.target.value })} />
            </label>
            <label>
              Recipe
              <select value={planModal.recipeId} onChange={(event) => setPlanModal({ ...planModal, recipeId: event.target.value })}>
                {recipes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label>
              Loaves
              <input type="number" min="1" max="24" value={planModal.loaves} onChange={(event) => setPlanModal({ ...planModal, loaves: Number(event.target.value) })} />
            </label>
            <button className="primary-button" type="submit">{planModal.isNew ? "Add to calendar" : "Save changes"}</button>
            {!planModal.isNew ? confirmPlanDelete ? (
              <div className="delete-confirmation">
                <span>Delete this planned bake?</span>
                <div>
                  <button type="button" className="text-button" onClick={() => setConfirmPlanDelete(false)}>Keep it</button>
                  <button type="button" className="danger-button" onClick={() => {
                    onDeleteBakePlan(planModal.id);
                    setPlanModal(null);
                  }}>Delete bake</button>
                </div>
              </div>
            ) : (
              <button className="delete-order-button" type="button" onClick={() => setConfirmPlanDelete(true)}>
                <Trash2 size={15} />
                Delete planned bake
              </button>
            ) : null}
          </form>
        </Modal>
      ) : null}

      {starterModal ? (
        <Modal title="Log a starter feed" onClose={() => setStarterModal(false)}>
          <form className="form-stack" onSubmit={submitStarter}>
            <div className="form-grid">
              <label>Feed ratio<input value={starterForm.ratio} onChange={(event) => setStarterForm({ ...starterForm, ratio: event.target.value })} /></label>
              <label>Temperature<input type="number" value={starterForm.temperature} onChange={(event) => setStarterForm({ ...starterForm, temperature: event.target.value })} /></label>
            </div>
            <label>Rise<input type="number" step="0.1" value={starterForm.rise} onChange={(event) => setStarterForm({ ...starterForm, rise: event.target.value })} /></label>
            <label>Notes<textarea value={starterForm.note} onChange={(event) => setStarterForm({ ...starterForm, note: event.target.value })} placeholder="Aroma, texture, flour blend…" /></label>
            <button className="primary-button" type="submit">Save starter log</button>
          </form>
        </Modal>
      ) : null}
    </main>
  );
}
