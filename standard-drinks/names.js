// Names are matched trimmed and in any casing, and stored trimmed.

export function nameKey(name) {
  return String(name).trim().toLowerCase();
}

export function sameName(a, b) {
  return nameKey(a) === nameKey(b);
}

// The name as it is stored, or "" when it is blank or not a string.
export function trimmedName(name) {
  return typeof name === "string" ? name.trim() : "";
}
