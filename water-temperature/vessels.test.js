import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { VESSELS, vesselByIndex } from "./vessels.js";

function defaultVessel(overrides = {}) {
  return { name: "None", offsetC: 0, ...overrides };
}

describe("the vessels a brew can be poured into", () => {
  it("lists the vessels in the order of the page with their offsets", () => {
    assert.deepEqual(VESSELS, [
      defaultVessel(),
      defaultVessel({ name: "Ceramic teapot", offsetC: 8 }),
      defaultVessel({ name: "Ceramic mug", offsetC: 5 }),
      defaultVessel({ name: "Glass teapot", offsetC: 4 }),
      defaultVessel({ name: "Glass mug", offsetC: 3 }),
      defaultVessel({ name: "Thermos", offsetC: 3 }),
      defaultVessel({ name: "Plastic", offsetC: 2 }),
    ]);
  });
});

describe("finding a vessel by its index", () => {
  it("returns the None vessel for index 0", () => {
    assert.deepEqual(vesselByIndex(0), defaultVessel());
  });

  it("tells the glass mug and the thermos apart although they share an offset", () => {
    assert.deepEqual(
      [vesselByIndex(4), vesselByIndex(5)],
      [defaultVessel({ name: "Glass mug", offsetC: 3 }), defaultVessel({ name: "Thermos", offsetC: 3 })],
    );
  });

  it("clamps an index below zero to the first vessel", () => {
    assert.deepEqual(vesselByIndex(-1), defaultVessel());
  });

  it("clamps an index past the end to the last vessel", () => {
    assert.deepEqual(vesselByIndex(99), defaultVessel({ name: "Plastic", offsetC: 2 }));
  });

  it("falls back to the first vessel for NaN", () => {
    assert.deepEqual(vesselByIndex(NaN), defaultVessel());
  });

  it("falls back to the first vessel for a fractional index", () => {
    assert.deepEqual(vesselByIndex(2.5), defaultVessel());
  });
});
