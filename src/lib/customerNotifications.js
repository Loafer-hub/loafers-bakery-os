import { BAKE_PHASES, normalizedBakeProgress } from "./bakeProgress";

const STATUS_LABELS = {
  New: "received",
  Deposit: "deposit received",
  Paid: "paid",
  Accepted: "accepted",
  Scheduled: "scheduled",
  Ready: "ready for pickup",
  Completed: "completed",
};

function pickupLabel(value) {
  if (!value) return "Pickup time is still being arranged";
  return new Date(value).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function latestPhase(progress) {
  const normalized = normalizedBakeProgress(progress);
  return [...BAKE_PHASES].reverse().find((phase) => normalized[phase.id]) || null;
}

export function buildCustomerStatusMessage(order, progress = order.bakeProgress) {
  const phase = latestPhase(progress);
  const firstName = String(order.customer || "there").trim().split(/\s+/)[0];
  const status = STATUS_LABELS[order.status] || String(order.status || "updated").toLowerCase();
  const lines = [
    `Hi ${firstName}, this is Joshua from Loafers.`,
    `Your order is ${status}.`,
    phase ? `Current bake step: ${phase.label} — ${phase.detail}` : "",
    `Order: ${order.itemSummary || `${order.quantity} × ${order.product}`}.`,
    `Pickup: ${pickupLabel(order.pickupAt)} at ${order.pickupLocation || "Three Bears, Delta Junction, AK"}.`,
    order.notes ? `Baker note: ${order.notes}` : "",
    order.requestCode ? `Request code: ${order.requestCode}.` : "",
    "Thank you!",
  ].filter(Boolean);
  return lines.join("\n");
}

export function emailNotificationHref(order, progress) {
  const subject = encodeURIComponent(`Loafers order update${order.requestCode ? ` · ${order.requestCode}` : ""}`);
  const body = encodeURIComponent(buildCustomerStatusMessage(order, progress));
  return `mailto:${encodeURIComponent(order.customerEmail || "")}?subject=${subject}&body=${body}`;
}

export function smsNotificationHref(order, progress) {
  const body = encodeURIComponent(buildCustomerStatusMessage(order, progress));
  return `sms:${String(order.customerPhone || "").replace(/[^\d+]/g, "")}?&body=${body}`;
}
