// Defines <drink-lists-view>: the drink lists table with each list's totals,
// an add-entry form per list, the add-drink-list form and a short note.
// After any attempted change it dispatches a bubbling "catalogue-changed" event.

import { gramsOfAlcohol, hoursToClear, standardDrinks } from "./alcohol.js";

class DrinkListsView extends HTMLElement {
  #drinkLists = null;
  #drinks = null;
  #settings = null;

  // The drink lists service, and the drinks service the add-entry select lists.
  show({ drinkLists, drinks, settings }) {
    this.#settings = settings;
    this.#drinkLists = drinkLists;
    this.#drinks = drinks;
    this.#build();
    this.render();
  }

  render() {
    const drinkNames = this.#drinks.all().map(({ name }) => name);
    this.rows.replaceChildren(...this.#drinkLists.all().map((drinkList) => this.#row(drinkList, drinkNames)));
  }

  #build() {
    if (this.form) return;
    this.rows = document.createElement("tbody");
    const table = document.createElement("table");
    table.append(this.rows);

    this.form = document.createElement("form");
    this.form.className = "add-drink-list";
    const name = input({ name: "name", type: "text", placeholder: "Drink list", required: true });
    this.form.append(name, button({ type: "submit", textContent: "Add" }));
    this.form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.#attempt(() => {
        this.#drinkLists.add({ name: name.value });
        this.form.reset();
      });
    });

    const note = document.createElement("p");
    note.className = "note";
    note.textContent = "Hours to clear is a rough estimate for an average person at one standard drink per hour.";

    this.error = document.createElement("p");
    this.error.className = "error";
    this.replaceChildren(table, note, this.form, this.error);
  }

  #attempt(change) {
    try {
      change();
      this.error.textContent = "";
    } catch (error) {
      this.error.textContent = error.message;
    }
    this.dispatchEvent(new CustomEvent("catalogue-changed", { bubbles: true }));
  }

  #row({ name, entries }, drinkNames) {
    const amount = this.#drinkLists.amountOf(name);
    const alcohol = this.#drinkLists.alcoholOf(name);
    const percent = amount === 0 ? 0 : (alcohol / amount) * 100;
    const standard = standardDrinks(gramsOfAlcohol(alcohol), this.#settings);
    const tr = document.createElement("tr");
    tr.dataset.drinkList = name;
    tr.append(
      cell("name", name),
      cell("entries", entries.map(({ drink, quantity }) => `${quantity} × ${drink}`).join(", ")),
      cell("amount", `${amount} ml`),
      cell("alcohol-percent", `${oneDecimal(percent)} %`),
      cell("alcohol", `${oneDecimal(alcohol)} ml`),
      cell("standard-drinks", oneDecimal(standard)),
      cell("hours-to-clear", `${oneDecimal(hoursToClear(standard))} h`),
      cell("add-entry-cell", this.#addEntryForm(name, drinkNames)),
    );
    return tr;
  }

  #addEntryForm(listName, drinkNames) {
    const form = document.createElement("form");
    form.className = "add-entry";
    const drink = document.createElement("select");
    drink.name = "drink";
    drink.setAttribute("aria-label", `Drink for ${listName}`);
    drink.append(...drinkNames.map((name) => Object.assign(document.createElement("option"), { value: name, textContent: name })));
    const quantity = input({ name: "quantity", type: "number", placeholder: "Qty", required: true });
    Object.assign(quantity, { step: "1", min: "1" });
    quantity.setAttribute("aria-label", `Quantity for ${listName}`);
    form.append(drink, quantity, button({ type: "submit", textContent: "Add entry" }));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.#attempt(() => this.#drinkLists.addEntry(listName, { drink: drink.value, quantity: quantity.valueAsNumber }));
    });
    return form;
  }
}

function oneDecimal(number) {
  return number.toFixed(1);
}

function input(properties) {
  return Object.assign(document.createElement("input"), properties);
}

function button(properties) {
  return Object.assign(document.createElement("button"), properties);
}

function cell(className, content) {
  const td = document.createElement("td");
  td.className = className;
  td.append(content);
  return td;
}

customElements.define("drink-lists-view", DrinkListsView);
