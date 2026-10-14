// Defines <standard-drinks>: recalls the stores and settings, builds the catalogue, hands it
// to the views, and re-renders every view after any of them changes it.

import "./liquids-view.js";
import "./drinks-view.js";
import "./drink-lists-view.js";
import "./catalogue-settings.js";
import "./catalogue-file.js";
import { seedStores } from "./seed-stores.js";
import { recallStores, rememberStores, recallSettings, rememberSettings } from "./remembered-stores.js";
import { createCatalogue } from "./catalogue.js";

class StandardDrinks extends HTMLElement {
  #settings = null;

  connectedCallback() {
    this.#settings = recallSettings();
    this.#start(recallStores() ?? seedStores());
    this.addEventListener("catalogue-changed", () => this.#render());
    this.addEventListener("settings-changed", ({ detail }) => {
      this.#settings.gramsPerStandardDrink = detail.gramsPerStandardDrink;
      rememberSettings(this.#settings);
      this.#render();
    });
    this.addEventListener("catalogue-replaced", ({ detail: stores }) => {
      rememberStores(stores);
      this.#start(stores);
    });
  }

  #start(stores) {
    const catalogue = createCatalogue({ stores, remember: rememberStores });
    const settings = this.#settings;
    this.querySelector("catalogue-settings").show({ settings });
    this.querySelector("liquids-view").liquids = catalogue.liquids;
    this.querySelector("drinks-view").show({ ...catalogue, settings });
    this.querySelector("drink-lists-view").show({ ...catalogue, settings });
    this.querySelector("catalogue-file").show({ stores });
  }

  #render() {
    for (const view of this.querySelectorAll("liquids-view, drinks-view, drink-lists-view")) view.render();
  }
}

customElements.define("standard-drinks", StandardDrinks);
