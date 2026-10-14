// <water-mixer>: the whole page. Owns the settings (volume, target, cold
// water temperature, vessel), restores them from the URL and localStorage
// on connect, renders the mix whenever a setting changes, and writes the
// settings back to both so the URL always matches the screen.

import "./number-field.js";
import { mix } from "./mixing.js";
import { vesselByIndex } from "./vessels.js";
import {
  STORAGE_KEY,
  settingsFromParams,
  settingsToParams,
  resolveSettings,
} from "./remembered-settings.js";

const WARNINGS = {
  "above-boiling": "Target + vessel compensation exceeds 100 °C — use only boiling water, or lower your target.",
  "below-room": "Target (with vessel compensation) must be above room temperature.",
};

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export class WaterMixer extends HTMLElement {
  connectedCallback() {
    const $ = (id) => this.querySelector(`#${id}`);
    this.fields = {
      ml: this.querySelector('number-field[name="ml"]'),
      temp: this.querySelector('number-field[name="temp"]'),
      room: this.querySelector('number-field[name="room"]'),
    };
    this.vesselGrid = $("vesselGrid");
    this.vesselButtons = [...this.vesselGrid.querySelectorAll(".vessel-btn")];
    this.out = {
      mixingFor: $("mixingFor"),
      boilingMl: $("boilingMl"),
      coolMl: $("coolMl"),
      boilingExact: $("boilingExact"),
      coolExact: $("coolExact"),
      coolTemp: $("coolTemp"),
      hotBar: $("hotBar"),
      coolBar: $("coolBar"),
      mixBarLabel: $("mixBarLabel"),
      warning: $("warning"),
    };

    const settings = resolveSettings({
      url: settingsFromParams(new URLSearchParams(location.search)),
      stored: readStored(),
    });
    for (const key of Object.keys(this.fields)) this.fields[key].value = settings[key];
    this.vessel = settings.vessel;

    for (const field of Object.values(this.fields)) {
      field.addEventListener("value-change", () => this.update());
    }
    this.vesselGrid.addEventListener("click", (e) => {
      const btn = e.target.closest(".vessel-btn");
      if (!btn) return;
      this.vessel = this.vesselButtons.indexOf(btn);
      this.update();
    });

    this.update();
  }

  settings() {
    return {
      ml: this.fields.ml.value,
      temp: this.fields.temp.value,
      room: this.fields.room.value,
      vessel: this.vessel,
    };
  }

  update() {
    const settings = this.settings();
    this.render(settings);
    this.remember(settings);
  }

  render({ ml, temp, room, vessel }) {
    const { offsetC } = vesselByIndex(vessel);
    const result = mix({ totalMl: ml, targetC: temp, roomC: room, vesselOffsetC: offsetC });
    const out = this.out;

    this.vesselButtons.forEach((btn, i) => btn.classList.toggle("active", i === vessel));

    out.mixingFor.replaceChildren(`Mixing for ${temp} °C`);
    if (offsetC > 0) {
      const note = document.createElement("span");
      note.style.cssText = "font-size:0.75rem;font-weight:400;color:var(--muted)";
      note.textContent = `+${offsetC} °C vessel compensation`;
      out.mixingFor.append(document.createElement("br"), note);
    }

    out.boilingMl.textContent = String(result.boilingRoundedMl);
    out.coolMl.textContent = String(result.coldRoundedMl);
    showExact(out.boilingExact, result.boilingDiffers, result.boilingMl);
    showExact(out.coolExact, result.coldDiffers, result.coldMl);
    out.coolTemp.textContent = `${room} °C`;

    out.warning.textContent = result.warning ? WARNINGS[result.warning] : "";
    out.warning.classList.toggle("visible", result.warning !== null);

    out.hotBar.style.width = `${result.hotPct}%`;
    out.coolBar.style.width = `${100 - result.hotPct}%`;
    out.mixBarLabel.style.left = `${result.labelPct}%`;
    out.mixBarLabel.textContent = `${temp} °C`;
  }

  remember(settings) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Storage may be unavailable; the URL still carries the settings.
    }
    history.replaceState(null, "", `${location.pathname}?${settingsToParams(settings)}`);
  }
}

function showExact(el, differs, exactMl) {
  el.textContent = differs ? `(exact: ${Math.round(exactMl)} mL)` : " ";
  el.classList.toggle("visible", differs);
}

customElements.define("water-mixer", WaterMixer);
