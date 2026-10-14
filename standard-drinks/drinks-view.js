// Defines <drinks-view>: the drinks table with each drink's figures, an
// add-part form per drink and the add-drink form.
// After any attempted change it dispatches a bubbling "catalogue-changed" event.

import { gramsOfAlcohol, standardDrinks } from "./alcohol.js";

class DrinksView extends HTMLElement {
  #drinks = null;
  #liquids = null;
  #settings = null;

  // The drinks service, and the liquids service the add-part select lists.
  show({ drinks, liquids, settings }) {
    this.#settings = settings;
    this.#drinks = drinks;
    this.#liquids = liquids;
    this.#build();
    this.render();
  }

  render() {
    const liquidNames = this.#liquids.all().map(({ name }) => name);
    this.rows.replaceChildren(...this.#drinks.all().map((drink) => this.#row(drink, liquidNames)));
  }

  #build() {
    if (this.form) return;
    this.rows = document.createElement("tbody");
    const table = document.createElement("table");
    table.append(this.rows);

    this.form = document.createElement("form");
    this.form.className = "add-drink";
    const name = input({ name: "name", type: "text", placeholder: "Drink", required: true });
    this.form.append(name, button({ type: "submit", textContent: "Add" }));
    this.form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.#attempt(() => {
        this.#drinks.add({ name: name.value });
        this.form.reset();
      });
    });

    this.error = document.createElement("p");
    this.error.className = "error";
    this.replaceChildren(table, this.form, this.error);
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

  #row({ name, parts }, liquidNames) {
    const alcohol = this.#drinks.alcoholOf(name);
    const tr = document.createElement("tr");
    tr.dataset.drink = name;
    const remove = button({ type: "button", className: "remove", textContent: "Remove" });
    remove.setAttribute("aria-label", `Remove ${name}`);
    remove.addEventListener("click", () => this.#attempt(() => this.#drinks.remove(name)));
    tr.append(
      cell("name", name),
      cell("parts", parts.map(({ liquid, amount }) => `${liquid} ${amount} ml`).join(", ")),
      cell("amount", `${oneDecimal(this.#drinks.amountOf(name))} ml`),
      cell("alcohol-percent", `${oneDecimal(this.#drinks.alcoholPercentOf(name))} %`),
      cell("alcohol", `${oneDecimal(alcohol)} ml`),
      cell("standard-drinks", oneDecimal(standardDrinks(gramsOfAlcohol(alcohol), this.#settings))),
      cell("add-part-cell", this.#addPartForm(name, liquidNames)),
      cell("actions", remove),
    );
    return tr;
  }

  #addPartForm(drinkName, liquidNames) {
    const form = document.createElement("form");
    form.className = "add-part";
    const liquid = document.createElement("select");
    liquid.name = "liquid";
    liquid.setAttribute("aria-label", `Liquid for ${drinkName}`);
    liquid.append(...liquidNames.map((name) => Object.assign(document.createElement("option"), { value: name, textContent: name })));
    const amount = input({ name: "amount", type: "number", placeholder: "ml", required: true });
    Object.assign(amount, { step: "any", min: "0" });
    amount.setAttribute("aria-label", `Millilitres for ${drinkName}`);
    form.append(liquid, amount, button({ type: "submit", textContent: "Add part" }));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.#attempt(() => this.#drinks.addPart(drinkName, { liquid: liquid.value, amount: amount.valueAsNumber }));
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

customElements.define("drinks-view", DrinksView);
