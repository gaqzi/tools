import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SETTINGS,
  recallStores,
  rememberStores,
  recallSettings,
  rememberSettings,
} from "./remembered-stores.js";

// A storage is anything with getItem/setItem; this one is backed by a Map.
function fakeStorage(entries = {}) {
  const map = new Map(Object.entries(entries));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, value),
  };
}

function stores(overrides = {}) {
  return { liquids: [{ name: "Gin", alcoholPercent: 40 }], drinks: [], drinkLists: [], ...overrides };
}

function settings(overrides = {}) {
  return { gramsPerStandardDrink: 12, ...overrides };
}

describe("remembering the default stores and settings", () => {
  it("recalls the same stores and settings", () => {
    const storage = fakeStorage();
    rememberStores(stores(), storage);
    rememberSettings(settings(), storage);

    assert.deepEqual({ stores: recallStores(storage), settings: recallSettings(storage) }, { stores: stores(), settings: settings() });
  });
});

describe("recalling stores", () => {
  it("finds nothing when nothing has been stored", () => {
    assert.equal(recallStores(fakeStorage()), null);
  });

  it("finds nothing when the stored value is not valid JSON", () => {
    assert.equal(recallStores(fakeStorage({ "standard-drinks": "{not json" })), null);
  });

  it("finds nothing when the stored value is not a valid catalogue", () => {
    assert.equal(recallStores(fakeStorage({ "standard-drinks": '{"liquids":"gin","drinks":[],"drinkLists":[]}' })), null);
  });
});

describe("remembering stores", () => {
  it("writes them as JSON under the key", () => {
    const storage = fakeStorage();
    rememberStores(stores(), storage);

    assert.equal(
      storage.getItem("standard-drinks"),
      '{"liquids":[{"name":"Gin","alcoholPercent":40}],"drinks":[],"drinkLists":[]}',
    );
  });
});

describe("the default settings", () => {
  it("count 12 grams of alcohol to a standard drink", () => {
    assert.deepEqual(DEFAULT_SETTINGS, settings());
  });
});

describe("recalling settings", () => {
  it("gives the defaults when nothing has been stored", () => {
    assert.deepEqual(recallSettings(fakeStorage()), settings());
  });

  it("gives back the settings that were remembered", () => {
    const storage = fakeStorage();
    rememberSettings(settings({ gramsPerStandardDrink: 10 }), storage);

    assert.deepEqual(recallSettings(storage), settings({ gramsPerStandardDrink: 10 }));
  });

  it("accepts a fractional number of grams", () => {
    const storage = fakeStorage({ "standard-drinks-settings": '{"gramsPerStandardDrink":9.5}' });

    assert.deepEqual(recallSettings(storage), settings({ gramsPerStandardDrink: 9.5 }));
  });

  const unusable = [
    { name: "is not valid JSON", stored: "{not json" },
    { name: "has no grams field", stored: "{}" },
    { name: "has zero grams", stored: '{"gramsPerStandardDrink":0}' },
    { name: "has negative grams", stored: '{"gramsPerStandardDrink":-8}' },
    { name: "has grams as a string", stored: '{"gramsPerStandardDrink":"10"}' },
  ];
  for (const { name, stored } of unusable) {
    it(`gives the defaults when the stored value ${name}`, () => {
      const storage = fakeStorage({ "standard-drinks-settings": stored });

      assert.deepEqual(recallSettings(storage), settings());
    });
  }
});

describe("remembering settings", () => {
  it("writes them as JSON under the key", () => {
    const storage = fakeStorage();
    rememberSettings(settings({ gramsPerStandardDrink: 14 }), storage);

    assert.equal(storage.getItem("standard-drinks-settings"), '{"gramsPerStandardDrink":14}');
  });
});
