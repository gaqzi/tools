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

  // The one change operation: every rule is checked before anything is
  // written, and one call is one save. A new name is relabelled in referrers.
  update(name, { name: newName, alcoholPercent }) {
    const liquid = this.#find(name);
    const trimmed = newName === undefined ? liquid.name : validName(newName);
    this.#refuseTaken(trimmed, liquid);
    if (alcoholPercent !== undefined) {
      validPercent(liquid.name, alcoholPercent);
      liquid.alcoholPercent = alcoholPercent;
    }
    if (trimmed !== liquid.name) this.#rename(liquid, trimmed);
    this.#changed();
    return { ...liquid };
  }

  #rename(liquid, trimmed) {
    this.#referrers.relabel(liquid.name, trimmed);
    liquid.name = trimmed;
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
