// Defines <liquids-view>: the liquids table, the add-liquid form and a remove button per liquid.
// After any attempted change it dispatches a bubbling "catalogue-changed" event.

class LiquidsView extends HTMLElement {
  #liquids = null;

  set liquids(service) {
    this.#liquids = service;
    this.#build();
    this.render();
  }

  render() {
    this.rows.replaceChildren(...this.#liquids.all().map((liquid) => this.#row(liquid)));
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
    this.form.append(name, percent, button({ type: "submit", textContent: "Add" }));
    this.form.addEventListener("submit", (event) => {
      event.preventDefault();
      const { name, alcoholPercent } = this.form.elements;
      this.#attempt(() => {
        this.#liquids.add({ name: name.value, alcoholPercent: alcoholPercent.valueAsNumber });
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

  #row({ name, alcoholPercent }) {
    const tr = document.createElement("tr");
    tr.dataset.liquid = name;
    const remove = button({ type: "button", className: "remove", textContent: "Remove" });
    remove.setAttribute("aria-label", `Remove ${name}`);
    remove.addEventListener("click", () => this.#attempt(() => this.#liquids.remove(name)));
    tr.append(
      cell("name", name),
      cell("alcohol-percent", `${alcoholPercent} %`),
      cell("actions", remove),
    );
    return tr;
  }
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

customElements.define("liquids-view", LiquidsView);
