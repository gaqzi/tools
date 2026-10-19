// The drink lists a user has composed from drinks: unique names, entries by drink.
// A drink list is { name, entries: [{ drink, quantity }] } where `drink` is a
// drink's stored name and `quantity` a whole number of servings.

import { sameName, trimmedName } from "./names.js";

export class UnknownDrinkListError extends Error {
  constructor(drinkList) {
    super(`There is no drink list named "${drinkList}".`);
    this.name = "UnknownDrinkListError";
    this.drinkList = drinkList;
  }
}

export class DuplicateDrinkListError extends Error {
  constructor(drinkList) {
    super(`A drink list named "${drinkList}" already exists.`);
    this.name = "DuplicateDrinkListError";
    this.drinkList = drinkList;
  }
}

export class InvalidDrinkListError extends Error {
  constructor(drinkList, reason) {
    super(reason);
    this.name = "InvalidDrinkListError";
    this.drinkList = drinkList;
  }
}

function validName(name) {
  const trimmed = trimmedName(name);
  if (trimmed === "") throw new InvalidDrinkListError(name, "A drink list needs a name.");
  return trimmed;
}

function validQuantity(drinkList, quantity) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new InvalidDrinkListError(drinkList, "The quantity must be a whole number, 1 or more.");
  }
  return quantity;
}

function copy(drinkList) {
  return { name: drinkList.name, entries: drinkList.entries.map((entry) => ({ ...entry })) };
}

export class DrinkLists {
  #store;
  #drinks;
  #changed;

  constructor(store, { drinks, changed }) {
    this.#store = store;
    this.#drinks = drinks;
    this.#changed = changed;
  }

  all() {
    return this.#store.map(copy);
  }

  get(name) {
    return copy(this.#find(name));
  }

  add({ name, entries = [] }) {
    const trimmed = validName(name);
    this.#refuseTaken(trimmed);
    const drinkList = { name: trimmed, entries: [] };
    for (const entry of entries) drinkList.entries.push(this.#validEntry(drinkList, entry));
    this.#store.push(drinkList);
    this.#changed();
    return copy(drinkList);
  }

  // The one change operation: every rule is checked before anything is
  // written, and one call is one save.
  update(name, { name: newName }) {
    const drinkList = this.#find(name);
    const trimmed = newName === undefined ? drinkList.name : validName(newName);
    this.#refuseTaken(trimmed, drinkList);
    if (trimmed !== drinkList.name) this.#rename(drinkList, trimmed);
    this.#changed();
    return copy(drinkList);
  }

  #rename(drinkList, trimmed) {
    drinkList.name = trimmed;
  }

  remove(name) {
    const drinkList = this.#find(name);
    this.#store.splice(this.#store.indexOf(drinkList), 1);
    this.#changed();
  }

  addEntry(name, entry) {
    const drinkList = this.#find(name);
    drinkList.entries.push(this.#validEntry(drinkList, entry));
    this.#changed();
    return copy(drinkList);
  }

  removeEntry(name, drink) {
    const drinkList = this.#find(name);
    const index = drinkList.entries.findIndex((entry) => sameName(entry.drink, drink));
    if (index === -1) {
      throw new InvalidDrinkListError(drinkList.name, `${drinkList.name} has no ${String(drink).trim()}.`);
    }
    drinkList.entries.splice(index, 1);
    this.#changed();
    return copy(drinkList);
  }

  amountOf(name) {
    return this.#find(name).entries.reduce((sum, { drink, quantity }) => sum + quantity * this.#drinks.amountOf(drink), 0);
  }

  alcoholOf(name) {
    return this.#find(name).entries.reduce((sum, { drink, quantity }) => sum + quantity * this.#drinks.alcoholOf(drink), 0);
  }

  alcoholPercentOf(name) {
    const amount = this.amountOf(name);
    return amount === 0 ? 0 : (this.alcoholOf(name) / amount) * 100;
  }

  // As a referrer of drinks: the drink lists using a drink, in store order.
  usesOf(drink) {
    return this.#store.filter((drinkList) => drinkList.entries.some((entry) => sameName(entry.drink, drink))).map((drinkList) => drinkList.name);
  }

  // As a referrer of drinks: follow a rename. The drinks service saves.
  relabel(from, to) {
    for (const drinkList of this.#store) {
      for (const entry of drinkList.entries) if (sameName(entry.drink, from)) entry.drink = to;
    }
  }

  #validEntry(drinkList, { drink, quantity }) {
    validQuantity(drinkList.name, quantity);
    const stored = this.#drinks.get(drink).name;
    if (drinkList.entries.some((entry) => sameName(entry.drink, stored))) {
      throw new InvalidDrinkListError(drinkList.name, `${drinkList.name} already has ${stored}.`);
    }
    return { drink: stored, quantity };
  }

  #find(name) {
    const drinkList = this.#store.find((candidate) => sameName(candidate.name, name));
    if (!drinkList) throw new UnknownDrinkListError(String(name).trim());
    return drinkList;
  }

  #refuseTaken(name, except = null) {
    const taken = this.#store.find((candidate) => candidate !== except && sameName(candidate.name, name));
    if (taken) throw new DuplicateDrinkListError(taken.name);
  }
}
