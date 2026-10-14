import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emptyStores } from "./stores.js";

function stores(overrides = {}) {
  return { liquids: [], drinks: [], drinkLists: [], ...overrides };
}

describe("the empty stores", () => {
  it("hold no liquids, drinks or drink lists", () => {
    assert.deepEqual(emptyStores(), stores());
  });

  it("are a fresh object each time", () => {
    const first = emptyStores();
    first.liquids.push({ name: "Gin", alcoholPercent: 40 });

    assert.deepEqual(emptyStores(), stores());
  });
});
