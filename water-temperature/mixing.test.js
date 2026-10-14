import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mix } from "./mixing.js";

// --- The brew (inputs) and the mix (result) ---

function defaultBrew(overrides = {}) {
  return { totalMl: 500, targetC: 75, roomC: 15, vesselOffsetC: 0, ...overrides };
}

// 500 * (75 - 15) / (100 - 15) = 352.94
function defaultMix(overrides = {}) {
  return {
    effectiveTargetC: 75,
    boilingMl: 352.94,
    coldMl: 147.06,
    boilingRoundedMl: 350,
    coldRoundedMl: 150,
    boilingDiffers: true,
    coldDiffers: true,
    hotPct: 70.59,
    labelPct: 70.59,
    warning: null,
    ...overrides,
  };
}

// Reads the mix for a brew with its unrounded fields rounded to two
// decimals so the expected literals above compare with plain equality.
function readMix(brew) {
  const { boilingMl, coldMl, hotPct, labelPct, ...rest } = mix(brew);
  const to2 = (n) => (typeof n === "number" ? Math.round(n * 100) / 100 : n);
  return { ...rest, boilingMl: to2(boilingMl), coldMl: to2(coldMl), hotPct: to2(hotPct), labelPct: to2(labelPct) };
}

// --- Scenarios several tests share ---

const allBoiling = (overrides = {}) =>
  defaultMix({
    boilingMl: 500,
    coldMl: 0,
    boilingRoundedMl: 500,
    coldRoundedMl: 0,
    boilingDiffers: false,
    coldDiffers: false,
    hotPct: 100,
    labelPct: 92,
    ...overrides,
  });

const allCold = (overrides = {}) =>
  defaultMix({
    boilingMl: 0,
    coldMl: 500,
    boilingRoundedMl: 0,
    coldRoundedMl: 500,
    boilingDiffers: false,
    coldDiffers: false,
    hotPct: 0,
    labelPct: 8,
    warning: "below-room",
    ...overrides,
  });

describe("mixing boiling water with room-temperature water", () => {
  it("mixes the default brew to the default mix", () => {
    assert.deepEqual(readMix(defaultBrew()), defaultMix());
  });

  it("rounds to the nearest 10 mL and says when the exact amounts differ", () => {
    // 500 * (70 - 15) / (100 - 15) = 323.53
    assert.deepEqual(
      readMix(defaultBrew({ targetC: 70 })),
      defaultMix({ effectiveTargetC: 70, boilingMl: 323.53, coldMl: 176.47, boilingRoundedMl: 320, coldRoundedMl: 180, hotPct: 64.71, labelPct: 64.71 }),
    );
  });

  it("says the exact amounts do not differ when rounding changes nothing", () => {
    // 850 * (75 - 15) / (100 - 15) = 600 exactly.
    assert.deepEqual(
      readMix(defaultBrew({ totalMl: 850 })),
      defaultMix({ boilingMl: 600, coldMl: 250, boilingRoundedMl: 600, coldRoundedMl: 250, boilingDiffers: false, coldDiffers: false }),
    );
  });

  it("treats 0 °C cold water as 0 °C", () => {
    // 1000 * (75 - 0) / (100 - 0) = 750 exactly.
    assert.deepEqual(
      readMix(defaultBrew({ totalMl: 1000, roomC: 0 })),
      defaultMix({ boilingMl: 750, coldMl: 250, boilingRoundedMl: 750, coldRoundedMl: 250, boilingDiffers: false, coldDiffers: false, hotPct: 75, labelPct: 75 }),
    );
  });

  it("puts the label at the hot percentage when it is between 8 and 92", () => {
    // 500 * (40 - 15) / (100 - 15) = 147.06
    assert.deepEqual(
      readMix(defaultBrew({ targetC: 40 })),
      defaultMix({ effectiveTargetC: 40, boilingMl: 147.06, coldMl: 352.94, boilingRoundedMl: 150, coldRoundedMl: 350, hotPct: 29.41, labelPct: 29.41 }),
    );
  });

  it("keeps the label at 8% when the mix is almost all cold water", () => {
    // 500 * (40 - 35) / (100 - 35) = 38.46, 7.69% of the total.
    assert.deepEqual(
      readMix(defaultBrew({ targetC: 40, roomC: 35 })),
      defaultMix({ effectiveTargetC: 40, boilingMl: 38.46, coldMl: 461.54, boilingRoundedMl: 40, coldRoundedMl: 460, hotPct: 7.69, labelPct: 8 }),
    );
  });

  it("uses only boiling water at 100 °C without warning and caps the label at 92%", () => {
    assert.deepEqual(readMix(defaultBrew({ targetC: 100 })), allBoiling({ effectiveTargetC: 100 }));
  });
});

describe("compensating for the vessel", () => {
  it("adds the vessel offset to the target before mixing", () => {
    // 500 * (78 - 15) / (100 - 15) = 370.59
    assert.deepEqual(
      readMix(defaultBrew({ targetC: 70, vesselOffsetC: 8 })),
      defaultMix({ effectiveTargetC: 78, boilingMl: 370.59, coldMl: 129.41, boilingRoundedMl: 370, coldRoundedMl: 130, hotPct: 74.12, labelPct: 74.12 }),
    );
  });
});

describe("warning about impossible mixes", () => {
  it("warns and uses only boiling water when the offset takes 93 °C just past boiling", () => {
    assert.deepEqual(
      readMix(defaultBrew({ targetC: 93, vesselOffsetC: 8 })),
      allBoiling({ effectiveTargetC: 101, warning: "above-boiling" }),
    );
  });

  it("warns and uses only boiling water when the offset takes 95 °C past boiling", () => {
    assert.deepEqual(
      readMix(defaultBrew({ targetC: 95, vesselOffsetC: 8 })),
      allBoiling({ effectiveTargetC: 103, warning: "above-boiling" }),
    );
  });

  it("needs no boiling water when the target equals room temperature", () => {
    assert.deepEqual(readMix(defaultBrew({ targetC: 15 })), allCold({ effectiveTargetC: 15 }));
  });

  it("needs no boiling water when the target is below room temperature", () => {
    assert.deepEqual(readMix(defaultBrew({ targetC: 10 })), allCold({ effectiveTargetC: 10 }));
  });

  it("needs no boiling water when the offset only lifts the target up to room temperature", () => {
    assert.deepEqual(
      readMix(defaultBrew({ targetC: 30, roomC: 35, vesselOffsetC: 5 })),
      allCold({ effectiveTargetC: 35 }),
    );
  });

  it("rounds the whole total to the nearest 10 mL of cold water below room temperature", () => {
    assert.deepEqual(
      readMix(defaultBrew({ totalMl: 555, targetC: 15 })),
      allCold({ effectiveTargetC: 15, coldMl: 555, coldRoundedMl: 560 }),
    );
  });
});
