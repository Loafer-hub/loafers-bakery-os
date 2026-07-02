import { BAKE_PHASES, normalizedBakeProgress } from "./bakeProgress";
import { LOAFERS_BRAND } from "./brand";

// checkout-flow-v1

const STATUS_LABELS = {
  New: "received",
  Deposit: "deposit received",
  Paid: "paid",
  Accepted: "accepted",
  "In progress": "in progress",
  Scheduled: "scheduled",
  Ready: "ready for pickup",
  "Picked up": "picked up",
  Completed: "completed",
  Rejected: "rejected",
  Cancelled: "cancelled",
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

export function customerTrackingUrl(order = {}) {
  const explicit = String(order.customerOrderUrl || "").trim();
  try {
    const url = explicit ? new URL(explicit) : new URL(window.location.href);
    url.search = "";
    url.searchParams.set("order", order.orderSlug || order.slug || "loafers");
    if (order.requestCode) url.searchParams.set("track", order.requestCode);
    return url.toString();
  } catch {
    const slug = encodeURIComponent(order.orderSlug || order.slug || "loafers");
    const code = order.requestCode ? `&track=${encodeURIComponent(order.requestCode)}` : "";
    return `?order=${slug}${code}`;
  }
}

const EVENT_LINES = {
  accepted: "Your order has been accepted.",
  bakeProgress: "Here is the latest update on your bake.",
  comments: "The baker added an update to your order.",
  ready: "Your order is packed and ready for pickup.",
  rejected: "I’m sorry, but I’m unable to accept this order request.",
};

export function buildCustomerStatusMessage(order, progress = order.bakeProgress, eventType = "") {
  const phase = latestPhase(progress);
  const firstName = String(order.customer || "there").trim().split(/\s+/)[0];
  const status = STATUS_LABELS[order.status] || String(order.status || "updated").toLowerCase();
  const lines = [
    `Hi ${firstName}, this is Joshua from ${LOAFERS_BRAND.businessName}.`,
    EVENT_LINES[eventType] || `Your order is ${status}.`,
    eventType === "bakeProgress" && phase ? `Current bake step: ${phase.label} — ${phase.detail}` : "",
    `Order: ${order.itemSummary || `${order.quantity} × ${order.product}`}.`,
    `Pickup: ${pickupLabel(order.pickupAt)} at ${order.pickupLocation || "Three Bears, Delta Junction, AK"}.`,
    order.notes ? `Baker note: ${order.notes}` : "",
    order.requestCode ? `Request code: ${order.requestCode}.` : "",
    order.requestCode ? `Track your bake: ${customerTrackingUrl(order)}` : "",
    "Thank you!",
  ].filter(Boolean);
  return lines.join("\n");
}

export function emailNotificationHref(order, progress, eventType) {
  const subject = encodeURIComponent(`${LOAFERS_BRAND.shortName} order update${order.requestCode ? ` · ${order.requestCode}` : ""}`);
  const body = encodeURIComponent(buildCustomerStatusMessage(order, progress, eventType));
  return `mailto:${encodeURIComponent(order.customerEmail || "")}?subject=${subject}&body=${body}`;
}

export function smsNotificationHref(order, progress, eventType) {
  const body = encodeURIComponent(buildCustomerStatusMessage(order, progress, eventType));
  return `sms:${String(order.customerPhone || "").replace(/[^\d+]/g, "")}?&body=${body}`;
}
