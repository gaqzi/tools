// Defines <liquids-view>: the liquids table and the add-liquid form.

class LiquidsView extends HTMLElement {
  #liquids = null;

  set liquids(service) {
    this.#liquids = service;
    this.#build();
    this.#render();
  }

  #build() {
    if (this.form) return;
    this.rows = document.createElement("tbody");
    const table = document.createElement("table");
    table.append(this.rows);

    this.form = document.createElement("form");
    this.form.className = "add-liquid";
    const name = input({ name: "name", type: "text", placeholder: "Liquid", required: true });
    const percent = input({ name: "alcoholPercent", type: "number", placeholder: "%", required: true });
    Object.assign(percent, { step: "any", min: "0", max: "100" });
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = "Add";
    this.form.append(name, percent, submit);
    this.form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.#add();
    });

    this.error = document.createElement("p");
    this.error.className = "error";
    this.replaceChildren(table, this.form, this.error);
  }

  #add() {
    const { name, alcoholPercent } = this.form.elements;
    try {
      this.#liquids.add({ name: name.value, alcoholPercent: alcoholPercent.valueAsNumber });
      this.form.reset();
      this.error.textContent = "";
    } catch (error) {
      this.error.textContent = error.message;
    }
    this.#render();
  }

  #render() {
    this.rows.replaceChildren(...this.#liquids.all().map(row));
  }
}

function input(properties) {
  return Object.assign(document.createElement("input"), properties);
}

function row({ name, alcoholPercent }) {
  const tr = document.createElement("tr");
  tr.dataset.liquid = name;
  const nameCell = document.createElement("td");
  nameCell.className = "name";
  nameCell.textContent = name;
  const percentCell = document.createElement("td");
  percentCell.className = "alcohol-percent";
  percentCell.textContent = `${alcoholPercent} %`;
  tr.append(nameCell, percentCell);
  return tr;
}

customElements.define("liquids-view", LiquidsView);
