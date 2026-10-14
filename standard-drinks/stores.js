// The shape of everything the tool remembers: three plain arrays.

import { sameName, trimmedName } from "./names.js";

export function emptyStores() {
  return { liquids: [], drinks: [], drinkLists: [] };
}

export class InvalidStoresError extends Error {}

const NOT_A_CATALOGUE = "The file is not a standard-drinks catalogue.";

const isObject = (value) => typeof value === "object" && value !== null;
const isNumber = (value) => typeof value === "number" && Number.isFinite(value);
const isArrayOf = (value, check) => Array.isArray(value) && value.every(check);

const isLiquid = (v) => isObject(v) && typeof v.name === "string" && isNumber(v.alcoholPercent);
const isPart = (v) => isObject(v) && typeof v.liquid === "string" && isNumber(v.amount);
const isDrink = (v) => isObject(v) && typeof v.name === "string" && isArrayOf(v.parts, isPart);
const isEntry = (v) => isObject(v) && typeof v.drink === "string" && isNumber(v.quantity);
const isDrinkList = (v) => isObject(v) && typeof v.name === "string" && isArrayOf(v.entries, isEntry);

// Returns the same value when it is a well-formed catalogue that the services
// would have built: unique, non-blank names, values in range, no item used
// twice within another, and no dangling references.
export function validateStores(value) {
  const wellFormed =
    isObject(value) &&
    isArrayOf(value.liquids, isLiquid) &&
    isArrayOf(value.drinks, isDrink) &&
    isArrayOf(value.drinkLists, isDrinkList);
  if (!wellFormed) throw new InvalidStoresError(NOT_A_CATALOGUE);

  refuseBadNames("Liquid", value.liquids);
  refuseBadNames("Drink", value.drinks);
  refuseBadNames("Drink list", value.drinkLists);

  for (const liquid of value.liquids) {
    if (liquid.alcoholPercent < 0 || liquid.alcoholPercent > 100) {
      throw new InvalidStoresError(`Liquid "${liquid.name}" has an alcohol percentage outside 0 to 100.`);
    }
  }
  for (const drink of value.drinks) {
    if (drink.parts.some(({ amount }) => amount <= 0)) {
      throw new InvalidStoresError(`Drink "${drink.name}" has a part with an amount that is not above 0.`);
    }
    const repeated = repeatedName(drink.parts.map(({ liquid }) => liquid));
    if (repeated !== null) throw new InvalidStoresError(`Drink "${drink.name}" uses the liquid "${repeated}" more than once.`);
    for (const { liquid } of drink.parts) {
      if (!value.liquids.some(({ name }) => sameName(name, liquid))) {
        throw new InvalidStoresError(`Drink "${drink.name}" uses an unknown liquid "${liquid}".`);
      }
    }
  }
  for (const list of value.drinkLists) {
    if (list.entries.some(({ quantity }) => !Number.isInteger(quantity) || quantity < 1)) {
      throw new InvalidStoresError(
        `Drink list "${list.name}" has an entry with a quantity that is not a whole number of 1 or more.`,
      );
    }
    const repeated = repeatedName(list.entries.map(({ drink }) => drink));
    if (repeated !== null) throw new InvalidStoresError(`Drink list "${list.name}" uses the drink "${repeated}" more than once.`);
    for (const { drink } of list.entries) {
      if (!value.drinks.some(({ name }) => sameName(name, drink))) {
        throw new InvalidStoresError(`Drink list "${list.name}" uses an unknown drink "${drink}".`);
      }
    }
  }
  return value;
}

function refuseBadNames(kind, items) {
  items.forEach((item, index) => {
    if (trimmedName(item.name) === "") throw new InvalidStoresError(`${kind} "${item.name}" has a blank name.`);
    const earlier = items.slice(0, index).find(({ name }) => sameName(name, item.name));
    if (earlier) throw new InvalidStoresError(`${kind} "${item.name}" duplicates "${earlier.name}".`);
  });
}

// The first name that repeats an earlier one, as written the second time, or null.
function repeatedName(names) {
  return names.find((name, index) => names.slice(0, index).some((earlier) => sameName(earlier, name))) ?? null;
}
