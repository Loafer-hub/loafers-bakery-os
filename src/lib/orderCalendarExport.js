import { buildBakeSchedule } from "./fermentationModel";

function icsDate(value) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcs(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function foldLine(line) {
  const chunks = [];
  let current = "";
  for (const character of line) {
    if (new TextEncoder().encode(current + character).length > 73) {
      chunks.push(current);
      current = ` ${character}`;
    } else {
      current += character;
    }
  }
  chunks.push(current);
  return chunks.join("\r\n");
}

function timestamp(value) {
  return new Date(value).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function recipeForOrder(order, recipes) {
  return recipes.find((recipe) => String(order.product).includes(recipe.name))
    || recipes.find((recipe) => recipe.name === order.product)
    || recipes[0];
}

export function buildOrderSchedule({ order, pickupAt, recipes, starters, starterLogs }) {
  const pickup = new Date(pickupAt || order.pickupAt);
  const recipe = recipeForOrder(order, recipes);
  const starter = starters[0];
  if (Number.isNaN(pickup.getTime()) || !recipe || !starter) return null;

  const bakeEnd = new Date(pickup.getTime() - 2 * 60 * 60 * 1000);
  const model = buildBakeSchedule({
    recipe,
    loaves: order.quantity || 1,
    doughTemperature: 76,
    coldProofHours: 12,
    anchorMode: "finish",
    anchorDateTime: bakeEnd.toISOString(),
    starter,
    ratio: "1:2:2",
    starterLogs,
  });

  return {
    model,
    pickup,
    recipe,
    starter,
  };
}

export function createOrderCalendar({
  order,
  pickupAt,
  recipes,
  starters,
  starterLogs,
}) {
  const schedule = buildOrderSchedule({ order, pickupAt, recipes, starters, starterLogs });
  if (!schedule) throw new Error("Set a pickup date and time before adding this bake to your calendar.");

  const { model, pickup, recipe, starter } = schedule;
  const lines = [
    `Bake plan for ${order.customer}`,
    `${order.quantity} × ${order.product}`,
    "",
    ...model.steps.map((step, index) => {
      const range = step.end
        ? `${timestamp(step.start)} – ${timestamp(step.end)}`
        : timestamp(step.start);
      return `${index + 1}. ${range} — ${step.label}${step.detail ? ` (${step.detail})` : ""}`;
    }),
    `${model.steps.length + 1}. ${timestamp(model.bakeEnd)} – ${timestamp(pickup)} — Cool and pack bread`,
    `${model.steps.length + 2}. ${timestamp(pickup)} — Customer pickup`,
    "",
    `Recipe: ${recipe.name}`,
    `Starter: ${starter.name} at ${starter.hydration}% hydration`,
    "Planning assumptions: 76°F dough, 12-hour cold proof, 1:2:2 starter feed, 2-hour cooling window.",
    `Pickup location: ${order.pickupLocation || "Three Bears, Delta Junction, AK"}`,
    order.paymentMethod ? `Payment: ${order.paymentMethod}` : "",
    order.allergies ? `ALLERGIES: ${order.allergies}` : "Allergies: none reported",
    order.notes ? `Baker notes: ${order.notes}` : "",
  ].filter((line) => line !== "");

  const eventLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Loafers Bakery OS//Bake Plan//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${Date.now()}-${String(order.id).replace(/[^a-zA-Z0-9]/g, "")}@loafers-bakery-os`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(model.steps[0].start)}`,
    `DTEND:${icsDate(pickup)}`,
    `SUMMARY:${escapeIcs(`Bake · ${order.customer} · ${order.product}`)}`,
    `LOCATION:${escapeIcs(order.pickupLocation || "Three Bears, Delta Junction, AK")}`,
    `DESCRIPTION:${escapeIcs(lines.join("\n"))}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:-PT15M",
    `DESCRIPTION:${escapeIcs(`Feed ${starter.name} in 15 minutes`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].map(foldLine);

  return {
    content: `${eventLines.join("\r\n")}\r\n`,
    filename: `loafers-${String(order.customer).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-bake.ics`,
  };
}

export function downloadOrderCalendar(options) {
  const calendar = createOrderCalendar(options);
  const file = new Blob([calendar.content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = calendar.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
