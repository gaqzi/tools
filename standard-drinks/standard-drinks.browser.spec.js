// Browser spec for the standard-drinks tool, rounds 1 to 4: liquids, drinks with figures, drink lists, then the setting, the file and editing a liquid.
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
  return {
    liquids: seedLiquids(),
    drinks: [],
    drinkLists: [],
    error: "",
    drinksError: "",
    drinkListsError: "",
    gramsPerStandardDrink: 12,
    fileError: "",
    ...overrides,
  };
}

// Scenario: the negroni as the page shows it, parts as one text.
function drink(overrides = {}) {
  return {
    name: "Negroni",
    parts: "Campari 45 ml, Gin 45 ml, Sweet vermouth 45 ml",
    amount: 135,
    alcoholPercent: 26.7,
    alcohol: 36,
    standardDrinks: 2.4,
    ...overrides,
  };
}

// Scenario: the large lager as the page shows it.
function lagerLarge(overrides = {}) {
  return drink({
    name: "Lager large",
    parts: "Lager 500 ml",
    amount: 500,
    alcoholPercent: 5,
    alcohol: 25,
    standardDrinks: 1.6,
    ...overrides,
  });
}

// Scenario: Friday as the page shows it, two negronis and a large lager.
function drinkList(overrides = {}) {
  return {
    name: "Friday",
    entries: "2 × Negroni, 1 × Lager large",
    amount: 770,
    alcoholPercent: 12.6,
    alcohol: 97,
    standardDrinks: 6.4,
    hoursToClear: 6.4,
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
    liquid({ name: "Campari", alcoholPercent: 25 }),
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
function storedStores(liquids, drinks = [], drinkLists = []) {
  return { liquids, drinks, drinkLists };
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

// Scenario: the large lager in the exact shape localStorage holds.
function storedLagerLarge() {
  return { name: "Lager large", parts: [{ liquid: "Lager", amount: 500 }] };
}

// Scenario: Friday in the exact shape localStorage holds.
function storedFriday() {
  return {
    name: "Friday",
    entries: [
      { drink: "Negroni", quantity: 2 },
      { drink: "Lager large", quantity: 1 },
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
    drinkLists: [...document.querySelectorAll("drink-lists-view tr[data-drink-list]")].map((row) => {
      const text = (selector) => row.querySelector(selector).textContent.trim();
      return {
        name: text(".name"),
        entries: text(".entries"),
        amount: parseFloat(text(".amount")),
        alcoholPercent: parseFloat(text(".alcohol-percent")),
        alcohol: parseFloat(text(".alcohol")),
        standardDrinks: parseFloat(text(".standard-drinks")),
        hoursToClear: parseFloat(text(".hours-to-clear")),
      };
    }),
    error: document.querySelector("liquids-view .error")?.textContent.trim() ?? "",
    drinksError: document.querySelector("drinks-view .error")?.textContent.trim() ?? "",
    drinkListsError: document.querySelector("drink-lists-view .error")?.textContent.trim() ?? "",
    gramsPerStandardDrink: parseFloat(document.querySelector("catalogue-settings input[name=gramsPerStandardDrink]")?.value),
    fileError: document.querySelector("catalogue-file .error")?.textContent.trim() ?? "",
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

async function addDrinkList(page, name) {
  const form = page.locator("form.add-drink-list");
  await form.locator("input[name=name]").fill(name);
  await form.locator("[type=submit], button:not([type])").first().click();
}

async function addEntry(page, listName, { drink, quantity }) {
  const form = page.locator(`tr[data-drink-list="${listName}"] form.add-entry`);
  await form.locator("select[name=drink]").selectOption({ label: drink });
  await form.locator("input[name=quantity]").fill(String(quantity));
  await form.locator("[type=submit], button:not([type])").first().click();
}

async function removeDrink(page, name) {
  await page.locator(`drinks-view tr[data-drink="${name}"] button.remove`).click();
}

async function removeLiquid(page, name) {
  await page.locator(`liquids-view tr[data-liquid="${name}"] button.remove`).click();
}

async function setGramsPerStandardDrink(page, grams) {
  const input = page.locator("catalogue-settings input[name=gramsPerStandardDrink]");
  await input.fill(String(grams));
  await input.blur();
}

async function editLiquid(page, name, { name: newName, alcoholPercent }) {
  const form = page.locator(`liquids-view tr[data-liquid="${name}"] form.edit-liquid`);
  await form.locator("input[name=name]").fill(newName);
  await form.locator("input[name=alcoholPercent]").fill(String(alcoholPercent));
  await form.getByRole("button", { name: "Save" }).click();
}

// Clicks export and returns the downloaded file name and its text.
async function exportCatalogue(page) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("catalogue-file button.export").click(),
  ]);
  const chunks = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  return { filename: download.suggestedFilename(), contents: Buffer.concat(chunks).toString("utf8") };
}

async function importCatalogue(page, text) {
  await page.locator("catalogue-file input[type=file].import").setInputFiles({
    name: "standard-drinks.json",
    mimeType: "application/json",
    buffer: Buffer.from(text),
  });
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

test.describe("composing a drink list", () => {
  test("shows a list of two negronis and a large lager with its totals", async ({ page }) => {
    await openCatalogue(page, { stored: storedStores(seedLiquids(), [storedNegroni(), storedLagerLarge()]) });
    await addDrinkList(page, "Friday");
    await addEntry(page, "Friday", { drink: "Negroni", quantity: 2 });
    await addEntry(page, "Friday", { drink: "Lager large", quantity: 1 });
    await expect.poll(() => readCatalogue(page)).toEqual(
      catalogue({ drinks: [drink(), lagerLarge()], drinkLists: [drinkList()] }),
    );
  });
});

test.describe("opening the catalogue with a drink list already stored", () => {
  test("shows the stored list with its totals", async ({ page }) => {
    await openCatalogue(page, {
      stored: storedStores(seedLiquids(), [storedNegroni(), storedLagerLarge()], [storedFriday()]),
    });
    await expect.poll(() => readCatalogue(page)).toEqual(
      catalogue({ drinks: [drink(), lagerLarge()], drinkLists: [drinkList()] }),
    );
  });
});

test.describe("removing a drink", () => {
  test("shows which list uses it and leaves the drinks and lists unchanged", async ({ page }) => {
    await openCatalogue(page, {
      stored: storedStores(seedLiquids(), [storedNegroni(), storedLagerLarge()], [storedFriday()]),
    });
    await removeDrink(page, "Negroni");
    await expect.poll(() => readCatalogue(page)).toEqual(
      catalogue({
        drinks: [drink(), lagerLarge()],
        drinkLists: [drinkList()],
        drinksError: '"Negroni" is used by Friday.',
      }),
    );
  });
});

test.describe("the standard drink setting", () => {
  test("counts 10 grams of alcohol to a standard drink", async ({ page }) => {
    await openCatalogue(page, { stored: storedStores(seedLiquids(), [storedNegroni()]) });
    await setGramsPerStandardDrink(page, 10);
    await expect.poll(() => readCatalogue(page)).toEqual(
      catalogue({ drinks: [drink({ standardDrinks: 2.8 })], gramsPerStandardDrink: 10 }),
    );
  });

  test("is kept after the page is reloaded", async ({ page }) => {
    await openCatalogue(page, { stored: storedStores(seedLiquids(), [storedNegroni()]) });
    await setGramsPerStandardDrink(page, 10);
    await expect.poll(() => readCatalogue(page).then((c) => c.drinks[0].standardDrinks)).toBe(2.8);
    await page.reload();
    await expect.poll(() => readCatalogue(page)).toEqual(
      catalogue({ drinks: [drink({ standardDrinks: 2.8 })], gramsPerStandardDrink: 10 }),
    );
  });
});

test.describe("exporting the catalogue", () => {
  // A download is an action's result, not page state that settles, so this
  // compares once with expect instead of expect.poll.
  test("downloads standard-drinks.json holding the stored catalogue", async ({ page }) => {
    const stored = storedStores(seedLiquids(), [storedNegroni()]);
    await openCatalogue(page, { stored });
    const { filename, contents } = await exportCatalogue(page);
    expect({ filename, stores: JSON.parse(contents) }).toEqual({ filename: "standard-drinks.json", stores: stored });
  });
});

test.describe("importing a catalogue", () => {
  test("replaces the liquids, drinks and drink lists", async ({ page }) => {
    await openCatalogue(page);
    const imported = storedStores(
      [liquid({ name: "Gin", alcoholPercent: 40 }), liquid({ name: "Campari", alcoholPercent: 25 }), liquid({ name: "Sweet vermouth", alcoholPercent: 15 }), liquid({ name: "Lager", alcoholPercent: 5 })],
      [storedNegroni(), storedLagerLarge()],
      [storedFriday()],
    );
    await importCatalogue(page, JSON.stringify(imported));
    await expect.poll(() => readCatalogue(page)).toEqual(
      catalogue({
        liquids: [liquid({ name: "Gin", alcoholPercent: 40 }), liquid({ name: "Campari", alcoholPercent: 25 }), liquid({ name: "Sweet vermouth", alcoholPercent: 15 }), liquid({ name: "Lager", alcoholPercent: 5 })],
        drinks: [drink(), lagerLarge()],
        drinkLists: [drinkList()],
      }),
    );
  });

  test("shows the dangling reference and leaves the catalogue unchanged when a drink uses an unknown liquid", async ({ page }) => {
    await openCatalogue(page, { stored: storedStores(seedLiquids(), [storedNegroni()]) });
    const withoutCampari = seedLiquids().filter((candidate) => candidate.name !== "Campari");
    await importCatalogue(page, JSON.stringify(storedStores(withoutCampari, [storedNegroni()])));
    await expect.poll(() => readCatalogue(page)).toEqual(
      catalogue({ drinks: [drink()], fileError: 'Drink "Negroni" uses an unknown liquid "Campari".' }),
    );
  });
});

test.describe("editing a liquid", () => {
  test("shows an error and leaves the list unchanged when renamed to an existing name", async ({ page }) => {
    await openCatalogue(page);
    await editLiquid(page, "Gin", { name: "Campari", alcoholPercent: 40 });
    await expect.poll(() => readCatalogue(page)).toEqual(
      catalogue({ error: 'A liquid named "Campari" already exists.' }),
    );
  });

  test("changes the figures of a drink that uses it when its percentage changes", async ({ page }) => {
    await openCatalogue(page, { stored: storedStores(seedLiquids(), [storedLagerLarge()]) });
    await editLiquid(page, "Lager", { name: "Lager", alcoholPercent: 8 });
    await expect.poll(() => readCatalogue(page)).toEqual(
      catalogue({
        liquids: [...seedLiquids().slice(0, 6), liquid({ name: "Lager", alcoholPercent: 8 }), ...seedLiquids().slice(7)],
        drinks: [lagerLarge({ alcoholPercent: 8, alcohol: 40, standardDrinks: 2.6 })],
      }),
    );
  });
});
