// What everything that refers to items by name shares: the error refusing
// to remove a used item, and the referrers an item's owner keeps track of.

export class InUseError extends Error {
  constructor(item, users) {
    super(`"${item}" is used by ${users.join(", ")}.`);
    this.name = "InUseError";
    this.item = item;
    this.users = users;
  }
}

// A referrer uses items by name: `usesOf(name)` lists who uses one and
// `relabel(oldName, newName)` follows a rename.
export class Referrers {
  #referrers = [];

  add(referrer) {
    this.#referrers.push(referrer);
  }

  usersOf(name) {
    return this.#referrers.flatMap((referrer) => referrer.usesOf(name));
  }

  relabel(oldName, newName) {
    for (const referrer of this.#referrers) referrer.relabel(oldName, newName);
  }
}
