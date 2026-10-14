// The error shared by everything that can refuse to remove a used item.

export class InUseError extends Error {
  constructor(item, users) {
    super(`"${item}" is used by ${users.join(", ")}.`);
    this.name = "InUseError";
    this.item = item;
    this.users = users;
  }
}
