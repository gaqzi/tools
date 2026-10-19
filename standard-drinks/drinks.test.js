import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Drinks } from "./drinks.js";
import { UnknownLiquidError } from "./liquids.js";
import { InUseError } from "./references.js";

// --- The state: the store's drinks and how many times the service said it changed ---

function bar(overrides = {}) {
  return { drinks: [negroni(), martini()], saves: 0, ...overrides };
}
function negroni(overrides = {}) {
  return { name: "Negroni", parts: [campariPart(), part(), sweetVermouthPart()], ...overrides };
}
function martini(overrides = {}) {
  return { name: "Martini", parts: [part({ amount: 60 }), dryVermouthPart()], ...overrides };
}
function gimlet(overrides = {}) {
  return { name: "Gimlet", parts: [part({ amount: 60 }), limeJuicePart()], ...overrides };
}

// The default part is 45 ml of gin.
function part(overrides = {}) {
  return { liquid: "Gin", amount: 45, ...overrides };
}
function campariPart(overrides = {}) {
  return part({ liquid: "Campari", ...overrides });
}
function sweetVermouthPart(overrides = {}) {
  return part({ liquid: "Sweet vermouth", ...overrides });
}
function dryVermouthPart(overrides = {}) {
  return part({ liquid: "Dry vermouth", amount: 10, ...overrides });
}
function limeJuicePart(overrides = {}) {
  return part({ liquid: "Lime juice", amount: 15, ...overrides });
}

// --- What the mocked liquids service answers ---

function ginLiquid(overrides = {}) {
  return { name: "Gin", alcoholPercent: 40, ...overrides };
}
function campariLiquid(overrides = {}) {
  return { name: "Campari", alcoholPercent: 23, ...overrides };
}
function sweetVermouthLiquid(overrides = {}) {
  return { name: "Sweet vermouth", alcoholPercent: 15, ...overrides };
}
function dryVermouthLiquid(overrides = {}) {
  return { name: "Dry vermouth", alcoholPercent: 18, ...overrides };
}
function limeJuiceLiquid(overrides = {}) {
  return { name: "Lime juice", alcoholPercent: 0, ...overrides };
}

// What `liquids.get` answers per argument. A value that is an Error is thrown.
function answers(overrides = {}) {
  return {
    Gin: ginLiquid(),
    Campari: campariLiquid(),
    "Sweet vermouth": sweetVermouthLiquid(),
    "Dry vermouth": dryVermouthLiquid(),
    "Lime juice": limeJuiceLiquid(),
    ...overrides,
  };
}

// A plain object that answers `get` only for the configured arguments and
// throws for anything else, so an unexpected lookup cannot go unnoticed.
function liquidsMock(configured) {
  return {
    get(name) {
      if (!(name in configured)) throw new Error(`unconfigured liquids.get(${JSON.stringify(name)})`);
      if (configured[name] instanceof Error) throw configured[name];
      return { ...configured[name] };
    },
  };
}

// Builds the service over the bar's drinks and returns it with an observer of
// the whole state. `saves` is read from the changed callback's call count:
// "save exactly once per mutation, never for a read" has no other output, so
// the count is the only way to observe that contract.
function open(initial = bar(), configured = answers(), { referrers = [] } = {}) {
  const store = structuredClone(initial.drinks);
  let saves = 0;
  const service = new Drinks(store, { liquids: liquidsMock(configured), changed: () => (saves += 1) });
  for (const referrer of referrers) service.referredToBy(referrer);
  return { service, read: () => ({ drinks: service.all(), saves }) };
}

// The figures of a drink. Floating point makes the sums land a hair off, so
// they are rounded to one decimal here and the expectations stay literals.
function measure(overrides = {}) {
  return { amount: 135, alcoholPercent: 26, alcohol: 35.1, ...overrides };
}
function round(number) {
  return Math.round(number * 10) / 10;
}
function measured(service, name) {
  return {
    amount: round(service.amountOf(name)),
    alcoholPercent: round(service.alcoholPercentOf(name)),
    alcohol: round(service.alcoholOf(name)),
  };
}

// A refusal is one state: the error's name and the data it carries. The
// message is left out for InUseError because references.test.js pins it.
function refusal(fn) {
  const error = caught(fn);
  if (error === null) return "none";
  const fields = {
    error: error.constructor.name,
    drink: error.drink,
    liquid: error.liquid,
    item: error.item,
    users: error.users,
    message: error instanceof InUseError ? undefined : error.message,
  };
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}
function unknownDrink(drink) {
  return { error: "UnknownDrinkError", drink, message: `There is no drink named "${drink}".` };
}
function duplicateDrink(drink) {
  return { error: "DuplicateDrinkError", drink, message: `A drink named "${drink}" already exists.` };
}
function unknownLiquid(liquid) {
  return { error: "UnknownLiquidError", liquid, message: `There is no liquid named "${liquid}".` };
}
function nameless(drink) {
  return { error: "InvalidDrinkError", drink, message: "A drink needs a name." };
}
function badAmount(drink) {
  return { error: "InvalidDrinkError", drink, message: "The amount must be a number of millilitres above 0." };
}
function alreadyHas(drink, liquid) {
  return { error: "InvalidDrinkError", drink, message: `${drink} already has ${liquid}.` };
}
function hasNo(drink, liquid) {
  return { error: "InvalidDrinkError", drink, message: `${drink} has no ${liquid}.` };
}
function inUse({ item, users }) {
  return { error: "InUseError", item, users };
}

function caught(fn) {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return null;
}

describe("a fresh service over the stored drinks", () => {
  it("lists them in insertion order without having saved anything", () => {
    const { read } = open();

    assert.deepEqual(read(), bar());
  });
});

describe("reading drinks", () => {
  it("finds a drink by a trimmed, differently cased name", () => {
    const { service } = open();

    assert.deepEqual(service.get("  nEGRONI "), negroni());
  });

  it("hands out deep copies, so changing one does not change the store", () => {
    const { service, read } = open();
    service.get("Negroni").parts[0].amount = 999;
    service.all()[1].parts.pop();
    service.all()[1].name = "Changed";

    assert.deepEqual(read(), bar());
  });

  it("does not save", () => {
    const { service, read } = open();
    service.get("Negroni");
    service.all();

    assert.equal(read().saves, 0);
  });

  it("refuses an unknown name, naming the trimmed drink", () => {
    const { service } = open();

    assert.deepEqual(refusal(() => service.get(" Mojito ")), unknownDrink("Mojito"));
  });
});

describe("adding a drink", () => {
  it("stores it with its name trimmed, the liquids' stored names and its parts in order, and saves once", () => {
    const { service, read } = open(bar(), answers({ " gin": ginLiquid(), "lime JUICE ": limeJuiceLiquid() }));
    service.add({
      name: "  Gimlet ",
      parts: [{ liquid: " gin", amount: 60 }, { liquid: "lime JUICE ", amount: 15 }],
    });

    assert.deepEqual(read(), bar({ drinks: [negroni(), martini(), gimlet()], saves: 1 }));
  });

  it("stores a drink given no parts as an empty drink", () => {
    const { service, read } = open();
    service.add({ name: "Empty" });

    assert.deepEqual(read(), bar({ drinks: [negroni(), martini(), { name: "Empty", parts: [] }], saves: 1 }));
  });

  it("returns a deep copy of what it stored", () => {
    const { service, read } = open();
    service.add({ name: "Gimlet", parts: [part({ amount: 60 }), limeJuicePart()] }).parts[0].amount = 1;

    assert.deepEqual(read().drinks[2], gimlet());
  });

  it("refuses a name that exists, ignoring case and surrounding space, naming the existing drink", () => {
    const { service } = open();

    assert.deepEqual(refusal(() => service.add({ name: " negroni ", parts: [] })), duplicateDrink("Negroni"));
  });

  it("leaves the store alone and does not save when it refuses a duplicate", () => {
    const { service, read } = open();
    const refused = refusal(() => service.add({ name: "negroni", parts: [] }));

    assert.deepEqual({ ...read(), refused }, { ...bar(), refused: duplicateDrink("Negroni") });
  });

  const invalid = [
    { why: "an empty name", drink: { name: "", parts: [] }, refused: nameless("") },
    { why: "a blank name", drink: { name: "   ", parts: [] }, refused: nameless("   ") },
    { why: "an amount of zero", drink: { name: "Gimlet", parts: [part({ amount: 0 })] }, refused: badAmount("Gimlet") },
    { why: "a negative amount", drink: { name: "Gimlet", parts: [part({ amount: -5 })] }, refused: badAmount("Gimlet") },
    { why: "an amount that is not a number", drink: { name: "Gimlet", parts: [part({ amount: "45" })] }, refused: badAmount("Gimlet") },
    { why: "an amount of NaN", drink: { name: "Gimlet", parts: [part({ amount: NaN })] }, refused: badAmount("Gimlet") },
    { why: "the same liquid twice", drink: { name: "Gimlet", parts: [part(), part({ amount: 10 })] }, refused: alreadyHas("Gimlet", "Gin") },
  ];
  for (const { why, drink, refused } of invalid) {
    it(`refuses ${why}`, () => {
      const { service } = open();

      assert.deepEqual(refusal(() => service.add(drink)), refused);
    });
  }

  it("refuses the same liquid twice when it is spelled differently", () => {
    const { service } = open(bar(), answers({ " gin": ginLiquid() }));

    assert.deepEqual(
      refusal(() => service.add({ name: "Gimlet", parts: [part(), part({ liquid: " gin" })] })),
      alreadyHas("Gimlet", "Gin"),
    );
  });

  it("does not save when it refuses an invalid drink", () => {
    const { service, read } = open();
    const refused = refusal(() => service.add({ name: "Gimlet", parts: [part({ amount: 0 })] }));

    assert.deepEqual({ ...read(), refused }, { ...bar(), refused: badAmount("Gimlet") });
  });

  it("lets the liquids service's unknown liquid error through unchanged", () => {
    const unknown = new UnknownLiquidError("Rum");
    const { service } = open(bar(), answers({ Rum: unknown }));

    assert.equal(caught(() => service.add({ name: "Daiquiri", parts: [part({ liquid: "Rum" })] })), unknown);
  });

  it("stores nothing and does not save when a liquid is unknown", () => {
    const { service, read } = open(bar(), answers({ Rum: new UnknownLiquidError("Rum") }));
    const refused = refusal(() => service.add({ name: "Daiquiri", parts: [part(), part({ liquid: "Rum" })] }));

    assert.deepEqual({ ...read(), refused }, { ...bar(), refused: unknownLiquid("Rum") });
  });
});

describe("updating a drink's name", () => {
  it("gives it the trimmed new name, keeps its place and saves once", () => {
    const { service, read } = open();
    service.update("negroni", { name: "  Boulevardier " });

    assert.deepEqual(read(), bar({ drinks: [negroni({ name: "Boulevardier" }), martini()], saves: 1 }));
  });

  it("returns a deep copy of the drink under its new name", () => {
    const { service } = open();

    assert.deepEqual(service.update("Negroni", { name: "Boulevardier" }), negroni({ name: "Boulevardier" }));
  });

  it("allows a different casing of its own name", () => {
    const { service, read } = open();
    service.update("Negroni", { name: "NEGRONI" });

    assert.deepEqual(read(), bar({ drinks: [negroni({ name: "NEGRONI" }), martini()], saves: 1 }));
  });

  it("refuses an unknown name, naming it", () => {
    const { service } = open();

    assert.deepEqual(refusal(() => service.update("Mojito", { name: "Daiquiri" })), unknownDrink("Mojito"));
  });

  it("refuses a name another drink has, naming the existing one", () => {
    const { service } = open();

    assert.deepEqual(refusal(() => service.update("Negroni", { name: " MARTINI" })), duplicateDrink("Martini"));
  });

  it("refuses a blank new name", () => {
    const { service } = open();

    assert.deepEqual(refusal(() => service.update("Negroni", { name: "  " })), nameless("  "));
  });

  it("does not save when it refuses", () => {
    const { service, read } = open();
    const refused = refusal(() => service.update("Negroni", { name: "martini" }));

    assert.deepEqual({ ...read(), refused }, { ...bar(), refused: duplicateDrink("Martini") });
  });
});

describe("the public surface of the drinks service", () => {
  it("is add, addPart, alcoholOf, alcoholPercentOf, all, amountOf, get, referredToBy, relabel, remove, removePart, update and usesOf", () => {
    const surface = Object.getOwnPropertyNames(Drinks.prototype).filter((n) => n !== "constructor").sort();

    assert.deepEqual(surface, ["add", "addPart", "alcoholOf", "alcoholPercentOf", "all", "amountOf", "get", "referredToBy", "relabel", "remove", "removePart", "update", "usesOf"]);
  });
});

describe("removing a drink", () => {
  it("takes it out of the store and saves once", () => {
    const { service, read } = open();
    service.remove(" NEGRONI");

    assert.deepEqual(read(), bar({ drinks: [martini()], saves: 1 }));
  });

  it("refuses an unknown name, naming it", () => {
    const { service } = open();

    assert.deepEqual(refusal(() => service.remove("Mojito")), unknownDrink("Mojito"));
  });

  it("does not save when it refuses", () => {
    const { service, read } = open();
    const refused = refusal(() => service.remove("Mojito"));

    assert.deepEqual({ ...read(), refused }, { ...bar(), refused: unknownDrink("Mojito") });
  });
});

describe("adding a part to a drink", () => {
  it("appends it with the liquid's stored name and saves once", () => {
    const { service, read } = open(bar(), answers({ "lime juice": limeJuiceLiquid() }));
    service.addPart(" martini", { liquid: "lime juice", amount: 15 });

    assert.deepEqual(
      read(),
      bar({ drinks: [negroni(), martini({ parts: [part({ amount: 60 }), dryVermouthPart(), limeJuicePart()] })], saves: 1 }),
    );
  });

  it("returns a deep copy of the drink with the part", () => {
    const { service, read } = open();
    const returned = service.addPart("Martini", limeJuicePart());
    returned.parts[0].amount = 1;

    assert.deepEqual(read().drinks[1].parts[0], part({ amount: 60 }));
  });

  it("returns the drink as it now is", () => {
    const { service } = open();

    assert.deepEqual(
      service.addPart("Martini", limeJuicePart()),
      martini({ parts: [part({ amount: 60 }), dryVermouthPart(), limeJuicePart()] }),
    );
  });

  it("refuses an unknown drink, naming it", () => {
    const { service } = open();

    assert.deepEqual(refusal(() => service.addPart("Mojito", limeJuicePart())), unknownDrink("Mojito"));
  });

  const invalid = [
    { why: "an amount of zero", added: limeJuicePart({ amount: 0 }), refused: badAmount("Martini") },
    { why: "a negative amount", added: limeJuicePart({ amount: -1 }), refused: badAmount("Martini") },
    { why: "an amount that is not a number", added: limeJuicePart({ amount: "15" }), refused: badAmount("Martini") },
    { why: "a liquid the drink already has", added: part({ amount: 5 }), refused: alreadyHas("Martini", "Gin") },
  ];
  for (const { why, added, refused } of invalid) {
    it(`refuses ${why}`, () => {
      const { service } = open();

      assert.deepEqual(refusal(() => service.addPart("Martini", added)), refused);
    });
  }

  it("refuses a liquid the drink already has when it is spelled differently", () => {
    const { service } = open(bar(), answers({ " gin": ginLiquid() }));

    assert.deepEqual(refusal(() => service.addPart("Martini", { liquid: " gin", amount: 5 })), alreadyHas("Martini", "Gin"));
  });

  it("lets the liquids service's unknown liquid error through unchanged", () => {
    const unknown = new UnknownLiquidError("Rum");
    const { service } = open(bar(), answers({ Rum: unknown }));

    assert.equal(caught(() => service.addPart("Martini", { liquid: "Rum", amount: 5 })), unknown);
  });

  it("changes nothing and does not save when it refuses", () => {
    const { service, read } = open();
    const refused = refusal(() => service.addPart("Martini", part({ amount: 5 })));

    assert.deepEqual({ ...read(), refused }, { ...bar(), refused: alreadyHas("Martini", "Gin") });
  });
});

describe("removing a part from a drink", () => {
  it("takes out the part whose liquid matches a trimmed, differently cased name, and saves once", () => {
    const { service, read } = open(bar(), {});
    service.removePart("negroni", "  gIN ");

    assert.deepEqual(read(), bar({ drinks: [negroni({ parts: [campariPart(), sweetVermouthPart()] }), martini()], saves: 1 }));
  });

  it("returns a deep copy of the drink without the part", () => {
    const { service } = open(bar(), {});

    assert.deepEqual(service.removePart("Martini", "Dry vermouth"), martini({ parts: [part({ amount: 60 })] }));
  });

  it("refuses a liquid that is not in the drink", () => {
    const { service } = open(bar(), {});

    assert.deepEqual(refusal(() => service.removePart("Martini", "Campari")), hasNo("Martini", "Campari"));
  });

  it("refuses an unknown drink, naming it", () => {
    const { service } = open(bar(), {});

    assert.deepEqual(refusal(() => service.removePart("Mojito", "Gin")), unknownDrink("Mojito"));
  });

  it("changes nothing and does not save when it refuses", () => {
    const { service, read } = open(bar(), {});
    const refused = refusal(() => service.removePart("Martini", "Campari"));

    assert.deepEqual({ ...read(), refused }, { ...bar(), refused: hasNo("Martini", "Campari") });
  });
});

describe("computing the figures of a drink from its liquids", () => {
  it("measures a negroni at 135 ml, 26.0 % and 35.1 ml of alcohol", () => {
    const { service } = open();

    assert.deepEqual(measured(service, "Negroni"), measure());
  });

  const drinks = [
    { name: "a martini", drink: "martini", want: measure({ amount: 70, alcoholPercent: 36.9, alcohol: 25.8 }) },
    { name: "a drink with only a non-alcoholic part", drink: "Lime", want: measure({ amount: 15, alcoholPercent: 0, alcohol: 0 }) },
    { name: "a drink with no parts", drink: "Empty", want: measure({ amount: 0, alcoholPercent: 0, alcohol: 0 }) },
  ];
  for (const { name, drink, want } of drinks) {
    it(`measures ${name}`, () => {
      const { service } = open(
        bar({ drinks: [martini(), { name: "Lime", parts: [limeJuicePart()] }, { name: "Empty", parts: [] }] }),
      );

      assert.deepEqual(measured(service, drink), want);
    });
  }

  it("lets an unknown liquid error from the liquids service through", () => {
    const unknown = new UnknownLiquidError("Gin");
    const { service } = open(bar(), answers({ Gin: unknown }));

    assert.equal(caught(() => service.alcoholOf("Negroni")), unknown);
  });

  it("does not save", () => {
    const { service, read } = open();
    measured(service, "Negroni");

    assert.equal(read().saves, 0);
  });

  for (const method of ["amountOf", "alcoholPercentOf", "alcoholOf"]) {
    it(`${method} refuses an unknown drink`, () => {
      const { service } = open();

      assert.deepEqual(refusal(() => service[method]("Mojito")), unknownDrink("Mojito"));
    });
  }
});

describe("being a referrer of liquids", () => {
  const uses = [
    { name: "a liquid in two drinks", liquid: "Gin", want: ["Negroni", "Martini"] },
    { name: "a liquid in one drink", liquid: "Dry vermouth", want: ["Martini"] },
    { name: "a liquid named in another case", liquid: " campari ", want: ["Negroni"] },
    { name: "a liquid no drink has", liquid: "Rum", want: [] },
  ];
  for (const { name, liquid, want } of uses) {
    it(`names the drinks using ${name}, in store order`, () => {
      const { service } = open(bar(), {});

      assert.deepEqual(service.usesOf(liquid), want);
    });
  }

  it("rewrites the liquid of every part that uses the old name, without saving", () => {
    const { service, read } = open(bar(), {});
    service.relabel("Gin", "London dry");

    assert.deepEqual(
      read(),
      bar({
        drinks: [
          negroni({ parts: [campariPart(), part({ liquid: "London dry" }), sweetVermouthPart()] }),
          martini({ parts: [part({ liquid: "London dry", amount: 60 }), dryVermouthPart()] }),
        ],
      }),
    );
  });

  it("leaves drinks that do not use the old name as they were", () => {
    const { service, read } = open(bar(), {});
    service.relabel("Dry vermouth", "Extra dry");

    assert.deepEqual(
      read(),
      bar({ drinks: [negroni(), martini({ parts: [part({ amount: 60 }), dryVermouthPart({ liquid: "Extra dry" })] })] }),
    );
  });
});

// --- Referrers: things that use drinks by name, such as drink lists ---

// A referrer mock is a plain object with only the methods the test configures,
// so calling anything else throws. `uses` maps a stored drink name to the
// names using it; asking about any other name throws.
function usingReferrer(uses) {
  return {
    usesOf(name) {
      if (!(name in uses)) throw new Error(`unconfigured usesOf(${name})`);
      return uses[name];
    },
  };
}

// A relabelling referrer appends each relabel call to the given list.
// Reading it back is the last resort: relabelling has no other output in the
// drinks service, since the referrer owns the data being rewritten, so the
// recorded calls are the only way to observe that every referrer was told.
function relabellingReferrer(relabelled) {
  return {
    relabel(from, to) {
      relabelled.push({ from, to });
    },
  };
}

function relabelling(overrides = {}) {
  return { from: "Negroni", to: "Boulevardier", ...overrides };
}

describe("updating a drink applies every given field as one change", () => {
  // A drink has one updatable field today; the table is here so the shape
  // matches liquids and a new field lands as a row, not a new describe.
  const changes = [
    { fields: "the name", change: { name: "  Boulevardier " }, drink: negroni({ name: "Boulevardier" }), told: [relabelling()] },
    { fields: "the name in another casing", change: { name: "NEGRONI" }, drink: negroni({ name: "NEGRONI" }), told: [relabelling({ to: "NEGRONI" })] },
  ];
  for (const { fields, change, drink, told } of changes) {
    it(`stores ${fields}, tells referrers only about a changed name, and saves once`, () => {
      const first = [];
      const second = [];
      const { service, read } = open(bar(), answers(), {
        referrers: [relabellingReferrer(first), relabellingReferrer(second)],
      });
      service.update("negroni", change);

      assert.deepEqual(
        { ...read(), relabelled: [first, second] },
        { ...bar({ drinks: [drink, martini()], saves: 1 }), relabelled: [told, told] },
      );
    });
  }

  const refused = [
    { why: "the name is taken", change: { name: "martini" }, refusal: duplicateDrink("Martini") },
    { why: "the name is blank", change: { name: "  " }, refusal: nameless("  ") },
  ];
  for (const { why, change, refusal: expected } of refused) {
    it(`writes nothing, tells no referrer and does not save when ${why}`, () => {
      const relabelled = [];
      const { service, read } = open(bar(), answers(), { referrers: [relabellingReferrer(relabelled)] });
      const result = refusal(() => service.update("Negroni", change));

      assert.deepEqual({ ...read(), relabelled, result }, { ...bar(), relabelled: [], result: expected });
    });
  }
});

describe("removing a drink that referrers use", () => {
  it("refuses with the stored drink name and every user, in referrer order", () => {
    const { service } = open(bar(), answers(), {
      referrers: [usingReferrer({ Negroni: ["Friday", "Saturday"] }), usingReferrer({ Negroni: ["Sunday"] })],
    });

    assert.deepEqual(
      refusal(() => service.remove(" negroni")),
      inUse({ item: "Negroni", users: ["Friday", "Saturday", "Sunday"] }),
    );
  });

  it("refuses when only a later referrer uses it", () => {
    const { service } = open(bar(), answers(), {
      referrers: [usingReferrer({ Negroni: [] }), usingReferrer({ Negroni: ["Sunday"] })],
    });

    assert.deepEqual(
      refusal(() => service.remove("Negroni")),
      inUse({ item: "Negroni", users: ["Sunday"] }),
    );
  });

  it("leaves the store alone and does not save when it refuses", () => {
    const { service, read } = open(bar(), answers(), { referrers: [usingReferrer({ Negroni: ["Friday"] })] });
    const refused = refusal(() => service.remove("Negroni"));

    assert.deepEqual({ ...read(), refused }, { ...bar(), refused: inUse({ item: "Negroni", users: ["Friday"] }) });
  });

  it("removes it and saves once when no referrer uses it", () => {
    const { service, read } = open(bar(), answers(), {
      referrers: [usingReferrer({ Negroni: [] }), usingReferrer({ Negroni: [] })],
    });
    service.remove(" NEGRONI");

    assert.deepEqual(read(), bar({ drinks: [martini()], saves: 1 }));
  });
});

describe("a drinks service that no referrer has been registered with", () => {
  it("removes a drink as before", () => {
    const { service, read } = open();
    service.remove("Negroni");

    assert.deepEqual(read(), bar({ drinks: [martini()], saves: 1 }));
  });
});
