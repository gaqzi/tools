import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { STORAGE_KEY, recallStores, rememberStores } from "./remembered-stores.js";

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

describe("the key the stores are remembered under", () => {
  it("is standard-drinks", () => {
    assert.equal(STORAGE_KEY, "standard-drinks");
  });
});

describe("recalling stores", () => {
  it("finds nothing when nothing has been stored", () => {
    assert.equal(recallStores(fakeStorage()), null);
  });

  it("finds nothing when the stored value is not valid JSON", () => {
    assert.equal(recallStores(fakeStorage({ "standard-drinks": "{not json" })), null);
  });

  it("gives back the stores that were remembered", () => {
    const storage = fakeStorage();
    rememberStores(stores(), storage);

    assert.deepEqual(recallStores(storage), stores());
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
