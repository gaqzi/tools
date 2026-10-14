// Refactor oracle for the water-temperature tool.
//
// Written against the pre-migration index.html (single inline script, no
// modules) so that the behaviour of the shipped page was pinned down before
// it was split into logic modules and web components. Bugs found while
// pinning it were written up as the correct behaviour and fixed by the
// migration, so every assertion here describes what the page does now.
//
// The spec follows the state-object pattern and is the worked example for
// it: the whole page is one `mixer` object built by `defaultMixer()` with
// overrides, applied through the UI by `setMixer()`, read back by
// `readMixer()`, and compared in one `expect` per test. A test therefore
// shows only what differs from a clean load. Expected values are literals;
// nothing in this file recomputes the page's formula.
import { test, expect } from "@playwright/test";

const PAGE = "/water-temperature/";
const STORAGE_KEY = "tea-water-calc";

// --- The mixer state ---
//
// Inputs (what `setMixer` applies): total, target, room, vessel.
// Everything else follows from them and is only read back.

function defaultMixer(overrides = {}) {
  return {
    total: 500,
    target: 75,
    room: 15,
    vessel: "None",
    sliders: defaultSliders(),
    highlighted: defaultHighlighted(),
    focused: null,
    results: defaultResults(),
    remembered: defaultRemembered(),
    ...overrides,
  };
}

function defaultSliders(overrides = {}) {
  return { total: 500, target: 75, room: 15, ...overrides };
}

function defaultHighlighted(overrides = {}) {
  return { total: "500 mL", target: "Oolong · 75°", room: "Temperate · 15°", ...overrides };
}

function defaultResults(overrides = {}) {
  return {
    boiling: 350,
    cold: 150,
    boilingExact: 353,
    coldExact: 147,
    mixingFor: "Mixing for 75 °C",
    compensation: null,
    warning: null,
    coolTemp: 15,
    hotPct: 70.59,
    coldPct: 29.41,
    labelPct: 70.59,
    barLabel: "75 °C",
    ...overrides,
  };
}

function defaultRemembered(overrides = {}) {
  return {
    url: defaultSettings(),
    stored: defaultSettings(),
    ...overrides,
  };
}

function defaultSettings(overrides = {}) {
  return { ml: 500, temp: 75, room: 15, vessel: 0, ...overrides };
}

// The URL and localStorage always hold the same settings after a change,
// but they are two separately observed values, so both are read and both
// are stated; this factory only saves spelling the same overrides twice.
function remembered(settings = {}) {
  return defaultRemembered({ url: defaultSettings(settings), stored: defaultSettings(settings) });
}

// --- Scenarios that several tests share ---

// Green tea at 70 °C: 500 * (70 - 15) / (100 - 15) = 323.5
const greenTea = (overrides = {}) =>
  defaultMixer({
    target: 70,
    sliders: defaultSliders({ target: 70 }),
    highlighted: defaultHighlighted({ target: "Green tea · 70°" }),
    results: defaultResults({
      boiling: 320, cold: 180, boilingExact: 324, coldExact: 176,
      mixingFor: "Mixing for 70 °C",
      hotPct: 64.71, coldPct: 35.29, labelPct: 64.71, barLabel: "70 °C",
    }),
    remembered: remembered({ temp: 70 }),
    ...overrides,
  });

// Herbal at 100 °C: all boiling water, no exact amounts, and the bar label
// at the 92% cap.
const herbalTea = (overrides = {}) =>
  defaultMixer({
    target: 100,
    sliders: defaultSliders({ target: 100 }),
    highlighted: defaultHighlighted({ target: "Herbal · 100°" }),
    results: defaultResults({
      boiling: 500, cold: 0, boilingExact: null, coldExact: null,
      mixingFor: "Mixing for 100 °C",
      hotPct: 100, coldPct: 0, labelPct: 92, barLabel: "100 °C",
    }),
    remembered: remembered({ temp: 100 }),
    ...overrides,
  });

// --- Reading and setting ---

function readMixer(page) {
  return page.evaluate((storageKey) => {
    const $ = (id) => document.getElementById(id);
    const num = (id) => Number($(id).textContent);
    const pct = (id, prop) => Math.round(parseFloat($(id).style[prop]) * 100) / 100;
    const pillIn = (grid) => $(grid).querySelector(".preset-btn.active")?.textContent ?? null;
    // A hidden exact label reads as null. A visible one reads as the number
    // it names, or as "" when it is visible but blank, which is a bug the
    // page has today in its warning branches and never an expected value.
    const exact = (id) => {
      if (!$(id).classList.contains("visible")) return null;
      const amount = $(id).textContent.match(/\d+/);
      return amount ? Number(amount[0]) : "";
    };
    const active = document.activeElement;
    const compensation = $("mixingFor").textContent.match(/\+(\d+) °C vessel compensation/);
    const raw = localStorage.getItem(storageKey);
    return {
      total: num("totalReadout"),
      target: num("targetReadout"),
      room: num("roomReadout"),
      vessel: $("vesselGrid").querySelector(".vessel-btn.active").childNodes[0].textContent,
      sliders: { total: Number($("totalMl").value), target: Number($("targetTemp").value), room: Number($("roomTemp").value) },
      highlighted: { total: pillIn("mlPresetGrid"), target: pillIn("presetGrid"), room: pillIn("coldPresetGrid") },
      focused: active?.classList.contains("range-value-editable") ? active.id : null,
      results: {
        boiling: num("boilingMl"),
        cold: num("coolMl"),
        boilingExact: exact("boilingExact"),
        coldExact: exact("coolExact"),
        mixingFor: $("mixingFor").childNodes[0].textContent,
        compensation: compensation ? Number(compensation[1]) : null,
        warning: $("warning").classList.contains("visible") ? $("warning").textContent : null,
        coolTemp: parseInt($("coolTemp").textContent, 10),
        hotPct: pct("hotBar", "width"),
        coldPct: pct("coolBar", "width"),
        labelPct: pct("mixBarLabel", "left"),
        barLabel: $("mixBarLabel").textContent,
      },
      remembered: {
        url: Object.fromEntries([...new URLSearchParams(location.search)].map(([k, v]) => [k, Number(v)])),
        stored: raw === null ? null : JSON.parse(raw),
      },
    };
  }, STORAGE_KEY);
}

async function setMixer(page, mixer) {
  await typeReadout(page, "totalReadout", String(mixer.total));
  await typeReadout(page, "targetReadout", String(mixer.target));
  await typeReadout(page, "roomReadout", String(mixer.room));
  await vessel(page, mixer.vessel).click();
}

async function openMixer(page, { params, stored } = {}) {
  if (stored) {
    await page.addInitScript(
      ([key, state]) => localStorage.setItem(key, JSON.stringify(state)),
      [STORAGE_KEY, stored],
    );
  }
  await page.goto(params ? `${PAGE}?${new URLSearchParams(params)}` : PAGE);
}

// --- Driving single controls ---

const pill = (page, name) => page.getByRole("button", { name });
const vessel = (page, name) => page.getByRole("button", { name });
const text = (page, id) => page.locator(`#${id}`);

// Replaces the readout's whole content with one `input` event, the way a
// paste or IME commit does, then leaves the readout. Selecting with the
// keyboard is impossible because the readout's keydown guard swallows
// modifier shortcuts.
async function typeReadout(page, id, value) {
  await text(page, id).click();
  await selectReadout(page, id);
  await page.keyboard.insertText(value);
  await text(page, id).blur();
}

function selectReadout(page, id) {
  return page.evaluate((id) => {
    window.getSelection().selectAllChildren(document.getElementById(id));
  }, id);
}

// --- Tests ---

test.describe("opening the mixer with no saved state", () => {
  test("a clean load matches the defaults", async ({ page }) => {
    await openMixer(page);
    await expect.poll(() => readMixer(page)).toEqual(defaultMixer());
  });
});

test.describe("calculating the mix", () => {
  test.beforeEach(async ({ page }) => {
    await openMixer(page);
  });

  test("rounds to 10 mL and shows the exact amounts when they differ", async ({ page }) => {
    const mixer = greenTea();
    await setMixer(page, mixer);
    await expect.poll(() => readMixer(page)).toEqual(mixer);
  });

  test("hides the exact amounts when rounding changes nothing", async ({ page }) => {
    // 850 * (75 - 15) / (100 - 15) = 600 exactly.
    const mixer = defaultMixer({
      total: 850,
      sliders: defaultSliders({ total: 850 }),
      highlighted: defaultHighlighted({ total: null }),
      results: defaultResults({ boiling: 600, cold: 250, boilingExact: null, coldExact: null }),
      remembered: remembered({ ml: 850 }),
    });
    await setMixer(page, mixer);
    await expect.poll(() => readMixer(page)).toEqual(mixer);
  });

  test("keeps the bar label at 92% when the mix is all boiling water", async ({ page }) => {
    const mixer = herbalTea();
    await setMixer(page, mixer);
    await expect.poll(() => readMixer(page)).toEqual(mixer);
  });

  test("keeps the bar label at 8% when the mix is almost all cold water", async ({ page }) => {
    // 500 * (40 - 35) / (100 - 35) = 38.5 mL, 7.69% of the total.
    const mixer = defaultMixer({
      target: 40,
      room: 35,
      sliders: defaultSliders({ target: 40, room: 35 }),
      highlighted: defaultHighlighted({ target: null, room: null }),
      results: defaultResults({
        boiling: 40, cold: 460, boilingExact: 38, coldExact: 462,
        mixingFor: "Mixing for 40 °C", coolTemp: 35,
        hotPct: 7.69, coldPct: 92.31, labelPct: 8, barLabel: "40 °C",
      }),
      remembered: remembered({ temp: 40, room: 35 }),
    });
    await setMixer(page, mixer);
    await expect.poll(() => readMixer(page)).toEqual(mixer);
  });
});

test.describe("compensating for the vessel", () => {
  // Green tea at 70 °C in a ceramic teapot: 500 * (78 - 15) / (100 - 15) = 370.6
  const greenTeaInTeapot = () =>
    defaultMixer({
      target: 70,
      vessel: "Ceramic teapot",
      sliders: defaultSliders({ target: 70 }),
      highlighted: defaultHighlighted({ target: "Green tea · 70°" }),
      results: defaultResults({
        boiling: 370, cold: 130, boilingExact: 371, coldExact: 129,
        mixingFor: "Mixing for 70 °C", compensation: 8,
        hotPct: 74.12, coldPct: 25.88, labelPct: 74.12, barLabel: "70 °C",
      }),
      remembered: remembered({ temp: 70, vessel: 1 }),
    });

  test.beforeEach(async ({ page }) => {
    await openMixer(page);
  });

  test("adds the vessel offset to the target and says so", async ({ page }) => {
    const mixer = greenTeaInTeapot();
    await setMixer(page, mixer);
    await expect.poll(() => readMixer(page)).toEqual(mixer);
  });

  test("drops the note again when the vessel is set back to none", async ({ page }) => {
    await setMixer(page, greenTeaInTeapot());
    await vessel(page, "None").click();
    await expect.poll(() => readMixer(page)).toEqual(greenTea());
  });
});

test.describe("warning about impossible mixes", () => {
  // There is no test for the "must be above room temperature" warning: the
  // target slider floors at 40 and the room slider caps at 35, and URL
  // parameters are written into the sliders too, so the state is unreachable.

  // Pu-erh at 95 °C in a ceramic teapot wants 103 °C water: all boiling, no
  // exact amounts, and the bar label at the 92% cap.
  const puerhInTeapot = () =>
    defaultMixer({
      target: 95,
      vessel: "Ceramic teapot",
      sliders: defaultSliders({ target: 95 }),
      highlighted: defaultHighlighted({ target: "Pu-erh · 95°" }),
      results: defaultResults({
        boiling: 500, cold: 0, boilingExact: null, coldExact: null,
        mixingFor: "Mixing for 95 °C", compensation: 8, warning: "Target + vessel compensation exceeds 100 °C — use only boiling water, or lower your target.",
        hotPct: 100, coldPct: 0, labelPct: 92, barLabel: "95 °C",
      }),
      remembered: remembered({ temp: 95, vessel: 1 }),
    });

  test.beforeEach(async ({ page }) => {
    await openMixer(page);
  });

  test("uses only boiling water when target plus vessel compensation exceeds 100 °C", async ({ page }) => {
    // Bug in the page today: the warning branch blanks the exact labels but
    // leaves them visible, so they read as "" instead of null.
    const mixer = puerhInTeapot();
    await setMixer(page, mixer);
    await expect.poll(() => readMixer(page)).toEqual(mixer);
  });

  test("moves the bar label to the all-boiling position when the warning appears", async ({ page }) => {
    // Bug in the page today: the warning branch never repositions the bar
    // label, so it keeps the position of the last possible mix (93 °C alone:
    // 91.76%). The migration will make this pass.
    // 93 °C in a ceramic teapot wants 101 °C water.
    const mixer = defaultMixer({
      target: 93,
      vessel: "Ceramic teapot",
      sliders: defaultSliders({ target: 93 }),
      highlighted: defaultHighlighted({ target: null }),
      results: defaultResults({
        boiling: 500, cold: 0, boilingExact: null, coldExact: null,
        mixingFor: "Mixing for 93 °C", compensation: 8, warning: "Target + vessel compensation exceeds 100 °C — use only boiling water, or lower your target.",
        hotPct: 100, coldPct: 0, labelPct: 92, barLabel: "93 °C",
      }),
      remembered: remembered({ temp: 93, vessel: 1 }),
    });
    await setMixer(page, mixer);
    await expect.poll(() => readMixer(page)).toEqual(mixer);
  });

  test("clears the warning once the mix is possible again", async ({ page }) => {
    await setMixer(page, puerhInTeapot());
    await vessel(page, "None").click();
    // 500 * (95 - 15) / (100 - 15) = 470.6
    const mixer = defaultMixer({
      target: 95,
      sliders: defaultSliders({ target: 95 }),
      highlighted: defaultHighlighted({ target: "Pu-erh · 95°" }),
      results: defaultResults({
        boiling: 470, cold: 30, boilingExact: 471, coldExact: 29,
        mixingFor: "Mixing for 95 °C",
        hotPct: 94.12, coldPct: 5.88, labelPct: 92, barLabel: "95 °C",
      }),
      remembered: remembered({ temp: 95 }),
    });
    await expect.poll(() => readMixer(page)).toEqual(mixer);
  });

  test("treats 0 °C cold water as 0 °C", async ({ page }) => {
    // Bug in the page today: `parseFloat($room.value) || 20` turns a room
    // temperature of 0 into 20, so "Ice · 0°" is computed as 20 °C.
    // 1000 * (75 - 0) / (100 - 0) = 750 exactly.
    const mixer = defaultMixer({
      total: 1000,
      room: 0,
      sliders: defaultSliders({ total: 1000, room: 0 }),
      highlighted: defaultHighlighted({ total: "1000 mL", room: "Ice · 0°" }),
      results: defaultResults({
        boiling: 750, cold: 250, boilingExact: null, coldExact: null,
        coolTemp: 0,
        hotPct: 75, coldPct: 25, labelPct: 75,
      }),
      remembered: remembered({ ml: 1000, room: 0 }),
    });
    await pill(page, "1000 mL").click();
    await pill(page, "Ice · 0°").click();
    await expect.poll(() => readMixer(page)).toEqual(mixer);
  });
});

// Each field is driven through one control at a time; `mixer` is the whole
// page state expected afterwards.
const fields = [
  {
    name: "target temperature",
    slider: "targetTemp",
    readout: "targetReadout",
    pill: {
      name: "Green tea · 70°",
      mixer: greenTea(),
    },
    slid: {
      value: "80",
      mixer: defaultMixer({
        target: 80,
        sliders: defaultSliders({ target: 80 }),
        highlighted: defaultHighlighted({ target: "White tea · 80°" }),
        results: defaultResults({
          boiling: 380, cold: 120, boilingExact: 382, coldExact: 118,
          mixingFor: "Mixing for 80 °C",
          hotPct: 76.47, coldPct: 23.53, labelPct: 76.47, barLabel: "80 °C",
        }),
        remembered: remembered({ temp: 80 }),
      }),
    },
    offPill: {
      value: "81",
      mixer: defaultMixer({
        target: 81,
        sliders: defaultSliders({ target: 81 }),
        highlighted: defaultHighlighted({ target: null }),
        results: defaultResults({
          boiling: 390, cold: 110, boilingExact: 388, coldExact: 112,
          mixingFor: "Mixing for 81 °C",
          hotPct: 77.65, coldPct: 22.35, labelPct: 77.65, barLabel: "81 °C",
        }),
        remembered: remembered({ temp: 81 }),
      }),
    },
    typed: {
      value: "92",
      mixer: defaultMixer({
        target: 92,
        sliders: defaultSliders({ target: 92 }),
        highlighted: defaultHighlighted({ target: "Coffee (Hoffmann) · 92°" }),
        results: defaultResults({
          boiling: 450, cold: 50, boilingExact: 453, coldExact: 47,
          mixingFor: "Mixing for 92 °C",
          hotPct: 90.59, coldPct: 9.41, labelPct: 90.59, barLabel: "92 °C",
        }),
        remembered: remembered({ temp: 92 }),
      }),
    },
  },
  {
    name: "total water",
    slider: "totalMl",
    readout: "totalReadout",
    pill: {
      name: "300 mL · 10 oz",
      mixer: defaultMixer({
        total: 300,
        sliders: defaultSliders({ total: 300 }),
        highlighted: defaultHighlighted({ total: "300 mL · 10 oz" }),
        results: defaultResults({ boiling: 210, cold: 90, boilingExact: 212, coldExact: 88 }),
        remembered: remembered({ ml: 300 }),
      }),
    },
    slid: {
      value: "750",
      mixer: defaultMixer({
        total: 750,
        sliders: defaultSliders({ total: 750 }),
        highlighted: defaultHighlighted({ total: "750 mL" }),
        results: defaultResults({ boiling: 530, cold: 220, boilingExact: 529, coldExact: 221 }),
        remembered: remembered({ ml: 750 }),
      }),
    },
    offPill: {
      value: "760",
      mixer: defaultMixer({
        total: 760,
        sliders: defaultSliders({ total: 760 }),
        highlighted: defaultHighlighted({ total: null }),
        results: defaultResults({ boiling: 540, cold: 220, boilingExact: 536, coldExact: 224 }),
        remembered: remembered({ ml: 760 }),
      }),
    },
    typed: {
      value: "250",
      mixer: defaultMixer({
        total: 250,
        sliders: defaultSliders({ total: 250 }),
        highlighted: defaultHighlighted({ total: "250 mL" }),
        results: defaultResults({ boiling: 180, cold: 70, boilingExact: 176, coldExact: 74 }),
        remembered: remembered({ ml: 250 }),
      }),
    },
  },
  {
    name: "cold water temperature",
    slider: "roomTemp",
    readout: "roomReadout",
    pill: {
      name: "Fridge · 4°",
      mixer: defaultMixer({
        room: 4,
        sliders: defaultSliders({ room: 4 }),
        highlighted: defaultHighlighted({ room: "Fridge · 4°" }),
        results: defaultResults({
          boiling: 370, cold: 130, boilingExact: null, coldExact: null,
          coolTemp: 4,
          hotPct: 73.96, coldPct: 26.04, labelPct: 73.96,
        }),
        remembered: remembered({ room: 4 }),
      }),
    },
    slid: {
      value: "22",
      mixer: defaultMixer({
        room: 22,
        sliders: defaultSliders({ room: 22 }),
        highlighted: defaultHighlighted({ room: "Warm climate · 22°" }),
        results: defaultResults({
          boiling: 340, cold: 160, boilingExact: null, coldExact: null,
          coolTemp: 22,
          hotPct: 67.95, coldPct: 32.05, labelPct: 67.95,
        }),
        remembered: remembered({ room: 22 }),
      }),
    },
    offPill: {
      value: "23",
      mixer: defaultMixer({
        room: 23,
        sliders: defaultSliders({ room: 23 }),
        highlighted: defaultHighlighted({ room: null }),
        results: defaultResults({
          boiling: 340, cold: 160, boilingExact: 338, coldExact: 162,
          coolTemp: 23,
          hotPct: 67.53, coldPct: 32.47, labelPct: 67.53,
        }),
        remembered: remembered({ room: 23 }),
      }),
    },
    typed: {
      value: "28",
      mixer: defaultMixer({
        room: 28,
        sliders: defaultSliders({ room: 28 }),
        highlighted: defaultHighlighted({ room: "Tropical · 28°" }),
        results: defaultResults({
          boiling: 330, cold: 170, boilingExact: 326, coldExact: 174,
          coolTemp: 28,
          hotPct: 65.28, coldPct: 34.72, labelPct: 65.28,
        }),
        remembered: remembered({ room: 28 }),
      }),
    },
  },
];

for (const f of fields) {
  test.describe(`keeping the ${f.name} pills, slider and readout in sync`, () => {
    test.beforeEach(async ({ page }) => {
      await openMixer(page);
    });

    test("clicking a pill sets the slider and readout and highlights the pill", async ({ page }) => {
      await pill(page, f.pill.name).click();
      await expect.poll(() => readMixer(page)).toEqual(f.pill.mixer);
    });

    test("moving the slider updates the readout and highlights the matching pill", async ({ page }) => {
      await text(page, f.slider).fill(f.slid.value);
      await expect.poll(() => readMixer(page)).toEqual(f.slid.mixer);
    });

    test("moving the slider off every pill value highlights nothing", async ({ page }) => {
      await pill(page, f.pill.name).click();
      await text(page, f.slider).fill(f.offPill.value);
      await expect.poll(() => readMixer(page)).toEqual(f.offPill.mixer);
    });

    test("typing in the readout updates the slider and the pill highlight", async ({ page }) => {
      await typeReadout(page, f.readout, f.typed.value);
      await expect.poll(() => readMixer(page)).toEqual(f.typed.mixer);
    });
  });
}

test.describe("typing a volume beyond the slider", () => {
  test("keeps the readout at 2000 while the slider stops at 1500 and the mix uses 2000", async ({ page }) => {
    await openMixer(page);
    // 2000 * (75 - 15) / (100 - 15) = 1411.8
    const mixer = defaultMixer({
      total: 2000,
      sliders: defaultSliders({ total: 1500 }),
      highlighted: defaultHighlighted({ total: null }),
      results: defaultResults({ boiling: 1410, cold: 590, boilingExact: 1412, coldExact: 588 }),
      remembered: remembered({ ml: 2000 }),
    });
    await setMixer(page, mixer);
    await expect.poll(() => readMixer(page)).toEqual(mixer);
  });
});

test.describe("guarding what goes into a readout", () => {
  test.beforeEach(async ({ page }) => {
    await openMixer(page);
  });

  test("swallows letters typed into a readout", async ({ page }) => {
    await text(page, "targetReadout").click();
    await page.keyboard.press("End");
    await page.keyboard.type("abc");
    await expect.poll(() => readMixer(page)).toEqual(defaultMixer({ focused: "targetReadout" }));
  });

  test("keeps only the digits of pasted text", async ({ page }) => {
    await text(page, "roomReadout").click();
    await selectReadout(page, "roomReadout");
    await page.evaluate(() => {
      const clipboardData = new DataTransfer();
      clipboardData.setData("text/plain", "abc12");
      document
        .getElementById("roomReadout")
        .dispatchEvent(new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }));
    });
    // 500 * (75 - 12) / (100 - 12) = 358.0
    const mixer = defaultMixer({
      room: 12,
      focused: "roomReadout",
      sliders: defaultSliders({ room: 12 }),
      highlighted: defaultHighlighted({ room: null }),
      results: defaultResults({
        boiling: 360, cold: 140, boilingExact: 358, coldExact: 142,
        coolTemp: 12,
        hotPct: 71.59, coldPct: 28.41, labelPct: 71.59,
      }),
      remembered: remembered({ room: 12 }),
    });
    await expect.poll(() => readMixer(page)).toEqual(mixer);
  });

  test("focuses the readout when it is clicked", async ({ page }) => {
    await text(page, "totalReadout").click();
    await expect.poll(() => readMixer(page)).toEqual(defaultMixer({ focused: "totalReadout" }));
  });

  test("blurs the readout on Enter", async ({ page }) => {
    await text(page, "totalReadout").click();
    await page.keyboard.press("Enter");
    await expect.poll(() => readMixer(page)).toEqual(defaultMixer());
  });

  for (const id of ["totalReadout", "targetReadout", "roomReadout"]) {
    test(`restores the default when ${id} is cleared and left`, async ({ page }) => {
      await text(page, id).click();
      await selectReadout(page, id);
      await page.keyboard.press("Backspace");
      await text(page, id).blur();
      await expect.poll(() => readMixer(page)).toEqual(defaultMixer());
    });
  }

  test("clamps a target above 100 down to 100", async ({ page }) => {
    await typeReadout(page, "targetReadout", "200");
    await expect.poll(() => readMixer(page)).toEqual(herbalTea());
  });

  test("clamps a volume below 50 up to 50", async ({ page }) => {
    await typeReadout(page, "totalReadout", "0");
    // 50 * (75 - 15) / (100 - 15) = 35.3
    const mixer = defaultMixer({
      total: 50,
      sliders: defaultSliders({ total: 50 }),
      highlighted: defaultHighlighted({ total: null }),
      results: defaultResults({ boiling: 40, cold: 10, boilingExact: 35, coldExact: 15 }),
      remembered: remembered({ ml: 50 }),
    });
    await expect.poll(() => readMixer(page)).toEqual(mixer);
  });
});

test.describe("typing a target one keystroke at a time", () => {
  // Bug in the page today: the readout's `input` handler clamps the text on
  // every keystroke, so a "7" on its way to "70" is rewritten to "40" before
  // the "0" can be typed. Expected: the readout keeps what was typed, the
  // slider and the mix follow the clamped value, and only blur or Enter
  // clamps the readout text. The migration will make these pass.

  // What the page shows while the target slider sits at its 40 °C floor:
  // 500 * (40 - 15) / (100 - 15) = 147.1
  const clampedToFloor = (overrides = {}) =>
    defaultMixer({
      target: 40,
      sliders: defaultSliders({ target: 40 }),
      highlighted: defaultHighlighted({ target: null }),
      results: defaultResults({
        boiling: 150, cold: 350, boilingExact: 147, coldExact: 353,
        mixingFor: "Mixing for 40 °C",
        hotPct: 29.41, coldPct: 70.59, labelPct: 29.41, barLabel: "40 °C",
      }),
      remembered: remembered({ temp: 40 }),
      ...overrides,
    });

  test.beforeEach(async ({ page }) => {
    await openMixer(page);
    await text(page, "targetReadout").click();
    await selectReadout(page, "targetReadout");
    await page.keyboard.press("Backspace");
  });

  test("keeps a lone 7 in the readout while the slider and mix follow the 40 °C floor", async ({ page }) => {
    await page.keyboard.type("7");
    await expect.poll(() => readMixer(page)).toEqual(clampedToFloor({ target: 7, focused: "targetReadout" }));
  });

  test("follows the full number once the second digit makes it 70", async ({ page }) => {
    await page.keyboard.type("70");
    await expect.poll(() => readMixer(page)).toEqual(greenTea({ focused: "targetReadout" }));
  });

  test("clamps the readout text to 40 only when Enter leaves it", async ({ page }) => {
    await page.keyboard.type("7");
    await page.keyboard.press("Enter");
    await expect.poll(() => readMixer(page)).toEqual(clampedToFloor());
  });
});

test.describe("remembering the settings", () => {
  test("writes every change to the URL and to localStorage", async ({ page }) => {
    await openMixer(page);
    // 750 * (75 - 4) / (100 - 4) = 554.7
    const mixer = defaultMixer({
      total: 750,
      target: 70,
      room: 4,
      vessel: "Ceramic mug",
      sliders: defaultSliders({ total: 750, target: 70, room: 4 }),
      highlighted: defaultHighlighted({ total: "750 mL", target: "Green tea · 70°", room: "Fridge · 4°" }),
      results: defaultResults({
        boiling: 550, cold: 200, boilingExact: 555, coldExact: 195,
        mixingFor: "Mixing for 70 °C", compensation: 5, coolTemp: 4,
        hotPct: 73.96, coldPct: 26.04, labelPct: 73.96, barLabel: "70 °C",
      }),
      remembered: remembered({ ml: 750, temp: 70, room: 4, vessel: 2 }),
    });
    await setMixer(page, mixer);
    await expect.poll(() => readMixer(page)).toEqual(mixer);
  });

  test("restores from localStorage when the URL has no parameters", async ({ page }) => {
    await openMixer(page, { stored: defaultSettings({ ml: 1000, temp: 80, room: 8, vessel: 3 }) });
    // 1000 * (84 - 8) / (100 - 8) = 826.1
    const mixer = defaultMixer({
      total: 1000,
      target: 80,
      room: 8,
      vessel: "Glass teapot",
      sliders: defaultSliders({ total: 1000, target: 80, room: 8 }),
      highlighted: defaultHighlighted({ total: "1000 mL", target: "White tea · 80°", room: "Cold climate · 8°" }),
      results: defaultResults({
        boiling: 830, cold: 170, boilingExact: 826, coldExact: 174,
        mixingFor: "Mixing for 80 °C", compensation: 4, coolTemp: 8,
        hotPct: 82.61, coldPct: 17.39, labelPct: 82.61, barLabel: "80 °C",
      }),
      remembered: remembered({ ml: 1000, temp: 80, room: 8, vessel: 3 }),
    });
    await expect.poll(() => readMixer(page)).toEqual(mixer);
  });

  test("lets URL parameters override localStorage", async ({ page }) => {
    await openMixer(page, {
      stored: defaultSettings({ ml: 1000, temp: 80, room: 8, vessel: 3 }),
      params: { ml: 300, temp: 92, room: 22, vessel: 1 },
    });
    // 300 * (100 - 22) / (100 - 22) = 300 exactly.
    const mixer = defaultMixer({
      total: 300,
      target: 92,
      room: 22,
      vessel: "Ceramic teapot",
      sliders: defaultSliders({ total: 300, target: 92, room: 22 }),
      highlighted: defaultHighlighted({ total: "300 mL · 10 oz", target: "Coffee (Hoffmann) · 92°", room: "Warm climate · 22°" }),
      results: defaultResults({
        boiling: 300, cold: 0, boilingExact: null, coldExact: null,
        mixingFor: "Mixing for 92 °C", compensation: 8, coolTemp: 22,
        hotPct: 100, coldPct: 0, labelPct: 92, barLabel: "92 °C",
      }),
      remembered: remembered({ ml: 300, temp: 92, room: 22, vessel: 1 }),
    });
    await expect.poll(() => readMixer(page)).toEqual(mixer);
  });

  test("restores the thermos rather than the glass mug that shares its offset", async ({ page }) => {
    await openMixer(page, { params: { vessel: 5 } });
    // 500 * (78 - 15) / (100 - 15) = 370.6
    const mixer = defaultMixer({
      vessel: "Thermos",
      results: defaultResults({
        boiling: 370, cold: 130, boilingExact: 371, coldExact: 129,
        compensation: 3,
        hotPct: 74.12, coldPct: 25.88, labelPct: 74.12,
      }),
      remembered: remembered({ vessel: 5 }),
    });
    await expect.poll(() => readMixer(page)).toEqual(mixer);
  });

  test("clamps an out-of-range vessel index to the last vessel", async ({ page }) => {
    await openMixer(page, { params: { vessel: 99 } });
    // 500 * (77 - 15) / (100 - 15) = 364.7
    const mixer = defaultMixer({
      vessel: "Plastic",
      results: defaultResults({
        boiling: 360, cold: 140, boilingExact: 365, coldExact: 135,
        compensation: 2,
        hotPct: 72.94, coldPct: 27.06, labelPct: 72.94,
      }),
      remembered: remembered({ vessel: 6 }),
    });
    await expect.poll(() => readMixer(page)).toEqual(mixer);
  });
});

test.describe("recovering from a tampered URL", () => {
  // These document behaviour the migration will add: today the page trusts
  // URL parameters as-is (NaN readouts, a crash on a non-numeric vessel, and
  // readouts outside the slider range).
  test("falls back to the defaults for non-numeric parameters and rewrites the URL", async ({ page }) => {
    await openMixer(page, { params: { temp: "abc", ml: "xyz", room: "foo", vessel: "bar" } });
    await expect.poll(() => readMixer(page)).toEqual(defaultMixer());
  });

  test("clamps out-of-range parameters and rewrites the URL to match", async ({ page }) => {
    await openMixer(page, { params: { ml: 5, temp: 200, room: 99 } });
    // Clamped to 50 mL, 100 °C and 35 °C: 50 * (100 - 35) / (100 - 35) = 50
    // exactly, so all boiling, no exact amounts, and the label at the 92% cap.
    const mixer = defaultMixer({
      total: 50,
      target: 100,
      room: 35,
      sliders: defaultSliders({ total: 50, target: 100, room: 35 }),
      highlighted: defaultHighlighted({ total: null, target: "Herbal · 100°", room: null }),
      results: defaultResults({
        boiling: 50, cold: 0, boilingExact: null, coldExact: null,
        mixingFor: "Mixing for 100 °C", coolTemp: 35,
        hotPct: 100, coldPct: 0, labelPct: 92, barLabel: "100 °C",
      }),
      remembered: remembered({ ml: 50, temp: 100, room: 35 }),
    });
    await expect.poll(() => readMixer(page)).toEqual(mixer);
  });
});
