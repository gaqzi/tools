import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createCatalogue } from "./catalogue.js";

function stores(overrides = {}) {
  return { liquids: [{ name: "Gin", alcoholPercent: 40 }], drinks: [], drinkLists: [], ...overrides };
}

// `remember` is a mock that records what it was handed. Persisting on every
// change is an effect with no return value to compare, so the recorded
// arguments are the only way to observe the wiring.
function open(initial = stores()) {
  const remembered = [];
  const catalogue = createCatalogue({ stores: initial, remember: (given) => remembered.push(given) });
  return { catalogue, remembered, initial };
}

describe("a catalogue over the stores", () => {
  it("lists the liquids of the stores without remembering anything", () => {
    const { catalogue, remembered } = open();

    assert.deepEqual(
      { listed: catalogue.liquids.all(), remembered: remembered.length },
      { listed: [{ name: "Gin", alcoholPercent: 40 }], remembered: 0 },
    );
  });

  it("remembers the stores, now holding the liquid, when one is added", () => {
    const { catalogue, remembered } = open();
    catalogue.liquids.add({ name: "Rum", alcoholPercent: 37.5 });

    assert.deepEqual(
      remembered,
      [stores({ liquids: [{ name: "Gin", alcoholPercent: 40 }, { name: "Rum", alcoholPercent: 37.5 }] })],
    );
  });
});
