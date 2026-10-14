// The drinks a user has composed from liquids: unique names, parts by liquid.
// A drink is { name, parts: [{ liquid, amount }] } where `liquid` is a
// liquid's stored name and `amount` is millilitres.

import { InUseError } from "./references.js";
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

function key(name) {
  return String(name).trim().toLowerCase();
}

function validName(name) {
  const trimmed = typeof name === "string" ? name.trim() : "";
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
  #referrers = [];

  constructor(store, { liquids, changed }) {
    this.#store = store;
    this.#liquids = liquids;
    this.#changed = changed;
  }

  // A referrer uses drinks by name: `usesOf(name)` lists who uses one and
  // `relabel(oldName, newName)` follows a rename.
  referredToBy(referrer) {
    this.#referrers.push(referrer);
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
    for (const referrer of this.#referrers) referrer.relabel(drink.name, trimmed);
    drink.name = trimmed;
    this.#changed();
    return copy(drink);
  }

  remove(name) {
    const drink = this.#find(name);
    const users = this.#referrers.flatMap((referrer) => referrer.usesOf(drink.name));
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
    const index = drink.parts.findIndex((part) => key(part.liquid) === key(liquid));
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
    return this.#store.filter((drink) => drink.parts.some((part) => key(part.liquid) === key(liquid))).map((drink) => drink.name);
  }

  // As a referrer of liquids: follow a rename. The liquids service saves.
  relabel(from, to) {
    for (const drink of this.#store) {
      for (const part of drink.parts) if (key(part.liquid) === key(from)) part.liquid = to;
    }
  }

  #validPart(drink, { liquid, amount }) {
    validAmount(drink.name, amount);
    const stored = this.#liquids.get(liquid).name;
    if (drink.parts.some((part) => key(part.liquid) === key(stored))) {
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
    const drink = this.#store.find((candidate) => key(candidate.name) === key(name));
    if (!drink) throw new UnknownDrinkError(String(name).trim());
    return drink;
  }

  #refuseTaken(name, except = null) {
    const taken = this.#store.find((candidate) => candidate !== except && key(candidate.name) === key(name));
    if (taken) throw new DuplicateDrinkError(taken.name);
  }
}
