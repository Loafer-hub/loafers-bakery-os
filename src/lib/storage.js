import { Preferences } from "@capacitor/preferences";

const STORAGE_PREFIX = "loafers.v1.";
export const BACKUP_SCHEMA_VERSION = 1;
export const STORAGE_DATASETS = [
  { id: "orders", label: "Orders" },
  { id: "recipes", label: "Recipes" },
  { id: "inventory", label: "Inventory" },
  { id: "expenses", label: "Expenses" },
  { id: "bakePlans", label: "Bake plans" },
  { id: "starters", label: "Starters" },
  { id: "starterLogs", label: "Starter feed logs" },
];

function readLegacyValue(key) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export async function readStoredValue(key, fallbackValue) {
  try {
    const { value } = await Preferences.get({ key: `${STORAGE_PREFIX}${key}` });

    if (value !== null) {
      return JSON.parse(value);
    }

    const legacyValue = readLegacyValue(key);
    if (legacyValue !== null) {
      await writeStoredValue(key, legacyValue);
      window.localStorage.removeItem(key);
      return legacyValue;
    }
  } catch {
    const legacyValue = readLegacyValue(key);
    if (legacyValue !== null) return legacyValue;
  }

  return fallbackValue;
}

export async function writeStoredValue(key, value) {
  await Preferences.set({
    key: `${STORAGE_PREFIX}${key}`,
    value: JSON.stringify(value),
  });
}

export function createBackup(data) {
  return {
    format: "loafers-bakery-os-backup",
    schemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    data: Object.fromEntries(STORAGE_DATASETS.map(({ id }) => [
      id,
      Array.isArray(data[id]) ? data[id] : [],
    ])),
  };
}

export function parseBackup(text) {
  let backup;
  try {
    backup = JSON.parse(text);
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  if (backup?.format !== "loafers-bakery-os-backup") {
    throw new Error("This is not a Loafers backup file.");
  }
  if (!Number.isInteger(backup.schemaVersion) || backup.schemaVersion < 1) {
    throw new Error("This backup does not have a supported version.");
  }
  if (backup.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new Error("This backup was created by a newer version of Loafers.");
  }
  if (!backup.data || typeof backup.data !== "object") {
    throw new Error("This backup is missing its bakery records.");
  }
  const normalizedData = {};
  STORAGE_DATASETS.forEach(({ id }) => {
    if (!Array.isArray(backup.data[id])) {
      throw new Error(`The ${id} records in this backup are damaged.`);
    }
    normalizedData[id] = backup.data[id];
  });
  return {
    ...backup,
    data: normalizedData,
  };
}

export function backupSizeBytes(backup) {
  return new TextEncoder().encode(JSON.stringify(backup)).length;
}
