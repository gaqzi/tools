import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULTS,
  STORAGE_KEY,
  BOUNDS,
  settingsFromParams,
  settingsToParams,
  resolveSettings,
} from "./remembered-settings.js";

function defaultSettings(overrides = {}) {
  return { ml: 500, temp: 75, room: 15, vessel: 0, ...overrides };
}

describe("the constants the page remembers settings with", () => {
  it("defaults to half a litre of oolong at a temperate room in no vessel", () => {
    assert.deepEqual(DEFAULTS, defaultSettings());
  });

  it("stores under the key the shipped page used", () => {
    assert.equal(STORAGE_KEY, "tea-water-calc");
  });

  it("bounds each setting to what the readouts accept", () => {
    assert.deepEqual(BOUNDS, { ml: [50, 99999], temp: [40, 100], room: [0, 35], vessel: [0, 6] });
  });
});

describe("resolving settings from the URL, storage and defaults", () => {
  it("uses the defaults when neither the URL nor storage has anything", () => {
    assert.deepEqual(resolveSettings({}), defaultSettings());
  });

  it("uses the defaults when called with nothing at all", () => {
    assert.deepEqual(resolveSettings(), defaultSettings());
  });

  it("lets the URL win over storage", () => {
    assert.deepEqual(
      resolveSettings({ url: { temp: 70 }, stored: { temp: 80 } }),
      defaultSettings({ temp: 70 }),
    );
  });

  it("lets storage win over the defaults", () => {
    assert.deepEqual(resolveSettings({ stored: { ml: 1000 } }), defaultSettings({ ml: 1000 }));
  });

  it("resolves each setting on its own", () => {
    assert.deepEqual(
      resolveSettings({ url: { ml: 300 }, stored: { temp: 92, vessel: 1 } }),
      defaultSettings({ ml: 300, temp: 92, vessel: 1 }),
    );
  });

  it("falls back to the default, not to storage, for a NaN URL value", () => {
    assert.deepEqual(
      resolveSettings({ url: { temp: NaN }, stored: { temp: 80 } }),
      defaultSettings(),
    );
  });

  it("falls back to the default for a fractional value", () => {
    assert.deepEqual(resolveSettings({ url: { temp: 70.5 } }), defaultSettings());
  });

  it("falls back to the default for an empty URL value", () => {
    assert.deepEqual(
      resolveSettings({
        url: settingsFromParams(new URLSearchParams("temp=&ml=")),
        stored: defaultSettings({ temp: 80 }),
      }),
      defaultSettings(),
    );
  });

  it("falls back to the default for a stored value that is a string", () => {
    assert.deepEqual(resolveSettings({ stored: { temp: "80" } }), defaultSettings());
  });

  it("falls back to the given defaults rather than the built-in ones", () => {
    assert.deepEqual(
      resolveSettings({ url: { temp: NaN }, defaults: defaultSettings({ temp: 80 }) }),
      defaultSettings({ temp: 80 }),
    );
  });

  it("clamps a volume below 50 up to 50", () => {
    assert.deepEqual(resolveSettings({ url: { ml: 5 } }), defaultSettings({ ml: 50 }));
  });

  it("clamps a target above 100 down to 100", () => {
    assert.deepEqual(resolveSettings({ url: { temp: 200 } }), defaultSettings({ temp: 100 }));
  });

  it("clamps a room temperature above 35 down to 35", () => {
    assert.deepEqual(resolveSettings({ url: { room: 99 } }), defaultSettings({ room: 35 }));
  });

  it("clamps a vessel index past the end to the last vessel", () => {
    assert.deepEqual(resolveSettings({ url: { vessel: 99 } }), defaultSettings({ vessel: 6 }));
  });

  it("clamps a negative vessel index to the first vessel", () => {
    assert.deepEqual(resolveSettings({ url: { vessel: -1 } }), defaultSettings({ vessel: 0 }));
  });

  it("keeps a volume beyond the slider but within the readout bound", () => {
    assert.deepEqual(resolveSettings({ stored: { ml: 2000 } }), defaultSettings({ ml: 2000 }));
  });
});

describe("reading settings from URL parameters", () => {
  it("parses all four settings", () => {
    assert.deepEqual(
      settingsFromParams(new URLSearchParams("ml=750&temp=70&room=4&vessel=2")),
      defaultSettings({ ml: 750, temp: 70, room: 4, vessel: 2 }),
    );
  });

  it("omits the settings that are absent", () => {
    assert.deepEqual(settingsFromParams(new URLSearchParams("temp=70")), { temp: 70 });
  });

  it("ignores parameters that are not settings", () => {
    assert.deepEqual(settingsFromParams(new URLSearchParams("foo=1")), {});
  });

  it("yields NaN for a value that is not a number", () => {
    assert.deepEqual(settingsFromParams(new URLSearchParams("temp=abc")), { temp: NaN });
  });

  it("yields NaN for an empty value", () => {
    assert.deepEqual(settingsFromParams(new URLSearchParams("temp=")), { temp: NaN });
  });
});

describe("writing settings to URL parameters", () => {
  it("writes ml, temp, room and vessel in that order", () => {
    assert.equal(String(settingsToParams(defaultSettings())), "ml=500&temp=75&room=15&vessel=0");
  });

  it("round-trips through the parameters", () => {
    assert.deepEqual(
      settingsFromParams(settingsToParams(defaultSettings({ ml: 2000, vessel: 5 }))),
      defaultSettings({ ml: 2000, vessel: 5 }),
    );
  });
});
