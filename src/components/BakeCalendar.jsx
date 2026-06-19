import { CalendarOff, ChevronLeft, ChevronRight, Plus } from "lucide-react";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function BakeCalendar({
  month,
  plans,
  orderBakes = [],
  unavailableDays = [],
  availabilityMode,
  availabilitySaving,
  canManageAvailability,
  availabilityError,
  onChangeMonth,
  onSelectDate,
  onOpenPlan,
  onToggleAvailabilityMode,
  onToggleUnavailable,
}) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });
  const plansByDate = new Map();
  const ordersByDate = new Map();
  const unavailableByDate = new Map(unavailableDays.map((day) => [day.unavailable_date, day]));

  plans.forEach((plan) => {
    const items = plansByDate.get(plan.date) || [];
    items.push(plan);
    plansByDate.set(plan.date, items);
  });

  orderBakes.forEach((orderBake) => {
    const items = ordersByDate.get(orderBake.date) || [];
    items.push(orderBake);
    ordersByDate.set(orderBake.date, items);
  });

  const monthPlans = plans
    .filter((plan) => {
      const [planYear, planMonth] = plan.date.split("-").map(Number);
      return planYear === year && planMonth === monthIndex + 1;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const monthOrderBakes = orderBakes
    .filter((orderBake) => {
      const [orderYear, orderMonth] = orderBake.date.split("-").map(Number);
      return orderYear === year && orderMonth === monthIndex + 1;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const monthEntries = [
    ...monthPlans.map((plan) => ({ ...plan, kind: "plan" })),
    ...monthOrderBakes,
  ].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <section className="calendar-panel" aria-label="Monthly bake calendar">
      <div className="availability-toolbar">
        <span><CalendarOff size={17} /><span><strong>Customer availability</strong><small>Block days when you cannot accept bake orders.</small></span></span>
        <button type="button" className={availabilityMode ? "selected" : ""} disabled={!canManageAvailability || availabilitySaving} onClick={onToggleAvailabilityMode}>
          {availabilityMode ? "Done blocking" : "Block days"}
        </button>
      </div>
      {!canManageAvailability ? <p className="availability-note">Sign in to your bakery cloud account to manage customer blackout days.</p> : null}
      {availabilityMode ? <p className="availability-mode-note">Tap dates to block or reopen them. Red-striped days are unavailable to customers.</p> : null}
      {availabilityError ? <p className="form-error" role="alert">{availabilityError}</p> : null}
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
          const dateOrders = ordersByDate.get(date) || [];
          const firstPlan = datePlans[0];
          const firstOrder = dateOrders[0];
          const totalEntries = datePlans.length + dateOrders.length;
          const unavailable = unavailableByDate.get(date);
          return (
            <button
              className={[
                "calendar-day",
                totalEntries ? "has-bake" : "",
                dateOrders.length ? "has-accepted-order" : "",
                unavailable ? "unavailable-bake-day" : "",
                availabilityMode ? "availability-editing" : "",
              ].filter(Boolean).join(" ")}
              key={date}
              type="button"
              onClick={() => availabilityMode
                ? onToggleUnavailable(date)
                : firstPlan
                  ? onOpenPlan(firstPlan)
                  : onSelectDate(date)}
              aria-label={availabilityMode
                ? `${date}: ${unavailable ? "reopen customer orders" : "block customer orders"}`
                : firstPlan
                ? `${date}: ${firstPlan.loaves} loaf ${firstPlan.recipeName} bake`
                : firstOrder
                  ? `${date}: accepted order for ${firstOrder.customer}; add a bake plan`
                : `${date}: add a bake`}
            >
              <span>{day}</span>
              {firstPlan ? (
                <small>{firstPlan.loaves} · {firstPlan.recipeName}</small>
              ) : firstOrder ? (
                <small>{firstOrder.loaves} · {firstOrder.customer}</small>
              ) : unavailable ? (
                <small>Unavailable</small>
              ) : <Plus size={12} />}
              {totalEntries > 1 ? <i>+{totalEntries - 1}</i> : null}
            </button>
          );
        })}
      </div>
      <div className="month-bake-list">
        <div className="section-title-line">
          <h3>Planned this month</h3>
          <span>{monthPlans.length} planned · {monthOrderBakes.length} accepted</span>
        </div>
        {monthEntries.length ? monthEntries.map((entry) => (
          entry.kind === "accepted-order" ? (
            <div className="planned-bake-row accepted-order-bake" key={entry.id}>
              <span className="planned-bake-date">
                <strong>{Number(entry.date.slice(-2))}</strong>
                <small>{new Date(`${entry.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" })}</small>
              </span>
              <span>
                <strong>{entry.customer}</strong>
                <small>{entry.loaves} {entry.loaves === 1 ? "loaf" : "loaves"} · accepted order</small>
              </span>
              <span className="accepted-order-badge">Accepted</span>
            </div>
          ) : (
            <button type="button" className="planned-bake-row" key={entry.id} onClick={() => onOpenPlan(entry)}>
              <span className="planned-bake-date">
                <strong>{Number(entry.date.slice(-2))}</strong>
                <small>{new Date(`${entry.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" })}</small>
              </span>
              <span>
                <strong>{entry.recipeName}</strong>
                <small>{entry.loaves} {entry.loaves === 1 ? "loaf" : "loaves"}</small>
              </span>
              <ChevronRight size={17} />
            </button>
          )
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
