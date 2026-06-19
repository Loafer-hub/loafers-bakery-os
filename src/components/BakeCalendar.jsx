import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function BakeCalendar({ month, plans, onChangeMonth, onSelectDate, onOpenPlan }) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });
  const plansByDate = new Map();

  plans.forEach((plan) => {
    const items = plansByDate.get(plan.date) || [];
    items.push(plan);
    plansByDate.set(plan.date, items);
  });

  const monthPlans = plans
    .filter((plan) => {
      const [planYear, planMonth] = plan.date.split("-").map(Number);
      return planYear === year && planMonth === monthIndex + 1;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <section className="calendar-panel" aria-label="Monthly bake calendar">
      <div className="calendar-heading">
        <button type="button" onClick={() => onChangeMonth(-1)} aria-label="Previous month">
          <ChevronLeft size={18} />
        </button>
        <h2>{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2>
        <button type="button" onClick={() => onChangeMonth(1)} aria-label="Next month">
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="calendar-weekdays" aria-hidden="true">
        {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="calendar-grid">
        {cells.map((day, index) => {
          if (!day) return <span className="calendar-blank" key={`blank-${index}`} />;
          const date = dateKey(year, monthIndex, day);
          const datePlans = plansByDate.get(date) || [];
          const firstPlan = datePlans[0];
          return (
            <button
              className={datePlans.length ? "calendar-day has-bake" : "calendar-day"}
              key={date}
              type="button"
              onClick={() => firstPlan ? onOpenPlan(firstPlan) : onSelectDate(date)}
              aria-label={firstPlan
                ? `${date}: ${firstPlan.loaves} loaf ${firstPlan.recipeName} bake`
                : `${date}: add a bake`}
            >
              <span>{day}</span>
              {firstPlan ? (
                <small>{firstPlan.loaves} · {firstPlan.recipeName}</small>
              ) : <Plus size={12} />}
              {datePlans.length > 1 ? <i>+{datePlans.length - 1}</i> : null}
            </button>
          );
        })}
      </div>
      <div className="month-bake-list">
        <div className="section-title-line">
          <h3>Planned this month</h3>
          <span>{monthPlans.length} {monthPlans.length === 1 ? "bake" : "bakes"}</span>
        </div>
        {monthPlans.length ? monthPlans.map((plan) => (
          <button type="button" className="planned-bake-row" key={plan.id} onClick={() => onOpenPlan(plan)}>
            <span className="planned-bake-date">
              <strong>{Number(plan.date.slice(-2))}</strong>
              <small>{new Date(`${plan.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" })}</small>
            </span>
            <span>
              <strong>{plan.recipeName}</strong>
              <small>{plan.loaves} {plan.loaves === 1 ? "loaf" : "loaves"}</small>
            </span>
            <ChevronRight size={17} />
          </button>
        )) : (
          <button type="button" className="calendar-empty" onClick={() => onSelectDate(dateKey(year, monthIndex, 1))}>
            <Plus size={18} />
            Add the first bake this month
          </button>
        )}
      </div>
    </section>
  );
}
