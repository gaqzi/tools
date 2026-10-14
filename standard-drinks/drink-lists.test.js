import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DrinkLists } from "./drink-lists.js";
import { UnknownDrinkError } from "./drinks.js";

// --- The state: the store's drink lists and how many times the service said it changed ---

function night(overrides = {}) {
  return { drinkLists: [friday(), saturday()], saves: 0, ...overrides };
}
function friday(overrides = {}) {
  return { name: "Friday", entries: [negroniEntry({ quantity: 2 }), lagerLargeEntry()], ...overrides };
}
function saturday(overrides = {}) {
  return { name: "Saturday", entries: [negroniEntry()], ...overrides };
}

// The default entry is one negroni.
function negroniEntry(overrides = {}) {
  return { drink: "Negroni", quantity: 1, ...overrides };
}
function lagerLargeEntry(overrides = {}) {
  return { drink: "Lager large", quantity: 1, ...overrides };
}
function martiniEntry(overrides = {}) {
  return { drink: "Martini", quantity: 1, ...overrides };
}

// --- What the mocked drinks service answers, per drink name ---

function negroniDrink(overrides = {}) {
  return { name: "Negroni", parts: [], ...overrides };
}
function lagerLargeDrink(overrides = {}) {
  return { name: "Lager large", parts: [], ...overrides };
}
function martiniDrink(overrides = {}) {
  return { name: "Martini", parts: [], ...overrides };
}

// What each mocked `drinks` method answers per argument. A value that is an
// Error is thrown. The figures are distinctive per drink so sums are traceable.
function answers(overrides = {}) {
  return {
    get: { Negroni: negroniDrink(), "Lager large": lagerLargeDrink(), Martini: martiniDrink() },
    amountOf: { Negroni: 135, "Lager large": 500 },
    alcoholOf: { Negroni: 35.1, "Lager large": 25 },
    ...overrides,
  };
}

// A plain object that answers each method only for the configured arguments
// and throws for anything else, so an unexpected lookup cannot go unnoticed.
function drinksMock(configured) {
  const method = (name) => (argument) => {
    const table = configured[name] ?? {};
    if (!(argument in table)) throw new Error(`unconfigured drinks.${name}(${JSON.stringify(argument)})`);
    if (table[argument] instanceof Error) throw table[argument];
    return typeof table[argument] === "object" ? { ...table[argument] } : table[argument];
  };
  return { get: method("get"), amountOf: method("amountOf"), alcoholOf: method("alcoholOf") };
}

// Builds the service over the night's lists and returns it with an observer of
// the whole state. `saves` is the changed callback's call
// count:"save exactly once per mutation, never for a read" has no other
// output, so the count is the only way to observe that contract.
function open(initial = night(), configured = answers()) {
  const store = structuredClone(initial.drinkLists);
  let saves = 0;
  const service = new DrinkLists(store, { drinks: drinksMock(configured), changed: () => (saves += 1) });
  return { service, read: () => ({ drinkLists: service.all(), saves }) };
}

// The figures of a list. Floating point makes the sums land a hair off, so
// they are rounded to one decimal here and the expectations stay literals.
function totals(overrides = {}) {
  return { amount: 770, alcohol: 95.2, ...overrides };
}
function round(number) {
  return Math.round(number * 10) / 10;
}
function measured(service, name) {
  return { amount: round(service.amountOf(name)), alcohol: round(service.alcoholOf(name)) };
}

// A refusal is one state: the error's name and the data it carries.
function refusal(fn) {
  const error = caught(fn);
  if (error === null) return "none";
  const fields = {
    error: error.constructor.name,
    drinkList: error.drinkList,
    drink: error.drink,
    message: error.message,
  };
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}
function unknownDrinkList(drinkList) {
  return { error: "UnknownDrinkListError", drinkList, message: `There is no drink list named "${drinkList}".` };
}
function duplicateDrinkList(drinkList) {
  return { error: "DuplicateDrinkListError", drinkList, message: `A drink list named "${drinkList}" already exists.` };
}
function unknownDrink(drink) {
  return { error: "UnknownDrinkError", drink, message: `There is no drink named "${drink}".` };
}
function nameless(drinkList) {
  return { error: "InvalidDrinkListError", drinkList, message: "A drink list needs a name." };
}
function badQuantity(drinkList) {
  return { error: "InvalidDrinkListError", drinkList, message: "The quantity must be a whole number, 1 or more." };
}
function alreadyHas(drinkList, drink) {
  return { error: "InvalidDrinkListError", drinkList, message: `${drinkList} already has ${drink}.` };
}
function hasNo(drinkList, drink) {
  return { error: "InvalidDrinkListError", drinkList, message: `${drinkList} has no ${drink}.` };
}

function caught(fn) {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return null;
}

describe("a fresh service over the stored drink lists", () => {
  it("lists them in insertion order without having saved anything", () => {
    const { read } = open();

    assert.deepEqual(read(), night());
  });
});

describe("reading drink lists", () => {
  it("finds a drink list by a trimmed, differently cased name", () => {
    const { service } = open();

    assert.deepEqual(service.get("  fRIDAY "), friday());
  });

  it("hands out deep copies, so changing one does not change the store", () => {
    const { service, read } = open();
    service.get("Friday").entries[0].quantity = 999;
    service.all()[1].entries.pop();
    service.all()[1].name = "Changed";

    assert.deepEqual(read(), night());
  });

  it("does not save", () => {
    const { service, read } = open();
    service.get("Friday");
    service.all();

    assert.equal(read().saves, 0);
  });

  it("refuses an unknown name, naming the trimmed drink list", () => {
    const { service } = open();

    assert.deepEqual(refusal(() => service.get(" Sunday ")), unknownDrinkList("Sunday"));
  });
});

describe("adding a drink list", () => {
  it("stores it with its name trimmed, the drinks' stored names and its entries in order, and saves once", () => {
    const { service, read } = open(
      night(),
      answers({ get: { " negroni": negroniDrink(), "lager LARGE ": lagerLargeDrink() } }),
    );
    service.add({
      name: "  Sunday ",
      entries: [{ drink: " negroni", quantity: 3 }, { drink: "lager LARGE ", quantity: 1 }],
    });

    assert.deepEqual(
      read(),
      night({ drinkLists: [friday(), saturday(), { name: "Sunday", entries: [negroniEntry({ quantity: 3 }), lagerLargeEntry()] }], saves: 1 }),
    );
  });

  it("stores a list given no entries as an empty list", () => {
    const { service, read } = open();
    service.add({ name: "Empty" });

    assert.deepEqual(read(), night({ drinkLists: [friday(), saturday(), { name: "Empty", entries: [] }], saves: 1 }));
  });

  it("returns a deep copy of what it stored", () => {
    const { service, read } = open();
    service.add({ name: "Sunday", entries: [martiniEntry()] }).entries[0].quantity = 99;

    assert.deepEqual(read().drinkLists[2], { name: "Sunday", entries: [martiniEntry()] });
  });

  it("refuses a name that exists, ignoring case and surrounding space, naming the existing drink list", () => {
    const { service } = open();

    assert.deepEqual(refusal(() => service.add({ name: " friday ", entries: [] })), duplicateDrinkList("Friday"));
  });

  it("leaves the store alone and does not save when it refuses a duplicate", () => {
    const { service, read } = open();
    const refused = refusal(() => service.add({ name: "friday", entries: [] }));

    assert.deepEqual({ ...read(), refused }, { ...night(), refused: duplicateDrinkList("Friday") });
  });

  const invalid = [
    { why: "an empty name", list: { name: "", entries: [] }, refused: nameless("") },
    { why: "a blank name", list: { name: "   ", entries: [] }, refused: nameless("   ") },
    { why: "a quantity of zero", list: { name: "Sunday", entries: [martiniEntry({ quantity: 0 })] }, refused: badQuantity("Sunday") },
    { why: "a negative quantity", list: { name: "Sunday", entries: [martiniEntry({ quantity: -1 })] }, refused: badQuantity("Sunday") },
    { why: "a quantity with a fraction", list: { name: "Sunday", entries: [martiniEntry({ quantity: 1.5 })] }, refused: badQuantity("Sunday") },
    { why: "a quantity that is not a number", list: { name: "Sunday", entries: [martiniEntry({ quantity: "2" })] }, refused: badQuantity("Sunday") },
    { why: "a quantity of NaN", list: { name: "Sunday", entries: [martiniEntry({ quantity: NaN })] }, refused: badQuantity("Sunday") },
    {
      why: "the same drink twice",
      list: { name: "Sunday", entries: [martiniEntry(), martiniEntry({ quantity: 2 })] },
      refused: alreadyHas("Sunday", "Martini"),
    },
  ];
  for (const { why, list, refused } of invalid) {
    it(`refuses ${why}`, () => {
      const { service } = open();

      assert.deepEqual(refusal(() => service.add(list)), refused);
    });
  }

  it("refuses the same drink twice when it is spelled differently", () => {
    const { service } = open(night(), answers({ get: { Martini: martiniDrink(), " martini": martiniDrink() } }));

    assert.deepEqual(
      refusal(() => service.add({ name: "Sunday", entries: [martiniEntry(), martiniEntry({ drink: " martini" })] })),
      alreadyHas("Sunday", "Martini"),
    );
  });

  it("does not save when it refuses an invalid drink list", () => {
    const { service, read } = open();
    const refused = refusal(() => service.add({ name: "Sunday", entries: [martiniEntry({ quantity: 0 })] }));

    assert.deepEqual({ ...read(), refused }, { ...night(), refused: badQuantity("Sunday") });
  });

  it("lets the drinks service's unknown drink error through unchanged", () => {
    const unknown = new UnknownDrinkError("Mojito");
    const { service } = open(night(), answers({ get: { Mojito: unknown } }));

    assert.equal(caught(() => service.add({ name: "Sunday", entries: [{ drink: "Mojito", quantity: 1 }] })), unknown);
  });

  it("stores nothing and does not save when a drink is unknown", () => {
    const { service, read } = open(night(), answers({ get: { Martini: martiniDrink(), Mojito: new UnknownDrinkError("Mojito") } }));
    const refused = refusal(() => service.add({ name: "Sunday", entries: [martiniEntry(), { drink: "Mojito", quantity: 1 }] }));

    assert.deepEqual({ ...read(), refused }, { ...night(), refused: unknownDrink("Mojito") });
  });
});

describe("renaming a drink list", () => {
  it("gives it the trimmed new name, keeps its place and saves once", () => {
    const { service, read } = open();
    service.rename("friday", "  Party ");

    assert.deepEqual(read(), night({ drinkLists: [friday({ name: "Party" }), saturday()], saves: 1 }));
  });

  it("returns a deep copy of the renamed drink list", () => {
    const { service } = open();

    assert.deepEqual(service.rename("Friday", "Party"), friday({ name: "Party" }));
  });

  it("allows a different casing of its own name", () => {
    const { service, read } = open();
    service.rename("Friday", "FRIDAY");

    assert.deepEqual(read(), night({ drinkLists: [friday({ name: "FRIDAY" }), saturday()], saves: 1 }));
  });

  it("refuses an unknown name, naming it", () => {
    const { service } = open();

    assert.deepEqual(refusal(() => service.rename("Sunday", "Party")), unknownDrinkList("Sunday"));
  });

  it("refuses a name another drink list has, naming the existing one", () => {
    const { service } = open();

    assert.deepEqual(refusal(() => service.rename("Friday", " SATURDAY")), duplicateDrinkList("Saturday"));
  });

  it("refuses a blank new name", () => {
    const { service } = open();

    assert.deepEqual(refusal(() => service.rename("Friday", "  ")), nameless("  "));
  });

  it("does not save when it refuses", () => {
    const { service, read } = open();
    const refused = refusal(() => service.rename("Friday", "saturday"));

    assert.deepEqual({ ...read(), refused }, { ...night(), refused: duplicateDrinkList("Saturday") });
  });
});

describe("removing a drink list", () => {
  it("takes it out of the store and saves once", () => {
    const { service, read } = open();
    service.remove(" FRIDAY");

    assert.deepEqual(read(), night({ drinkLists: [saturday()], saves: 1 }));
  });

  it("refuses an unknown name, naming it", () => {
    const { service } = open();

    assert.deepEqual(refusal(() => service.remove("Sunday")), unknownDrinkList("Sunday"));
  });

  it("does not save when it refuses", () => {
    const { service, read } = open();
    const refused = refusal(() => service.remove("Sunday"));

    assert.deepEqual({ ...read(), refused }, { ...night(), refused: unknownDrinkList("Sunday") });
  });
});

describe("adding an entry to a drink list", () => {
  it("appends it with the drink's stored name and saves once", () => {
    const { service, read } = open(night(), answers({ get: { "martini ": martiniDrink() } }));
    service.addEntry(" saturday", { drink: "martini ", quantity: 4 });

    assert.deepEqual(
      read(),
      night({ drinkLists: [friday(), saturday({ entries: [negroniEntry(), martiniEntry({ quantity: 4 })] })], saves: 1 }),
    );
  });

  it("returns a deep copy of the list as it now is", () => {
    const { service } = open();

    assert.deepEqual(
      service.addEntry("Saturday", martiniEntry()),
      saturday({ entries: [negroniEntry(), martiniEntry()] }),
    );
  });

  it("refuses an unknown drink list, naming it", () => {
    const { service } = open();

    assert.deepEqual(refusal(() => service.addEntry("Sunday", martiniEntry())), unknownDrinkList("Sunday"));
  });

  const invalid = [
    { why: "a quantity of zero", added: martiniEntry({ quantity: 0 }), refused: badQuantity("Saturday") },
    { why: "a negative quantity", added: martiniEntry({ quantity: -2 }), refused: badQuantity("Saturday") },
    { why: "a quantity with a fraction", added: martiniEntry({ quantity: 2.5 }), refused: badQuantity("Saturday") },
    { why: "a quantity that is not a number", added: martiniEntry({ quantity: "2" }), refused: badQuantity("Saturday") },
    { why: "a drink the list already has", added: negroniEntry({ quantity: 5 }), refused: alreadyHas("Saturday", "Negroni") },
  ];
  for (const { why, added, refused } of invalid) {
    it(`refuses ${why}`, () => {
      const { service } = open();

      assert.deepEqual(refusal(() => service.addEntry("Saturday", added)), refused);
    });
  }

  it("refuses a drink the list already has when it is spelled differently", () => {
    const { service } = open(night(), answers({ get: { " negroni": negroniDrink() } }));

    assert.deepEqual(
      refusal(() => service.addEntry("Saturday", { drink: " negroni", quantity: 1 })),
      alreadyHas("Saturday", "Negroni"),
    );
  });

  it("lets the drinks service's unknown drink error through unchanged", () => {
    const unknown = new UnknownDrinkError("Mojito");
    const { service } = open(night(), answers({ get: { Mojito: unknown } }));

    assert.equal(caught(() => service.addEntry("Saturday", { drink: "Mojito", quantity: 1 })), unknown);
  });

  it("changes nothing and does not save when it refuses", () => {
    const { service, read } = open();
    const refused = refusal(() => service.addEntry("Saturday", negroniEntry()));

    assert.deepEqual({ ...read(), refused }, { ...night(), refused: alreadyHas("Saturday", "Negroni") });
  });
});

describe("removing an entry from a drink list", () => {
  it("takes out the entry whose drink matches a trimmed, differently cased name, and saves once", () => {
    const { service, read } = open(night(), {});
    service.removeEntry("friday", "  nEGRONI ");

    assert.deepEqual(read(), night({ drinkLists: [friday({ entries: [lagerLargeEntry()] }), saturday()], saves: 1 }));
  });

  it("returns a deep copy of the list without the entry", () => {
    const { service } = open(night(), {});

    assert.deepEqual(service.removeEntry("Friday", "Lager large"), friday({ entries: [negroniEntry({ quantity: 2 })] }));
  });

  it("refuses a drink that is not in the list", () => {
    const { service } = open(night(), {});

    assert.deepEqual(refusal(() => service.removeEntry("Saturday", "Martini")), hasNo("Saturday", "Martini"));
  });

  it("refuses an unknown drink list, naming it", () => {
    const { service } = open(night(), {});

    assert.deepEqual(refusal(() => service.removeEntry("Sunday", "Negroni")), unknownDrinkList("Sunday"));
  });

  it("changes nothing and does not save when it refuses", () => {
    const { service, read } = open(night(), {});
    const refused = refusal(() => service.removeEntry("Saturday", "Martini"));

    assert.deepEqual({ ...read(), refused }, { ...night(), refused: hasNo("Saturday", "Martini") });
  });
});

describe("computing the totals of a drink list from its drinks", () => {
  it("sums two negronis and a large lager at 770 ml and 95.2 ml of alcohol", () => {
    const { service } = open();

    assert.deepEqual(measured(service, "Friday"), totals());
  });

  it("sums a single negroni at 135 ml and 35.1 ml of alcohol", () => {
    const { service } = open();

    assert.deepEqual(measured(service, "Saturday"), totals({ amount: 135, alcohol: 35.1 }));
  });

  it("totals a list with no entries at 0 ml and 0 ml of alcohol", () => {
    const { service } = open(night({ drinkLists: [{ name: "Empty", entries: [] }] }), {});

    assert.deepEqual(measured(service, "Empty"), totals({ amount: 0, alcohol: 0 }));
  });

  it("lets an unknown drink error from the drinks service through", () => {
    const unknown = new UnknownDrinkError("Negroni");
    const { service } = open(night(), answers({ alcoholOf: { Negroni: unknown, "Lager large": 25 } }));

    assert.equal(caught(() => service.alcoholOf("Friday")), unknown);
  });

  it("does not save", () => {
    const { service, read } = open();
    measured(service, "Friday");

    assert.equal(read().saves, 0);
  });

  for (const method of ["amountOf", "alcoholOf", "alcoholPercentOf"]) {
    it(`${method} refuses an unknown drink list`, () => {
      const { service } = open();

      assert.deepEqual(refusal(() => service[method]("Sunday")), unknownDrinkList("Sunday"));
    });
  }
});

describe("computing the alcohol percentage of a drink list", () => {
  it("puts two negronis and a large lager at 12.4 %", () => {
    const { service } = open();

    assert.equal(round(service.alcoholPercentOf("Friday")), 12.4);
  });

  it("puts a list with no entries at 0 %", () => {
    const { service } = open(night({ drinkLists: [{ name: "Empty", entries: [] }] }), {});

    assert.equal(service.alcoholPercentOf("Empty"), 0);
  });
});

describe("being a referrer of drinks", () => {
  const uses = [
    { name: "a drink in two lists", drink: "Negroni", want: ["Friday", "Saturday"] },
    { name: "a drink in one list", drink: "Lager large", want: ["Friday"] },
    { name: "a drink named in another case", drink: " lager LARGE ", want: ["Friday"] },
    { name: "a drink no list has", drink: "Martini", want: [] },
  ];
  for (const { name, drink, want } of uses) {
    it(`names the drink lists using ${name}, in store order`, () => {
      const { service } = open(night(), {});

      assert.deepEqual(service.usesOf(drink), want);
    });
  }

  it("rewrites the drink of every entry that uses the old name, without saving", () => {
    const { service, read } = open(night(), {});
    service.relabel("Negroni", "Boulevardier");

    assert.deepEqual(
      read(),
      night({
        drinkLists: [
          friday({ entries: [negroniEntry({ drink: "Boulevardier", quantity: 2 }), lagerLargeEntry()] }),
          saturday({ entries: [negroniEntry({ drink: "Boulevardier" })] }),
        ],
      }),
    );
  });

  it("leaves lists that do not use the old name as they were", () => {
    const { service, read } = open(night(), {});
    service.relabel("Lager large", "Lager pint");

    assert.deepEqual(
      read(),
      night({ drinkLists: [friday({ entries: [negroniEntry({ quantity: 2 }), lagerLargeEntry({ drink: "Lager pint" })] }), saturday()] }),
    );
  });
});
