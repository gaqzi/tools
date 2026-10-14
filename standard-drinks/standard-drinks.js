// Defines <standard-drinks>: recalls the stores, builds the catalogue, hands it to the views.

import "./liquids-view.js";
import { seedStores } from "./seed-stores.js";
import { recallStores, rememberStores } from "./remembered-stores.js";
import { createCatalogue } from "./catalogue.js";

class StandardDrinks extends HTMLElement {
  connectedCallback() {
    const stores = recallStores() ?? seedStores();
    const catalogue = createCatalogue({ stores, remember: rememberStores });
    this.querySelector("liquids-view").liquids = catalogue.liquids;
  }
}

customElements.define("standard-drinks", StandardDrinks);
