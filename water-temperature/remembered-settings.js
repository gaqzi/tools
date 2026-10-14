// The settings the page remembers between visits: how they are read from
// URL parameters and storage, resolved against each other and the
// defaults, and written back out. This module only resolves and
// (de)serialises; reading location, storage and history is the page's job.

import { VESSELS } from "./vessels.js";

export const DEFAULTS = { ml: 500, temp: 75, room: 15, vessel: 0 };
export const STORAGE_KEY = "tea-water-calc";
export const BOUNDS = {
  ml: [50, 99999],
  temp: [40, 100],
  room: [0, 35],
  vessel: [0, VESSELS.length - 1],
};

const KEYS = Object.keys(DEFAULTS);

function clamp(value, [min, max]) {
  return Math.max(min, Math.min(max, value));
}

// URL wins over storage, storage over the defaults, setting by setting. A
// value that is not a whole number falls through to the default for that
// setting rather than to the next source, so a tampered URL does not
// silently reveal what storage holds.
export function resolveSettings({ url = {}, stored = {}, defaults = DEFAULTS } = {}) {
  const settings = {};
  for (const key of KEYS) {
    const candidate = url[key] !== undefined ? url[key] : stored[key];
    const value = Number.isInteger(candidate) ? candidate : defaults[key];
    settings[key] = clamp(value, BOUNDS[key]);
  }
  return settings;
}

// Number("") is 0, which would let `?temp=` mean 0 °C; an empty value is
// not a number.
function numberFromParam(value) {
  return value === "" ? NaN : Number(value);
}

export function settingsFromParams(params) {
  const settings = {};
  for (const key of KEYS) {
    if (params.has(key)) settings[key] = numberFromParam(params.get(key));
  }
  return settings;
}

export function settingsToParams(settings) {
  const params = new URLSearchParams();
  for (const key of KEYS) params.set(key, String(settings[key]));
  return params;
}
