import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emptyStores, validateStores, InvalidStoresError } from "./stores.js";

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

function liquid(overrides = {}) {
  return { name: "Gin", alcoholPercent: 40, ...overrides };
}

function part(overrides = {}) {
  return { liquid: "Gin", amount: 45, ...overrides };
}

function drink(overrides = {}) {
  return { name: "Negroni", parts: [part()], ...overrides };
}

function entry(overrides = {}) {
  return { drink: "Negroni", quantity: 2, ...overrides };
}

function drinkList(overrides = {}) {
  return { name: "Friday", entries: [entry()], ...overrides };
}

// A catalogue: a liquid, a drink using it and a list using the drink.
function catalogue(overrides = {}) {
  return { liquids: [liquid()], drinks: [drink()], drinkLists: [drinkList()], ...overrides };
}

// What validating threw, as plain data, so one comparison covers kind and message.
function rejection(value) {
  try {
    validateStores(value);
    return null;
  } catch (error) {
    return { invalid: error instanceof InvalidStoresError, message: error.message };
  }
}

function invalid(message) {
  return { invalid: true, message };
}

describe("validating stores", () => {
  it("gives back a valid stores object itself", () => {
    const valid = catalogue();

    assert.equal(validateStores(valid), valid);
  });

  it("matches references to liquids and drinks trimmed and in any casing", () => {
    const valid = catalogue({
      drinks: [drink({ parts: [part({ liquid: "  gIN " })] })],
      drinkLists: [drinkList({ entries: [entry({ drink: " negroni" })] })],
    });

    assert.equal(validateStores(valid), valid);
  });

  const dangling = [
    {
      name: "a drink uses a liquid that does not exist",
      stores: catalogue({
        drinks: [drink({ name: "Negroni", parts: [part({ liquid: "Campari" })] })],
        drinkLists: [],
      }),
      message: 'Drink "Negroni" uses an unknown liquid "Campari".',
    },
    {
      name: "a drink list uses a drink that does not exist",
      stores: catalogue({
        drinks: [],
        drinkLists: [drinkList({ name: "Friday", entries: [entry({ drink: "Negroni" })] })],
      }),
      message: 'Drink list "Friday" uses an unknown drink "Negroni".',
    },
  ];
  for (const { name, stores, message } of dangling) {
    it(`names the dangling reference when ${name}`, () => {
      assert.deepEqual(rejection(stores), invalid(message));
    });
  }

  const malformed = [
    { name: "is not an object", stores: "gin" },
    { name: "is null", stores: null },
    { name: "has no drink lists array", stores: { liquids: [], drinks: [] } },
    { name: "has a liquid without a number as alcohol percent", stores: catalogue({ liquids: [liquid({ alcoholPercent: "40" })], drinks: [], drinkLists: [] }) },
    { name: "has a drink part without a number as amount", stores: catalogue({ drinks: [drink({ parts: [part({ amount: "45" })] })], drinkLists: [] }) },
    { name: "has a drink list entry without a number as quantity", stores: catalogue({ drinkLists: [drinkList({ entries: [entry({ quantity: "2" })] })] }) },
  ];
  for (const { name, stores } of malformed) {
    it(`rejects as not a catalogue a value that ${name}`, () => {
      assert.deepEqual(rejection(stores), invalid("The file is not a standard-drinks catalogue."));
    });
  }
});
