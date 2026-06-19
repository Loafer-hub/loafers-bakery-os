import { ChevronLeft, ChevronRight, LockKeyhole } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { loadPublicOrderCapacity } from "../lib/cloud";
import { MAX_DAILY_LOAVES, pickupDateKey } from "../lib/orderCapacity";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthBounds(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  return {
    from: pickupDateKey(first),
    to: pickupDateKey(last),
  };
}

function shiftDateKey(key, days) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return pickupDateKey(date);
}

export function CustomerPickupCalendar({
  configured,
  loafCount,
  onSelectDate,
  selectedDate,
  slug,
}) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [capacity, setCapacity] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!configured) {
      setCapacity([]);
      return undefined;
    }
    let active = true;
    const { from, to } = monthBounds(month);
    setLoading(true);
    setError("");
    loadPublicOrderCapacity(slug, from, to)
      .then((rows) => {
        if (active) setCapacity(rows);
      })
      .catch((nextError) => {
        if (active) setError(nextError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [configured, month, slug]);

  const capacityByDate = useMemo(() => new Map(capacity.map((day) => [
    day.pickup_date,
    {
      booked: Number(day.loaf_count || 0),
      remaining: Number(day.remaining ?? MAX_DAILY_LOAVES),
      full: day.is_full,
      feedReserved: day.is_feed_reserved,
      unavailable: day.is_unavailable,
      unavailableReason: day.unavailable_reason,
    },
  ])), [capacity]);

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const today = pickupDateKey(new Date());
  const maxDate = shiftDateKey(today, 30);
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });

  function selectDate(key, status) {
    if (status.disabled) return;
    onSelectDate(key, status);
  }

  return (
    <section className="customer-pickup-calendar" aria-label="Choose an available pickup date">
      <div className="customer-calendar-heading">
        <button type="button" onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} aria-label="Previous pickup month"><ChevronLeft size={18} /></button>
        <span><strong>{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</strong><small>{loading ? "Checking capacity…" : "Six-loaf daily limit"}</small></span>
        <button type="button" onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} aria-label="Next pickup month"><ChevronRight size={18} /></button>
      </div>
      <div className="customer-calendar-weekdays" aria-hidden="true">
        {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="customer-calendar-grid">
        {cells.map((day, index) => {
          if (!day) return <span className="customer-calendar-blank" key={`blank-${index}`} />;
          const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const remote = capacityByDate.get(key) || {
            booked: 0,
            remaining: MAX_DAILY_LOAVES,
            full: false,
            feedReserved: false,
            unavailable: false,
            unavailableReason: "",
          };
          const past = key < today;
          const beyondWindow = key > maxDate;
          const cannotFit = loafCount > 0 && loafCount > remote.remaining;
          const status = {
            ...remote,
            disabled: past || beyondWindow || remote.unavailable || remote.full || remote.feedReserved || cannotFit,
          };
          const label = past
            ? "Past"
            : beyondWindow
              ? "30-day limit"
              : remote.unavailable
                ? "Unavailable"
                : remote.full
              ? "Full"
              : remote.feedReserved
                ? "Feed prep"
                : cannotFit
                  ? `${remote.remaining} left`
                  : remote.booked
                    ? `${remote.remaining} left`
                    : "Open";
          return (
            <button
              className={[
                "customer-calendar-day",
                selectedDate === key ? "selected" : "",
                status.disabled ? "disabled" : "",
                remote.full ? "full" : "",
                remote.feedReserved ? "feed-reserved" : "",
                remote.unavailable ? "unavailable" : "",
              ].filter(Boolean).join(" ")}
              disabled={status.disabled}
              key={key}
              onClick={() => selectDate(key, status)}
              type="button"
              aria-label={`${key}: ${label}`}
            >
              <strong>{day}</strong>
              <small>{(remote.full || remote.feedReserved || remote.unavailable || beyondWindow) ? <LockKeyhole size={8} /> : null}{label}</small>
            </button>
          );
        })}
      </div>
      <div className="customer-capacity-legend">
        <span><i className="open" />Open</span>
        <span><i className="full" />Six loaves booked</span>
        <span><i className="feed" />Reserved for starter feed</span>
        <span><i className="unavailable" />Baker unavailable</span>
      </div>
      <p className="customer-calendar-window-note">Orders are available for the next 30 days only.</p>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </section>
  );
}
