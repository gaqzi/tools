import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { storesFileContents, storesFromFileContents } from "./stores-file.js";
import { InvalidStoresError } from "./stores.js";

function liquid(overrides = {}) {
  return { name: "Gin", alcoholPercent: 40, ...overrides };
}

function drink(overrides = {}) {
  return { name: "Negroni", parts: [{ liquid: "Gin", amount: 45 }], ...overrides };
}

function stores(overrides = {}) {
  return { liquids: [liquid()], drinks: [drink()], drinkLists: [], ...overrides };
}

// What reading a file threw, as plain data, so one comparison covers kind and message.
function rejection(text) {
  try {
    storesFromFileContents(text);
    return null;
  } catch (error) {
    return { invalid: error instanceof InvalidStoresError, message: error.message };
  }
}

describe("writing stores to a file", () => {
  it("makes indented JSON with a trailing newline", () => {
    const written = storesFileContents(stores({ drinks: [], liquids: [liquid()] }));

    assert.equal(
      written,
      '{\n  "liquids": [\n    {\n      "name": "Gin",\n      "alcoholPercent": 40\n    }\n  ],\n  "drinks": [],\n  "drinkLists": []\n}\n',
    );
  });
});

describe("reading stores from a file", () => {
  it("gives back the stores that were written", () => {
    assert.deepEqual(storesFromFileContents(storesFileContents(stores())), stores());
  });

  it("rejects text that is not JSON as not a catalogue", () => {
    assert.deepEqual(rejection("{not json"), {
      invalid: true,
      message: "The file is not a standard-drinks catalogue.",
    });
  });

  it("rejects JSON of the wrong shape as not a catalogue", () => {
    assert.deepEqual(rejection('{"liquids":[]}'), {
      invalid: true,
      message: "The file is not a standard-drinks catalogue.",
    });
  });

  it("passes a dangling reference message on unchanged", () => {
    const text = storesFileContents(stores({ liquids: [liquid({ name: "Vodka" })] }));

    assert.deepEqual(rejection(text), {
      invalid: true,
      message: 'Drink "Negroni" uses an unknown liquid "Gin".',
    });
  });
});
