export const MAX_DAILY_LOAVES = 6;

const NON_CAPACITY_STATUSES = new Set(["Cancelled", "Declined", "cancelled", "declined"]);

export function pickupDateKey(value) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function shiftDateKey(value, days) {
  const key = pickupDateKey(value);
  if (!key) return "";
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return pickupDateKey(date);
}

export function dailyLoafTotals(orders, excludeOrderId = null) {
  const totals = new Map();
  orders.forEach((order) => {
    if (order.id === excludeOrderId || order.isSample || NON_CAPACITY_STATUSES.has(order.status)) return;
    const key = pickupDateKey(order.pickupAt);
    if (!key) return;
    totals.set(key, (totals.get(key) || 0) + Math.max(0, Number(order.quantity || 0)));
  });
  return totals;
}

export function orderCapacityForDate(orders, pickupAt, requestedLoaves = 0, excludeOrderId = null) {
  const key = pickupDateKey(pickupAt);
  const totals = dailyLoafTotals(orders, excludeOrderId);
  const booked = key ? totals.get(key) || 0 : 0;
  const nextDayBooked = key ? totals.get(shiftDateKey(key, 1)) || 0 : 0;
  const remaining = Math.max(0, MAX_DAILY_LOAVES - booked);
  const feedReserved = nextDayBooked >= MAX_DAILY_LOAVES;
  const full = booked >= MAX_DAILY_LOAVES;
  return {
    key,
    booked,
    remaining,
    full,
    feedReserved,
    canFit: Boolean(key) && !full && !feedReserved && requestedLoaves <= remaining,
  };
}
