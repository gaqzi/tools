// Browser spec for the standard-drinks tool, round 1: liquids end to end.
//
// What this proves: the real page, with its real wiring, shows the seed
// catalogue on a first visit, adds a liquid through the form, remembers it
// across a reload, and shows the error when a name is taken. The whole
// catalogue is one `catalogue` object, read by `readCatalogue`, driven by
// `addLiquid`, and compared once per test.
//
// The rules went to the unit tests: name uniqueness, trimming, validation
// and copying in liquids.test.js; the seed list in seed-stores.test.js;
// the storage shape in remembered-stores.test.js; the persist-on-change
// wiring in catalogue.test.js. This file stays small on purpose.
import { test, expect } from "@playwright/test";

const PAGE = "/standard-drinks/";
const STORAGE_KEY = "standard-drinks";

// --- The catalogue state ---

function catalogue(overrides = {}) {
  return { liquids: seedLiquids(), error: "", ...overrides };
}

function liquid(overrides = {}) {
  return { name: "Gin", alcoholPercent: 40, ...overrides };
}

// Scenario: what a first visit shows.
function seedLiquids() {
  return [
    liquid({ name: "Gin", alcoholPercent: 40 }),
    liquid({ name: "Vodka", alcoholPercent: 40 }),
    liquid({ name: "Whisky", alcoholPercent: 40 }),
    liquid({ name: "Campari", alcoholPercent: 23 }),
    liquid({ name: "Sweet vermouth", alcoholPercent: 15 }),
    liquid({ name: "Dry vermouth", alcoholPercent: 18 }),
    liquid({ name: "Lager", alcoholPercent: 5 }),
    liquid({ name: "Light white wine", alcoholPercent: 11 }),
    liquid({ name: "White wine", alcoholPercent: 12.5 }),
    liquid({ name: "Red wine", alcoholPercent: 13.5 }),
    liquid({ name: "Full-bodied red", alcoholPercent: 14.5 }),
    liquid({ name: "Sparkling wine", alcoholPercent: 12 }),
    liquid({ name: "Port", alcoholPercent: 20 }),
    liquid({ name: "Soda water", alcoholPercent: 0 }),
    liquid({ name: "Lime juice", alcoholPercent: 0 }),
  ];
}

// Scenario: a stored catalogue in the exact shape localStorage holds.
function storedStores(liquids) {
  return { liquids, drinks: [], drinkLists: [] };
}

// --- Observer, driver, opener ---

function readCatalogue(page) {
  return page.evaluate(() => ({
    liquids: [...document.querySelectorAll("liquids-view tr[data-liquid]")].map((row) => ({
      name: row.querySelector(".name").textContent.trim(),
      alcoholPercent: parseFloat(row.querySelector(".alcohol-percent").textContent),
    })),
    error: document.querySelector("liquids-view .error")?.textContent.trim() ?? "",
  }));
}

async function addLiquid(page, { name, alcoholPercent }) {
  const form = page.locator("form.add-liquid");
  await form.locator("input[name=name]").fill(name);
  await form.locator("input[name=alcoholPercent]").fill(String(alcoholPercent));
  await form.locator("[type=submit], button:not([type])").first().click();
}

async function openCatalogue(page, { stored } = {}) {
  if (stored) {
    await page.addInitScript(
      ([key, value]) => {
        if (!sessionStorage.getItem("seeded")) {
          localStorage.setItem(key, value);
          sessionStorage.setItem("seeded", "yes");
        }
      },
      [STORAGE_KEY, JSON.stringify(stored)],
    );
  }
  await page.goto(PAGE);
}

// --- Tests ---

test.describe("opening the catalogue for the first time", () => {
  test("shows the seed liquids and no error", async ({ page }) => {
    await openCatalogue(page);
    await expect.poll(() => readCatalogue(page)).toEqual(catalogue());
  });
});

test.describe("adding a liquid", () => {
  test("shows it last in the list", async ({ page }) => {
    await openCatalogue(page);
    await addLiquid(page, { name: "Dark rum", alcoholPercent: 37.5 });
    await expect.poll(() => readCatalogue(page)).toEqual(
      catalogue({ liquids: [...seedLiquids(), liquid({ name: "Dark rum", alcoholPercent: 37.5 })] }),
    );
  });

  test("keeps it after the page is reloaded", async ({ page }) => {
    await openCatalogue(page);
    await addLiquid(page, { name: "Dark rum", alcoholPercent: 37.5 });
    await expect.poll(() => readCatalogue(page).then((c) => c.liquids.length)).toBe(16);
    await page.reload();
    await expect.poll(() => readCatalogue(page)).toEqual(
      catalogue({ liquids: [...seedLiquids(), liquid({ name: "Dark rum", alcoholPercent: 37.5 })] }),
    );
  });

  test("shows an error and leaves the list unchanged when the name exists in another casing", async ({ page }) => {
    await openCatalogue(page);
    await addLiquid(page, { name: "gin", alcoholPercent: 40 });
    await expect.poll(() => readCatalogue(page)).toEqual(
      catalogue({ error: 'A liquid named "Gin" already exists.' }),
    );
  });
});

test.describe("opening the catalogue with liquids already stored", () => {
  test("shows the stored liquids instead of the seed", async ({ page }) => {
    await openCatalogue(page, { stored: storedStores([liquid({ name: "Mead", alcoholPercent: 11 })]) });
    await expect.poll(() => readCatalogue(page)).toEqual(
      catalogue({ liquids: [liquid({ name: "Mead", alcoholPercent: 11 })] }),
    );
  });
});
