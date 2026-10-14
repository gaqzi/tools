// Defines <catalogue-file>: export and import of the whole catalogue.
// Dispatches a bubbling "catalogue-replaced" event with the validated stores.

import { storesFileContents, storesFromFileContents } from "./stores-file.js";

class CatalogueFile extends HTMLElement {
  #stores = null;

  show({ stores }) {
    this.#stores = stores;
    this.#build();
  }

  #build() {
    if (this.error) return;
    const exportButton = Object.assign(document.createElement("button"), {
      type: "button",
      className: "export",
      textContent: "Export",
    });
    exportButton.addEventListener("click", () => this.#download());

    const importInput = Object.assign(document.createElement("input"), { type: "file", className: "import" });
    importInput.accept = "application/json,.json";
    importInput.setAttribute("aria-label", "Import");
    importInput.addEventListener("change", async () => {
      const [file] = importInput.files;
      if (!file) return;
      try {
        const stores = storesFromFileContents(await file.text());
        this.error.textContent = "";
        this.dispatchEvent(new CustomEvent("catalogue-replaced", { bubbles: true, detail: stores }));
      } catch (error) {
        this.error.textContent = error.message;
      }
      importInput.value = "";
    });

    this.error = document.createElement("p");
    this.error.className = "error";
    this.replaceChildren(exportButton, importInput, this.error);
  }

  #download() {
    const blob = new Blob([storesFileContents(this.#stores)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = Object.assign(document.createElement("a"), { href: url, download: "standard-drinks.json" });
    anchor.click();
    URL.revokeObjectURL(url);
  }
}

customElements.define("catalogue-file", CatalogueFile);
