// Reads a whole number out of whatever is in a readout: keeps the digits,
// falls back when there are none, and clamps to the readout's bounds.

export function boundedNumber(text, { min, max, fallback }) {
  const digits = String(text).replace(/\D/g, "");
  const value = digits === "" ? fallback : parseInt(digits, 10);
  return Math.max(min, Math.min(max, value));
}
