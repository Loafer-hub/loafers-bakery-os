import { normalizedBakerySettings } from "./bakerySettings";

function dateFromKey(dateKey) {
  if (!dateKey) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  return Number.isNaN(date.getTime()) ? null : date;
}

function minutesFromTime(value) {
  const [hour, minute] = String(value || "00:00").split(":").map(Number);
  return hour * 60 + minute;
}

function windowsForDate(dateKey, settings) {
  const date = dateFromKey(dateKey);
  const normalized = normalizedBakerySettings(settings);
  const source = date && [0, 6].includes(date.getDay())
    ? normalized.weekendWindows
    : normalized.weekdayWindows;
  return source.map((window) => ({
    start: minutesFromTime(window.start),
    end: minutesFromTime(window.end),
  }));
}

function timeValue(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function timeLabel(minutes) {
  return new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60)
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function pickupTimeOptions(dateKey, settings) {
  const interval = normalizedBakerySettings(settings).pickupIntervalMinutes;
  return windowsForDate(dateKey, settings).flatMap((window) => {
    const options = [];
    for (let minutes = window.start; minutes <= window.end; minutes += interval) {
      options.push({ value: timeValue(minutes), label: timeLabel(minutes) });
    }
    return options;
  });
}

export function pickupHoursLabel(dateKey, settings) {
  return windowsForDate(dateKey, settings)
    .map((window) => `${timeLabel(window.start)}–${timeLabel(window.end)}`)
    .join(" and ");
}

export function isPickupTimeAllowed(dateKey, time, settings) {
  if (!dateKey || !time) return false;
  const [hour, minute] = time.split(":").map(Number);
  const value = hour * 60 + minute;
  return windowsForDate(dateKey, settings).some((window) => value >= window.start && value <= window.end);
}

export function pickupDateTimeIso(dateKey, time) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const intendedWallTime = Date.UTC(year, month - 1, day, hour, minute);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Anchorage",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  let utcValue = intendedWallTime;
  for (let index = 0; index < 2; index += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(utcValue))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]));
    const renderedWallTime = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    utcValue += intendedWallTime - renderedWallTime;
  }
  return new Date(utcValue).toISOString();
}

export function shelfAgeLabel(bakedOn) {
  const baked = dateFromKey(bakedOn);
  if (!baked) return "Bake date not set";
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const days = Math.max(0, Math.floor((today - baked) / 86400000));
  if (days === 0) return "Baked today";
  if (days === 1) return "1 day old";
  return `${days} days old`;
}
