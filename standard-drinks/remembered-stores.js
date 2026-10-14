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
