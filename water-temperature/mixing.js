// Mixing boiling water with room-temperature water to reach a target.
//
// mix() takes a brew ({ totalMl, targetC, roomC, vesselOffsetC }) and
// returns everything the page shows about it: the exact and rounded
// amounts, whether rounding changed them, the bar geometry and, when the
// mix is impossible, which warning applies.

const ROUND_TO_ML = 10;
const LABEL_MIN_PCT = 8;
const LABEL_MAX_PCT = 92;

function roundTo(ml, step) {
  return Math.round(ml / step) * step;
}

function clampLabel(pct) {
  return Math.max(LABEL_MIN_PCT, Math.min(LABEL_MAX_PCT, pct));
}

function warningMix({ totalMl, effectiveTargetC, warning, allBoiling }) {
  const rounded = roundTo(totalMl, ROUND_TO_ML);
  return {
    effectiveTargetC,
    boilingMl: allBoiling ? totalMl : 0,
    coldMl: allBoiling ? 0 : totalMl,
    boilingRoundedMl: allBoiling ? rounded : 0,
    coldRoundedMl: allBoiling ? 0 : rounded,
    boilingDiffers: false,
    coldDiffers: false,
    hotPct: allBoiling ? 100 : 0,
    labelPct: allBoiling ? LABEL_MAX_PCT : LABEL_MIN_PCT,
    warning,
  };
}

export function mix({ totalMl, targetC, roomC, vesselOffsetC = 0 }) {
  const effectiveTargetC = targetC + vesselOffsetC;

  if (effectiveTargetC <= roomC) {
    return warningMix({ totalMl, effectiveTargetC, warning: "below-room", allBoiling: false });
  }
  if (effectiveTargetC > 100) {
    return warningMix({ totalMl, effectiveTargetC, warning: "above-boiling", allBoiling: true });
  }

  const boilingMl = (totalMl * (effectiveTargetC - roomC)) / (100 - roomC);
  const coldMl = totalMl - boilingMl;
  const boilingRoundedMl = roundTo(boilingMl, ROUND_TO_ML);
  const coldRoundedMl = roundTo(coldMl, ROUND_TO_ML);
  const hotPct = (boilingMl / totalMl) * 100;

  return {
    effectiveTargetC,
    boilingMl,
    coldMl,
    boilingRoundedMl,
    coldRoundedMl,
    boilingDiffers: boilingRoundedMl !== Math.round(boilingMl),
    coldDiffers: coldRoundedMl !== Math.round(coldMl),
    hotPct,
    labelPct: clampLabel(hotPct),
    warning: null,
  };
}
