// Defines <catalogue-settings>: the grams per standard drink setting.
// Dispatches a bubbling "settings-changed" event with { gramsPerStandardDrink }.

class CatalogueSettings extends HTMLElement {
  #settings = null;

  show({ settings }) {
    this.#settings = settings;
    this.#build();
    this.input.value = settings.gramsPerStandardDrink;
  }

  #build() {
    if (this.input) return;
    const label = document.createElement("label");
    label.append("Grams of alcohol per standard drink ");
    this.input = Object.assign(document.createElement("input"), {
      name: "gramsPerStandardDrink",
      type: "number",
      min: "1",
      step: "any",
    });
    label.append(this.input);
    const note = document.createElement("p");
    note.className = "note";
    note.textContent =
      "Grams of alcohol per standard drink. UK unit 8 g, Australia/NZ/Ireland 10 g, Sweden 12 g, US 14 g. Grams = ml of alcohol × 0.789.";
    this.replaceChildren(label, note);
    this.input.addEventListener("change", () => {
      const grams = this.input.valueAsNumber;
      if (Number.isFinite(grams) && grams > 0) {
        this.dispatchEvent(
          new CustomEvent("settings-changed", { bubbles: true, detail: { gramsPerStandardDrink: grams } }),
        );
      } else {
        this.input.value = this.#settings.gramsPerStandardDrink;
      }
    });
  }
}

customElements.define("catalogue-settings", CatalogueSettings);
