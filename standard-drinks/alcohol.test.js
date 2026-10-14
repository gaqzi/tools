import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  totalAmount,
  alcoholMl,
  alcoholPercent,
  gramsOfAlcohol,
  standardDrinks,
  hoursToClear,
} from "./alcohol.js";

// --- The parts of a drink: a liquid's strength and how much of it is poured ---

function campari(overrides = {}) {
  return { alcoholPercent: 23, amount: 45, ...overrides };
}
function gin(overrides = {}) {
  return { alcoholPercent: 40, amount: 45, ...overrides };
}
function sweetVermouth(overrides = {}) {
  return { alcoholPercent: 15, amount: 45, ...overrides };
}
function lager(overrides = {}) {
  return { alcoholPercent: 5, amount: 500, ...overrides };
}
function water(overrides = {}) {
  return { alcoholPercent: 0, amount: 200, ...overrides };
}
function negroniParts() {
  return [campari(), gin(), sweetVermouth()];
}

// --- The measure of a drink: the three figures computed from its parts ---

function measure(overrides = {}) {
  return { amount: 135, alcoholPercent: 26, alcoholMl: 35.1, ...overrides };
}

// Floating point makes 45 * 23 / 100 + ... land a hair off 35.1, so the
// observer rounds to one decimal and expected values stay literals.
function round(number) {
  return Math.round(number * 10) / 10;
}
function measured(parts) {
  return {
    amount: round(totalAmount(parts)),
    alcoholPercent: round(alcoholPercent(parts)),
    alcoholMl: round(alcoholMl(parts)),
  };
}

describe("measuring the parts of a drink", () => {
  it("measures a negroni at 135 ml, 26.0 % and 35.1 ml of alcohol", () => {
    assert.deepEqual(measured(negroniParts()), measure());
  });

  const cases = [
    { name: "a single part", parts: [lager()], want: measure({ amount: 500, alcoholPercent: 5, alcoholMl: 25 }) },
    { name: "a part with no alcohol", parts: [water()], want: measure({ amount: 200, alcoholPercent: 0, alcoholMl: 0 }) },
    { name: "no parts", parts: [], want: measure({ amount: 0, alcoholPercent: 0, alcoholMl: 0 }) },
  ];
  for (const { name, parts, want } of cases) {
    it(`measures ${name}`, () => {
      assert.deepEqual(measured(parts), want);
    });
  }
});

describe("turning millilitres of alcohol into standard drinks", () => {
  it("weighs 35.1 ml of alcohol at 27.7 grams", () => {
    assert.equal(round(gramsOfAlcohol(35.1)), 27.7);
  });

  it("counts 27.7 grams as 2.3 standard drinks when one is 12 grams", () => {
    assert.equal(round(standardDrinks(27.7, { gramsPerStandardDrink: 12 })), 2.3);
  });

  it("counts 27.7 grams as 2.8 standard drinks when one is 10 grams", () => {
    assert.equal(round(standardDrinks(27.7, { gramsPerStandardDrink: 10 })), 2.8);
  });
});

describe("estimating the hours until an average person is clear", () => {
  it("takes one hour per standard drink, so 2.3 standard drinks take 2.3 hours", () => {
    assert.equal(hoursToClear(2.3), 2.3);
  });

  it("takes no time for no standard drinks", () => {
    assert.equal(hoursToClear(0), 0);
  });
});
