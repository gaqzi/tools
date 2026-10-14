// The drinks a user has composed from liquids: unique names, parts by liquid.
// A drink is { name, parts: [{ liquid, amount }] } where `liquid` is a
// liquid's stored name and `amount` is millilitres.

import { InUseError, Referrers } from "./references.js";
import { sameName, trimmedName } from "./names.js";
import { alcoholMl, alcoholPercent, totalAmount } from "./alcohol.js";

export class UnknownDrinkError extends Error {
  constructor(drink) {
    super(`There is no drink named "${drink}".`);
    this.name = "UnknownDrinkError";
    this.drink = drink;
  }
}

export class DuplicateDrinkError extends Error {
  constructor(drink) {
    super(`A drink named "${drink}" already exists.`);
    this.name = "DuplicateDrinkError";
    this.drink = drink;
  }
}

export class InvalidDrinkError extends Error {
  constructor(drink, reason) {
    super(reason);
    this.name = "InvalidDrinkError";
    this.drink = drink;
  }
}

function validName(name) {
  const trimmed = trimmedName(name);
  if (trimmed === "") throw new InvalidDrinkError(name, "A drink needs a name.");
  return trimmed;
}

function validAmount(drink, amount) {
  const ok = typeof amount === "number" && amount > 0 && Number.isFinite(amount);
  if (!ok) throw new InvalidDrinkError(drink, "The amount must be a number of millilitres above 0.");
  return amount;
}

function copy(drink) {
  return { name: drink.name, parts: drink.parts.map((part) => ({ ...part })) };
}

export class Drinks {
  #store;
  #liquids;
  #changed;
  #referrers = new Referrers();

  constructor(store, { liquids, changed }) {
    this.#store = store;
    this.#liquids = liquids;
    this.#changed = changed;
  }

  // A referrer uses drinks by name; see Referrers.
  referredToBy(referrer) {
    this.#referrers.add(referrer);
  }

  all() {
    return this.#store.map(copy);
  }

  get(name) {
    return copy(this.#find(name));
  }

  add({ name, parts = [] }) {
    const trimmed = validName(name);
    this.#refuseTaken(trimmed);
    const drink = { name: trimmed, parts: [] };
    for (const part of parts) drink.parts.push(this.#validPart(drink, part));
    this.#store.push(drink);
    this.#changed();
    return copy(drink);
  }

  rename(name, newName) {
    const drink = this.#find(name);
    const trimmed = validName(newName);
    this.#refuseTaken(trimmed, drink);
    this.#referrers.relabel(drink.name, trimmed);
    drink.name = trimmed;
    this.#changed();
    return copy(drink);
  }

  remove(name) {
    const drink = this.#find(name);
    const users = this.#referrers.usersOf(drink.name);
    if (users.length > 0) throw new InUseError(drink.name, users);
    this.#store.splice(this.#store.indexOf(drink), 1);
    this.#changed();
  }

  addPart(name, part) {
    const drink = this.#find(name);
    drink.parts.push(this.#validPart(drink, part));
    this.#changed();
    return copy(drink);
  }

  removePart(name, liquid) {
    const drink = this.#find(name);
    const index = drink.parts.findIndex((part) => sameName(part.liquid, liquid));
    if (index === -1) throw new InvalidDrinkError(drink.name, `${drink.name} has no ${String(liquid).trim()}.`);
    drink.parts.splice(index, 1);
    this.#changed();
    return copy(drink);
  }

  amountOf(name) {
    return totalAmount(this.#measurable(name));
  }

  alcoholPercentOf(name) {
    return alcoholPercent(this.#measurable(name));
  }

  alcoholOf(name) {
    return alcoholMl(this.#measurable(name));
  }

  // As a referrer of liquids: the drinks using a liquid, in store order.
  usesOf(liquid) {
    return this.#store.filter((drink) => drink.parts.some((part) => sameName(part.liquid, liquid))).map((drink) => drink.name);
  }

  // As a referrer of liquids: follow a rename. The liquids service saves.
  relabel(from, to) {
    for (const drink of this.#store) {
      for (const part of drink.parts) if (sameName(part.liquid, from)) part.liquid = to;
    }
  }

  #validPart(drink, { liquid, amount }) {
    validAmount(drink.name, amount);
    const stored = this.#liquids.get(liquid).name;
    if (drink.parts.some((part) => sameName(part.liquid, stored))) {
      throw new InvalidDrinkError(drink.name, `${drink.name} already has ${stored}.`);
    }
    return { liquid: stored, amount };
  }

  #measurable(name) {
    return this.#find(name).parts.map(({ liquid, amount }) => ({
      amount,
      alcoholPercent: this.#liquids.get(liquid).alcoholPercent,
    }));
  }

  #find(name) {
    const drink = this.#store.find((candidate) => sameName(candidate.name, name));
    if (!drink) throw new UnknownDrinkError(String(name).trim());
    return drink;
  }

  #refuseTaken(name, except = null) {
    const taken = this.#store.find((candidate) => candidate !== except && sameName(candidate.name, name));
    if (taken) throw new DuplicateDrinkError(taken.name);
  }
}
