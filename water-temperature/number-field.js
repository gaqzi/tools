// <number-field name default [text-max]>: one numeric setting driven three
// ways — preset pills, a contenteditable readout and a range slider — kept
// in sync. The element wraps the existing field markup (light DOM) and
// finds its pill grid, readout and slider by their classes and types.
//
// The slider's min/max are the field's bounds; `text-max` lets the readout
// accept more than the slider shows (the slider then stops at its own max).
// While the readout is focused its text is left as typed and only the
// bounded value is pushed to the slider; blur or Enter rewrites the text.
//
// Emits `value-change` (a CustomEvent with the numeric value as `detail`) on
// every user-driven change. Setting `.value` does not emit.

import { boundedNumber } from "./bounded-number.js";

const EDITING_KEYS = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Home", "End"];

export class NumberField extends HTMLElement {
  connectedCallback() {
    this.grid = this.querySelector(".preset-grid");
    this.readout = this.querySelector(".range-value-editable");
    this.slider = this.querySelector('input[type="range"]');

    this.min = Number(this.slider.min);
    this.sliderMax = Number(this.slider.max);
    this.textMax = this.hasAttribute("text-max") ? Number(this.getAttribute("text-max")) : this.sliderMax;
    this.fallback = Number(this.getAttribute("default"));
    this.current = boundedNumber(this.readout.textContent, this.bounds());

    this.grid.addEventListener("click", (e) => {
      const btn = e.target.closest(".preset-btn");
      if (!btn) return;
      this.value = Number(btn.dataset.val);
      this.emit();
    });

    this.slider.addEventListener("input", () => {
      this.value = Number(this.slider.value);
      this.emit();
    });

    this.readout.addEventListener("input", () => {
      this.current = boundedNumber(this.readout.textContent, this.bounds());
      this.showValue();
      this.emit();
    });

    this.readout.addEventListener("blur", () => {
      this.value = boundedNumber(this.readout.textContent, this.bounds());
      this.emit();
    });

    this.readout.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.readout.blur();
        return;
      }
      if (EDITING_KEYS.includes(e.key) || /^\d$/.test(e.key)) return;
      e.preventDefault();
    });

    this.readout.addEventListener("paste", (e) => {
      e.preventDefault();
      const digits = e.clipboardData.getData("text").replace(/\D/g, "");
      document.execCommand("insertText", false, digits);
    });
  }

  get value() {
    return this.current;
  }

  set value(value) {
    this.current = boundedNumber(String(value), this.bounds());
    this.readout.textContent = String(this.current);
    this.showValue();
  }

  bounds() {
    return { min: this.min, max: this.textMax, fallback: this.fallback };
  }

  // Pushes the current value to the slider (capped at its max) and the
  // pill highlight, leaving the readout text alone.
  showValue() {
    this.slider.value = String(Math.min(this.current, this.sliderMax));
    for (const btn of this.grid.querySelectorAll(".preset-btn")) {
      btn.classList.toggle("active", btn.dataset.val === String(this.current));
    }
  }

  emit() {
    this.dispatchEvent(new CustomEvent("value-change", { detail: this.current }));
  }
}

customElements.define("number-field", NumberField);
