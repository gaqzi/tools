// Wires the services to the stores and to remembering them.

import { Liquids } from "./liquids.js";

export function createCatalogue({ stores, remember }) {
  const changed = () => remember(stores);
  return { liquids: new Liquids(stores.liquids, { changed }) };
}
