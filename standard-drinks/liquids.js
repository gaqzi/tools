// The liquids a user can mix drinks from: unique names, alcohol percentages.

import { InUseError, Referrers } from "./references.js";
import { sameName, trimmedName } from "./names.js";

export class DuplicateLiquidError extends Error {
  constructor(liquid) {
    super(`A liquid named "${liquid}" already exists.`);
    this.name = "DuplicateLiquidError";
    this.liquid = liquid;
  }
}

export class InvalidLiquidError extends Error {
  constructor(liquid, reason) {
    super(reason);
    this.name = "InvalidLiquidError";
    this.liquid = liquid;
  }
}

export class UnknownLiquidError extends Error {
  constructor(liquid) {
    super(`There is no liquid named "${liquid}".`);
    this.name = "UnknownLiquidError";
    this.liquid = liquid;
  }
}

function validName(name) {
  const trimmed = trimmedName(name);
  if (trimmed === "") throw new InvalidLiquidError(name, "A liquid needs a name.");
  return trimmed;
}

function validPercent(name, alcoholPercent) {
  const ok = typeof alcoholPercent === "number" && alcoholPercent >= 0 && alcoholPercent <= 100;
  if (!ok) throw new InvalidLiquidError(name, "The alcohol percentage must be a number from 0 to 100.");
  return alcoholPercent;
}

export class Liquids {
  #store;
  #changed;
  #referrers = new Referrers();

  constructor(store, { changed }) {
    this.#store = store;
    this.#changed = changed;
  }

  // A referrer uses liquids by name; see Referrers.
  referredToBy(referrer) {
    this.#referrers.add(referrer);
  }

  all() {
    return this.#store.map((liquid) => ({ ...liquid }));
  }

  get(name) {
    return { ...this.#find(name) };
  }

  add({ name, alcoholPercent }) {
    const trimmed = validName(name);
    validPercent(trimmed, alcoholPercent);
    this.#refuseTaken(trimmed);
    const liquid = { name: trimmed, alcoholPercent };
    this.#store.push(liquid);
    this.#changed();
    return { ...liquid };
  }

  update(name, { alcoholPercent }) {
    const liquid = this.#find(name);
    liquid.alcoholPercent = validPercent(liquid.name, alcoholPercent);
    this.#changed();
    return { ...liquid };
  }

  rename(name, newName) {
    const liquid = this.#find(name);
    const trimmed = validName(newName);
    this.#refuseTaken(trimmed, liquid);
    this.#referrers.relabel(liquid.name, trimmed);
    liquid.name = trimmed;
    this.#changed();
    return { ...liquid };
  }

  remove(name) {
    const liquid = this.#find(name);
    const users = this.#referrers.usersOf(liquid.name);
    if (users.length > 0) throw new InUseError(liquid.name, users);
    this.#store.splice(this.#store.indexOf(liquid), 1);
    this.#changed();
  }

  #find(name) {
    const liquid = this.#store.find((candidate) => sameName(candidate.name, name));
    if (!liquid) throw new UnknownLiquidError(String(name).trim());
    return liquid;
  }

  #refuseTaken(name, except = null) {
    const taken = this.#store.find((candidate) => candidate !== except && sameName(candidate.name, name));
    if (taken) throw new DuplicateLiquidError(taken.name);
  }
}
