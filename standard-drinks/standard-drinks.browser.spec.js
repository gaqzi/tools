// Browser spec for the standard-drinks tool, rounds 1 and 2: liquids, then drinks with figures.
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
// wiring and the liquid-to-drink references in catalogue.test.js; the
// arithmetic in alcohol.test.js; drink rules in drinks.test.js. This file stays small on purpose.
import { test, expect } from "@playwright/test";

const PAGE = "/standard-drinks/";
const STORAGE_KEY = "standard-drinks";

// --- The catalogue state ---

function catalogue(overrides = {}) {
  return { liquids: seedLiquids(), drinks: [], error: "", drinksError: "", ...overrides };
}

// Scenario: the negroni as the page shows it, parts as one text.
function drink(overrides = {}) {
  return {
    name: "Negroni",
    parts: "Campari 45 ml, Gin 45 ml, Sweet vermouth 45 ml",
    amount: 135,
    alcoholPercent: 26,
    alcohol: 35.1,
    standardDrinks: 2.3,
    ...overrides,
  };
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
function storedStores(liquids, drinks = []) {
  return { liquids, drinks, drinkLists: [] };
}

// Scenario: the negroni in the exact shape localStorage holds.
function storedNegroni() {
  return {
    name: "Negroni",
    parts: [
      { liquid: "Campari", amount: 45 },
      { liquid: "Gin", amount: 45 },
      { liquid: "Sweet vermouth", amount: 45 },
    ],
  };
}

// --- Observer, driver, opener ---

function readCatalogue(page) {
  return page.evaluate(() => ({
    liquids: [...document.querySelectorAll("liquids-view tr[data-liquid]")].map((row) => ({
      name: row.querySelector(".name").textContent.trim(),
      alcoholPercent: parseFloat(row.querySelector(".alcohol-percent").textContent),
    })),
    drinks: [...document.querySelectorAll("drinks-view tr[data-drink]")].map((row) => {
      const text = (selector) => row.querySelector(selector).textContent.trim();
      return {
        name: text(".name"),
        parts: text(".parts"),
        amount: parseFloat(text(".amount")),
        alcoholPercent: parseFloat(text(".alcohol-percent")),
        alcohol: parseFloat(text(".alcohol")),
        standardDrinks: parseFloat(text(".standard-drinks")),
      };
    }),
    error: document.querySelector("liquids-view .error")?.textContent.trim() ?? "",
    drinksError: document.querySelector("drinks-view .error")?.textContent.trim() ?? "",
  }));
}

async function addLiquid(page, { name, alcoholPercent }) {
  const form = page.locator("form.add-liquid");
  await form.locator("input[name=name]").fill(name);
  await form.locator("input[name=alcoholPercent]").fill(String(alcoholPercent));
  await form.locator("[type=submit], button:not([type])").first().click();
}

async function addDrink(page, name) {
  const form = page.locator("form.add-drink");
  await form.locator("input[name=name]").fill(name);
  await form.locator("[type=submit], button:not([type])").first().click();
}

async function addPart(page, drinkName, { liquid, amount }) {
  const form = page.locator(`tr[data-drink="${drinkName}"] form.add-part`);
  await form.locator("select[name=liquid]").selectOption({ label: liquid });
  await form.locator("input[name=amount]").fill(String(amount));
  await form.locator("[type=submit], button:not([type])").first().click();
}

async function removeLiquid(page, name) {
  await page.locator(`liquids-view tr[data-liquid="${name}"] button.remove`).click();
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

test.describe("composing a drink", () => {
  test("shows a negroni built from three parts with its figures", async ({ page }) => {
    await openCatalogue(page);
    await addDrink(page, "Negroni");
    await addPart(page, "Negroni", { liquid: "Campari", amount: 45 });
    await addPart(page, "Negroni", { liquid: "Gin", amount: 45 });
    await addPart(page, "Negroni", { liquid: "Sweet vermouth", amount: 45 });
    await expect.poll(() => readCatalogue(page)).toEqual(catalogue({ drinks: [drink()] }));
  });
});

test.describe("opening the catalogue with a drink already stored", () => {
  test("shows the stored drink with its figures", async ({ page }) => {
    await openCatalogue(page, { stored: storedStores(seedLiquids(), [storedNegroni()]) });
    await expect.poll(() => readCatalogue(page)).toEqual(catalogue({ drinks: [drink()] }));
  });
});

test.describe("removing a liquid", () => {
  test("shows who uses it and leaves both lists unchanged when a drink uses it", async ({ page }) => {
    await openCatalogue(page, { stored: storedStores(seedLiquids(), [storedNegroni()]) });
    await removeLiquid(page, "Gin");
    await expect.poll(() => readCatalogue(page)).toEqual(
      catalogue({ drinks: [drink()], error: '"Gin" is used by Negroni.' }),
    );
  });

  test("takes it out of the list when no drink uses it", async ({ page }) => {
    await openCatalogue(page);
    await removeLiquid(page, "Vodka");
    await expect.poll(() => readCatalogue(page)).toEqual(
      catalogue({ liquids: seedLiquids().filter((candidate) => candidate.name !== "Vodka") }),
    );
  });
});
