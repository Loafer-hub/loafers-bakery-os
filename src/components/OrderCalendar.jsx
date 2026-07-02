import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { buildBakeSchedule } from "../lib/fermentationModel";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const eventTypes = {
  placed: { label: "Ordered", shortLabel: "Order", className: "placed" },
  feed: { label: "Feed", className: "feed" },
  start: { label: "Start bread", shortLabel: "Start", className: "start" },
  pickup: { label: "Pickup", className: "pickup" },
};

function dateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function atLocalTime(date, hour = 17) {
  const next = new Date(date);
  next.setHours(hour, 0, 0, 0);
  return next;
}

function nextWeekday(weekday) {
  const date = new Date();
  const offset = (weekday - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + offset);
  return atLocalTime(date);
}

export function orderPickupDate(order) {
  if (order.pickupAt) {
    const exact = new Date(order.pickupAt);
    if (!Number.isNaN(exact.getTime())) return exact;
  }

  const due = String(order.due || "").trim();
  const parsed = new Date(due);
  if (due && !Number.isNaN(parsed.getTime()) && /\d/.test(due)) return parsed;

  if (due === "Today") return atLocalTime(new Date());
  if (due === "Tomorrow") {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return atLocalTime(tomorrow);
  }

  const weekdays = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };
  if (due in weekdays) return nextWeekday(weekdays[due]);
  return null;
}

function orderPlacedDate(order, index) {
  if (order.createdAt) {
    const exact = new Date(order.createdAt);
    if (!Number.isNaN(exact.getTime())) return exact;
  }
  const fallback = new Date();
  fallback.setDate(fallback.getDate() - Math.min(index, 4));
  fallback.setHours(10, 0, 0, 0);
  return fallback;
}

function orderEvents(orders, recipes, starters, starterLogs) {
  const starter = starters[0];
  return orders.flatMap((order, index) => {
    const placed = orderPlacedDate(order, index);
    const pickup = orderPickupDate(order);
    const base = [{
      id: `${order.id}-placed`,
      orderId: order.id,
      type: "placed",
      date: placed,
      customer: order.customer,
      time: placed,
    }];

    if (!pickup) return base;

    const recipe = recipes.find((item) => String(order.product).includes(item.name))
      || recipes.find((item) => item.name === order.product)
      || recipes[0];
    if (!recipe || !starter) {
      return [...base, {
        id: `${order.id}-pickup`,
        orderId: order.id,
        type: "pickup",
        date: pickup,
        customer: order.customer,
        time: pickup,
      }];
    }

    const cooledBakeEnd = new Date(pickup.getTime() - 2 * 60 * 60 * 1000);
    const model = buildBakeSchedule({
      recipe,
      loaves: order.quantity || 1,
      doughTemperature: 76,
      coldProofHours: 12,
      anchorMode: "finish",
      anchorDateTime: cooledBakeEnd.toISOString(),
      starter,
      ratio: "1:2:2",
      starterLogs,
    });
    const feed = model.steps.find((step) => step.id === "feed")?.start;
    const start = model.steps.find((step) => step.id === "mix")?.start;

    return [
      ...base,
      feed ? {
        id: `${order.id}-feed`,
        orderId: order.id,
        type: "feed",
        date: feed,
        customer: order.customer,
        time: feed,
      } : null,
      start ? {
        id: `${order.id}-start`,
        orderId: order.id,
        type: "start",
        date: start,
        customer: order.customer,
        time: start,
      } : null,
      {
        id: `${order.id}-pickup`,
        orderId: order.id,
        type: "pickup",
        date: pickup,
        customer: order.customer,
        time: pickup,
      },
    ].filter(Boolean);
  });
}

export function OrderCalendar({
  orders,
  recipes,
  starters,
  starterLogs,
}) {
  const [month, setMonth] = useState(() => new Date());
  const events = useMemo(
    () => orderEvents(orders, recipes, starters, starterLogs),
    [orders, recipes, starters, starterLogs],
  );
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });
  const eventsByDate = new Map();

  events.forEach((event) => {
    const key = dateKey(event.date);
    const current = eventsByDate.get(key) || [];
    current.push(event);
    eventsByDate.set(key, current);
  });

  function changeMonth(change) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + change, 1));
  }

  return (
    <section className="order-calendar" aria-label="Order production calendar">
      <div className="calendar-heading">
        <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month"><ChevronLeft size={18} /></button>
        <h2>{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2>
        <button type="button" onClick={() => changeMonth(1)} aria-label="Next month"><ChevronRight size={18} /></button>
      </div>

      <div className="order-calendar-legend" aria-label="Calendar color legend">
        {Object.entries(eventTypes).map(([type, config]) => (
          <span className={`order-event-${config.className}`} key={type}><i />{config.label}</span>
        ))}
      </div>

      <div className="calendar-weekdays" aria-hidden="true">
        {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="order-calendar-grid">
        {cells.map((day, index) => {
          if (!day) return <span className="calendar-blank" key={`blank-${index}`} />;
          const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayEvents = (eventsByDate.get(key) || [])
            .sort((a, b) => a.time - b.time);
          return (
            <div className={dayEvents.length ? "order-calendar-day has-events" : "order-calendar-day"} key={key}>
              <span>{day}</span>
              <div className="order-calendar-events" role="list" tabIndex={dayEvents.length > 1 ? 0 : undefined} aria-label={`${dayEvents.length} production events on ${key}`}>
                {dayEvents.map((event) => {
                  const config = eventTypes[event.type];
                  return (
                    <div
                      className={`order-calendar-event order-event-${config.className}`}
                      key={event.id}
                      role="listitem"
                      title={`${config.label}: ${event.customer}`}
                    >
                      <strong>{config.shortLabel || config.label}</strong>
                      <small>{event.customer.split(" ")[0]}</small>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <p className="order-calendar-note">Scroll inside a busy day to see every order. Calendar entries are read-only; open an order from List view to edit it. Feed and start times work backward from pickup.</p>
    </section>
  );
}
