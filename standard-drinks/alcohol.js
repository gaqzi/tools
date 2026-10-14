// The arithmetic of drinks: volumes, strengths, grams and standard drinks.
// A part is { alcoholPercent, amount } with the amount in millilitres.

const GRAMS_PER_ML_OF_ALCOHOL = 0.789;

export function totalAmount(parts) {
  return parts.reduce((sum, { amount }) => sum + amount, 0);
}

export function alcoholMl(parts) {
  return parts.reduce((sum, { amount, alcoholPercent }) => sum + (amount * alcoholPercent) / 100, 0);
}

export function alcoholPercent(parts) {
  const amount = totalAmount(parts);
  return amount === 0 ? 0 : (alcoholMl(parts) / amount) * 100;
}

export function gramsOfAlcohol(ml) {
  return ml * GRAMS_PER_ML_OF_ALCOHOL;
}

export function standardDrinks(grams, { gramsPerStandardDrink }) {
  return grams / gramsPerStandardDrink;
}

// A rough estimate for an average person: one standard drink per hour.
export function hoursToClear(standardDrinkCount) {
  return standardDrinkCount;
}
