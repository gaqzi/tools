// Wires the services to the stores and to remembering them.

import { Liquids } from "./liquids.js";
import { Drinks } from "./drinks.js";

export function createCatalogue({ stores, remember }) {
  const changed = () => remember(stores);
  const liquids = new Liquids(stores.liquids, { changed });
  const drinks = new Drinks(stores.drinks, { liquids, changed });
  liquids.referredToBy(drinks);
  return { liquids, drinks };
}
