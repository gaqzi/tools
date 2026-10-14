// The liquids a user can mix drinks from: unique names, alcohol percentages.

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

function key(name) {
  return String(name).trim().toLowerCase();
}

function validName(name) {
  const trimmed = typeof name === "string" ? name.trim() : "";
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

  constructor(store, { changed }) {
    this.#store = store;
    this.#changed = changed;
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
    liquid.name = trimmed;
    this.#changed();
    return { ...liquid };
  }

  remove(name) {
    const liquid = this.#find(name);
    this.#store.splice(this.#store.indexOf(liquid), 1);
    this.#changed();
  }

  #find(name) {
    const liquid = this.#store.find((candidate) => key(candidate.name) === key(name));
    if (!liquid) throw new UnknownLiquidError(String(name).trim());
    return liquid;
  }

  #refuseTaken(name, except = null) {
    const taken = this.#store.find((candidate) => candidate !== except && key(candidate.name) === key(name));
    if (taken) throw new DuplicateLiquidError(taken.name);
  }
}
