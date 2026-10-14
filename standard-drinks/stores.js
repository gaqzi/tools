// The shape of everything the tool remembers: three plain arrays.

export function emptyStores() {
  return { liquids: [], drinks: [], drinkLists: [] };
}

export class InvalidStoresError extends Error {}

const NOT_A_CATALOGUE = "The file is not a standard-drinks catalogue.";

const isObject = (value) => typeof value === "object" && value !== null;
const isNumber = (value) => typeof value === "number" && Number.isFinite(value);
const isArrayOf = (value, check) => Array.isArray(value) && value.every(check);
const sameName = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

const isLiquid = (v) => isObject(v) && typeof v.name === "string" && isNumber(v.alcoholPercent);
const isPart = (v) => isObject(v) && typeof v.liquid === "string" && isNumber(v.amount);
const isDrink = (v) => isObject(v) && typeof v.name === "string" && isArrayOf(v.parts, isPart);
const isEntry = (v) => isObject(v) && typeof v.drink === "string" && isNumber(v.quantity);
const isDrinkList = (v) => isObject(v) && typeof v.name === "string" && isArrayOf(v.entries, isEntry);

// Returns the same value when it is a well-formed catalogue without dangling references.
export function validateStores(value) {
  const wellFormed =
    isObject(value) &&
    isArrayOf(value.liquids, isLiquid) &&
    isArrayOf(value.drinks, isDrink) &&
    isArrayOf(value.drinkLists, isDrinkList);
  if (!wellFormed) throw new InvalidStoresError(NOT_A_CATALOGUE);

  for (const drink of value.drinks) {
    for (const { liquid } of drink.parts) {
      if (!value.liquids.some(({ name }) => sameName(name, liquid))) {
        throw new InvalidStoresError(`Drink "${drink.name}" uses an unknown liquid "${liquid}".`);
      }
    }
  }
  for (const list of value.drinkLists) {
    for (const { drink } of list.entries) {
      if (!value.drinks.some(({ name }) => sameName(name, drink))) {
        throw new InvalidStoresError(`Drink list "${list.name}" uses an unknown drink "${drink}".`);
      }
    }
  }
  return value;
}
