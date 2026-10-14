// Defines <standard-drinks>: recalls the stores, builds the catalogue, hands it
// to the views, and re-renders every view after any of them changes it.

import "./liquids-view.js";
import "./drinks-view.js";
import { seedStores } from "./seed-stores.js";
import { recallStores, rememberStores } from "./remembered-stores.js";
import { createCatalogue } from "./catalogue.js";

class StandardDrinks extends HTMLElement {
  connectedCallback() {
    const stores = recallStores() ?? seedStores();
    const catalogue = createCatalogue({ stores, remember: rememberStores });
    const liquidsView = this.querySelector("liquids-view");
    const drinksView = this.querySelector("drinks-view");
    liquidsView.liquids = catalogue.liquids;
    drinksView.show(catalogue);
    this.addEventListener("catalogue-changed", () => {
      liquidsView.render();
      drinksView.render();
    });
  }
}

customElements.define("standard-drinks", StandardDrinks);
