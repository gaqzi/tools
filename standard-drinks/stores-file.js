// The file format of exporting and importing the stores: indented JSON.

import { InvalidStoresError, validateStores } from "./stores.js";

export function storesFileContents(stores) {
  return `${JSON.stringify(stores, null, 2)}\n`;
}

export function storesFromFileContents(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new InvalidStoresError("The file is not a standard-drinks catalogue.");
  }
  return validateStores(parsed);
}
