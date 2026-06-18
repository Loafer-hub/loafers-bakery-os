import { Preferences } from "@capacitor/preferences";

const STORAGE_PREFIX = "loafers.v1.";

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
