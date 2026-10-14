// The only module that touches localStorage, and only via its default argument.

export const STORAGE_KEY = "standard-drinks";

export function recallStores(storage = globalThis.localStorage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function rememberStores(stores, storage = globalThis.localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(stores));
}

export const SETTINGS_KEY = "standard-drinks-settings";

export const DEFAULT_SETTINGS = { gramsPerStandardDrink: 12 };

export function recallSettings(storage = globalThis.localStorage) {
  const raw = storage.getItem(SETTINGS_KEY);
  if (raw === null) return { ...DEFAULT_SETTINGS };
  try {
    const { gramsPerStandardDrink } = JSON.parse(raw);
    if (typeof gramsPerStandardDrink === "number" && Number.isFinite(gramsPerStandardDrink) && gramsPerStandardDrink > 0) {
      return { gramsPerStandardDrink };
    }
  } catch {
    // fall through to the defaults
  }
  return { ...DEFAULT_SETTINGS };
}

export function rememberSettings(settings, storage = globalThis.localStorage) {
  storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
