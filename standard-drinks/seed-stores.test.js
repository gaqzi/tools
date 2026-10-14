import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { seedStores } from "./seed-stores.js";

function stores(overrides = {}) {
  return { liquids: seedLiquids(), drinks: [], drinkLists: [], ...overrides };
}

function seedLiquids() {
  return [
    { name: "Gin", alcoholPercent: 40 },
    { name: "Vodka", alcoholPercent: 40 },
    { name: "Whisky", alcoholPercent: 40 },
    { name: "Campari", alcoholPercent: 23 },
    { name: "Sweet vermouth", alcoholPercent: 15 },
    { name: "Dry vermouth", alcoholPercent: 18 },
    { name: "Lager", alcoholPercent: 5 },
    { name: "Light white wine", alcoholPercent: 11 },
    { name: "White wine", alcoholPercent: 12.5 },
    { name: "Red wine", alcoholPercent: 13.5 },
    { name: "Full-bodied red", alcoholPercent: 14.5 },
    { name: "Sparkling wine", alcoholPercent: 12 },
    { name: "Port", alcoholPercent: 20 },
    { name: "Soda water", alcoholPercent: 0 },
    { name: "Lime juice", alcoholPercent: 0 },
  ];
}

describe("the seed stores a first visit starts from", () => {
  it("hold the common spirits, wines, mixers and no drinks or lists", () => {
    assert.deepEqual(seedStores(), stores());
  });

  it("are a fresh object each time", () => {
    const first = seedStores();
    first.liquids.length = 0;

    assert.deepEqual(seedStores(), stores());
  });
});
