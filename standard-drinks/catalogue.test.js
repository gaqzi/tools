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

describe("a catalogue whose drinks refer to its liquids", () => {
  it("shows a renamed liquid in the drink that uses it, remembering the stores once per change", () => {
    const { catalogue, remembered } = open();
    catalogue.drinks.add({ name: "Gimlet", parts: [{ liquid: "gin", amount: 60 }] });
    catalogue.liquids.rename("Gin", "London dry");

    // `remember` is read for its call count: persisting once per change (the
    // drink added, the liquid renamed, and not again for the relabelled drink)
    // has no output of its own to compare.
    assert.deepEqual(
      { gimlet: catalogue.drinks.get("Gimlet"), remembered: remembered.length },
      { gimlet: { name: "Gimlet", parts: [{ liquid: "London dry", amount: 60 }] }, remembered: 2 },
    );
  });

  it("refuses to remove a liquid a drink uses", () => {
    const { catalogue } = open();
    catalogue.drinks.add({ name: "Gimlet", parts: [{ liquid: "Gin", amount: 60 }] });
    const error = (() => {
      try {
        catalogue.liquids.remove("Gin");
      } catch (caught) {
        return caught;
      }
    })();

    assert.equal(error?.message, '"Gin" is used by Gimlet.');
  });
});
