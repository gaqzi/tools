import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { boundedNumber } from "./bounded-number.js";

// The target readout's bounds; the other readouts differ only in the numbers.
function defaultBounds(overrides = {}) {
  return { min: 40, max: 100, fallback: 75, ...overrides };
}
const roomBounds = (overrides = {}) => defaultBounds({ min: 0, max: 35, fallback: 15, ...overrides });
const volumeBounds = (overrides = {}) => defaultBounds({ min: 50, max: 99999, fallback: 500, ...overrides });

describe("reading a bounded number out of readout text", () => {
  it("reads the default back unchanged", () => {
    assert.equal(boundedNumber("75", defaultBounds()), 75);
  });

  it("reads a plain number within the bounds as is", () => {
    assert.equal(boundedNumber("70", defaultBounds()), 70);
  });

  it("keeps only the digits of the text", () => {
    assert.equal(boundedNumber("abc12", roomBounds()), 12);
  });

  it("ignores a thousands separator", () => {
    assert.equal(boundedNumber("2,000", volumeBounds()), 2000);
  });

  it("falls back when the text is empty", () => {
    assert.equal(boundedNumber("", defaultBounds()), 75);
  });

  it("falls back when the text has no digits", () => {
    assert.equal(boundedNumber("abc", defaultBounds()), 75);
  });

  it("clamps a number below the minimum up to it", () => {
    assert.equal(boundedNumber("7", defaultBounds()), 40);
  });

  it("clamps a number above the maximum down to it", () => {
    assert.equal(boundedNumber("200", defaultBounds()), 100);
  });

  it("clamps zero up to the minimum", () => {
    assert.equal(boundedNumber("0", volumeBounds()), 50);
  });
});
