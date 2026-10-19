import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Liquids } from "./liquids.js";
import { InUseError } from "./references.js";

// --- The state: the store's liquids and how many times the service said it changed ---

function shelf(overrides = {}) {
  return { liquids: [gin(), limeJuice()], saves: 0, ...overrides };
}
function gin(overrides = {}) {
  return { name: "Gin", alcoholPercent: 40, ...overrides };
}
function limeJuice(overrides = {}) {
  return { name: "Lime juice", alcoholPercent: 0, ...overrides };
}

// Builds the service over the shelf's liquids and returns it with an observer
// of the whole state. `saves` is read from the changed callback's call count:
// "save exactly once per mutation, never for a read" has no other output, so
// the count is the only way to observe that contract.
function open(initial = shelf(), { referrers = [] } = {}) {
  const store = initial.liquids.map((liquid) => ({ ...liquid }));
  let saves = 0;
  const service = new Liquids(store, { changed: () => (saves += 1) });
  for (const referrer of referrers) service.referredToBy(referrer);
  return { service, read: () => ({ liquids: store, saves }) };
}

// A refusal is one state: the error's name and the data it carries. The
// message is left out for InUseError because references.test.js pins it.
function refusal(fn) {
  const error = caught(fn);
  if (error === null) return "none";
  const fields = {
    error: error.constructor.name,
    liquid: error.liquid,
    item: error.item,
    users: error.users,
    message: error instanceof InUseError ? undefined : error.message,
  };
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}
function unknownLiquid(liquid) {
  return { error: "UnknownLiquidError", liquid, message: `There is no liquid named "${liquid}".` };
}
function duplicateLiquid(liquid) {
  return { error: "DuplicateLiquidError", liquid, message: `A liquid named "${liquid}" already exists.` };
}
function nameless(liquid) {
  return { error: "InvalidLiquidError", liquid, message: "A liquid needs a name." };
}
function outOfRange(liquid) {
  return { error: "InvalidLiquidError", liquid, message: "The alcohol percentage must be a number from 0 to 100." };
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

describe("a fresh service over the stored liquids", () => {
  it("lists them in insertion order without having saved anything", () => {
    const { service, read } = open();
    service.all();

    assert.deepEqual({ ...read(), listed: service.all() }, { ...shelf(), listed: [gin(), limeJuice()] });
  });
});

describe("reading liquids", () => {
  it("finds a liquid by a trimmed, differently cased name", () => {
    const { service } = open();

    assert.deepEqual(service.get("  gIN "), gin());
  });

  it("hands out copies, so changing one does not change the store", () => {
    const { service, read } = open();
    service.get("Gin").alcoholPercent = 99;
    service.all()[1].name = "Changed";

    assert.deepEqual(read(), shelf());
  });

  it("does not save", () => {
    const { service, read } = open();
    service.get("Gin");
    service.all();

    assert.equal(read().saves, 0);
  });

  it("refuses an unknown name, naming it", () => {
    const { service } = open();

    assert.deepEqual(refusal(() => service.get("Rum")), unknownLiquid("Rum"));
  });
});

describe("adding a liquid", () => {
  it("stores it with its name trimmed and its casing kept, and saves once", () => {
    const { service, read } = open();
    service.add({ name: "  Dark rum ", alcoholPercent: 37.5 });

    assert.deepEqual(read(), shelf({ liquids: [gin(), limeJuice(), { name: "Dark rum", alcoholPercent: 37.5 }], saves: 1 }));
  });

  it("returns a copy of what it stored", () => {
    const { service, read } = open();
    service.add({ name: "Rum", alcoholPercent: 40 }).alcoholPercent = 1;

    assert.deepEqual(read().liquids[2], { name: "Rum", alcoholPercent: 40 });
  });

  it("refuses a name that exists, ignoring case and surrounding space, naming the existing liquid", () => {
    const { service } = open();

    assert.deepEqual(refusal(() => service.add({ name: "gin ", alcoholPercent: 40 })), duplicateLiquid("Gin"));
  });

  it("leaves the store alone and does not save when it refuses a duplicate", () => {
    const { service, read } = open();
    const refused = refusal(() => service.add({ name: "gin", alcoholPercent: 40 }));

    assert.deepEqual({ ...read(), refused }, { ...shelf(), refused: duplicateLiquid("Gin") });
  });

  const invalid = [
    { why: "an empty name", liquid: { name: "", alcoholPercent: 40 }, refused: nameless("") },
    { why: "a blank name", liquid: { name: "   ", alcoholPercent: 40 }, refused: nameless("   ") },
    { why: "a negative percentage", liquid: { name: "Rum", alcoholPercent: -1 }, refused: outOfRange("Rum") },
    { why: "a percentage over 100", liquid: { name: "Rum", alcoholPercent: 100.5 }, refused: outOfRange("Rum") },
    { why: "a percentage that is not a number", liquid: { name: "Rum", alcoholPercent: "40" }, refused: outOfRange("Rum") },
    { why: "a percentage of NaN", liquid: { name: "Rum", alcoholPercent: NaN }, refused: outOfRange("Rum") },
  ];
  for (const { why, liquid, refused } of invalid) {
    it(`refuses ${why}`, () => {
      const { service } = open();

      assert.deepEqual(refusal(() => service.add(liquid)), refused);
    });
  }

  it("accepts the bounds 0 and 100", () => {
    const { service, read } = open();
    service.add({ name: "Water", alcoholPercent: 0 });
    service.add({ name: "Spirytus", alcoholPercent: 100 });

    assert.deepEqual(
      read(),
      shelf({
        liquids: [gin(), limeJuice(), { name: "Water", alcoholPercent: 0 }, { name: "Spirytus", alcoholPercent: 100 }],
        saves: 2,
      }),
    );
  });
});

describe("updating a liquid", () => {
  it("returns a copy of the updated liquid", () => {
    const { service } = open();

    assert.deepEqual(service.update("Gin", { alcoholPercent: 37.5 }), gin({ alcoholPercent: 37.5 }));
  });

  it("refuses an unknown name, naming it", () => {
    const { service } = open();

    assert.deepEqual(refusal(() => service.update("Rum", { alcoholPercent: 40 })), unknownLiquid("Rum"));
  });
});

describe("updating a liquid's name", () => {
  it("gives it the trimmed new name, keeps its place and saves once", () => {
    const { service, read } = open();
    service.update("gin", { name: "  London dry " });

    assert.deepEqual(read(), shelf({ liquids: [gin({ name: "London dry" }), limeJuice()], saves: 1 }));
  });

  it("returns a copy of the liquid under its new name", () => {
    const { service } = open();

    assert.deepEqual(service.update("Gin", { name: "London dry" }), gin({ name: "London dry" }));
  });

  it("allows a different casing of its own name", () => {
    const { service, read } = open();
    service.update("Gin", { name: "GIN" });

    assert.deepEqual(read(), shelf({ liquids: [gin({ name: "GIN" }), limeJuice()], saves: 1 }));
  });

  it("refuses an unknown name, naming it", () => {
    const { service } = open();

    assert.deepEqual(refusal(() => service.update("Rum", { name: "Dark rum" })), unknownLiquid("Rum"));
  });

  it("refuses a name another liquid has, naming the existing one", () => {
    const { service } = open();

    assert.deepEqual(refusal(() => service.update("Gin", { name: " lime JUICE" })), duplicateLiquid("Lime juice"));
  });

  it("refuses a blank new name", () => {
    const { service } = open();

    assert.deepEqual(refusal(() => service.update("Gin", { name: "  " })), nameless("  "));
  });

  it("does not save when it refuses", () => {
    const { service, read } = open();
    const refused = refusal(() => service.update("Gin", { name: "lime juice" }));

    assert.deepEqual({ ...read(), refused }, { ...shelf(), refused: duplicateLiquid("Lime juice") });
  });
});

describe("the public surface of the liquids service", () => {
  it("is add, all, get, referredToBy, remove and update", () => {
    const surface = Object.getOwnPropertyNames(Liquids.prototype).filter((n) => n !== "constructor").sort();

    assert.deepEqual(surface, ["add", "all", "get", "referredToBy", "remove", "update"]);
  });
});

describe("removing a liquid", () => {
  it("takes it out of the store and saves once", () => {
    const { service, read } = open();
    service.remove(" GIN");

    assert.deepEqual(read(), shelf({ liquids: [limeJuice()], saves: 1 }));
  });

  it("refuses an unknown name, naming it", () => {
    const { service } = open();

    assert.deepEqual(refusal(() => service.remove("Rum")), unknownLiquid("Rum"));
  });

  it("does not save when it refuses", () => {
    const { service, read } = open();
    const refused = refusal(() => service.remove("Rum"));

    assert.deepEqual({ ...read(), refused }, { ...shelf(), refused: unknownLiquid("Rum") });
  });
});

// --- Referrers: things that use liquids by name, such as drinks ---

// A referrer mock is a plain object with only the methods the test configures,
// so calling anything else throws. `uses` maps a stored liquid name to the
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
// liquids service, since the referrer owns the data being rewritten, so the
// recorded calls are the only way to observe that every referrer was told.
function relabellingReferrer(relabelled) {
  return {
    relabel(from, to) {
      relabelled.push({ from, to });
    },
  };
}

function relabelling(overrides = {}) {
  return { from: "Gin", to: "London dry", ...overrides };
}

describe("updating a liquid applies every given field as one change", () => {
  const changes = [
    { fields: "the name", change: { name: "  London dry " }, liquid: gin({ name: "London dry" }), told: [relabelling()] },
    { fields: "the name in another casing", change: { name: "GIN" }, liquid: gin({ name: "GIN" }), told: [relabelling({ to: "GIN" })] },
    { fields: "the percentage", change: { alcoholPercent: 37.5 }, liquid: gin({ alcoholPercent: 37.5 }), told: [] },
    {
      fields: "the name and the percentage",
      change: { name: "  London dry ", alcoholPercent: 37.5 },
      liquid: gin({ name: "London dry", alcoholPercent: 37.5 }),
      told: [relabelling()],
    },
  ];
  for (const { fields, change, liquid, told } of changes) {
    it(`stores ${fields}, tells referrers only about a changed name, and saves once`, () => {
      const first = [];
      const second = [];
      const { service, read } = open(shelf(), {
        referrers: [relabellingReferrer(first), relabellingReferrer(second)],
      });
      service.update("gin", change);

      assert.deepEqual(
        { ...read(), relabelled: [first, second] },
        { ...shelf({ liquids: [liquid, limeJuice()], saves: 1 }), relabelled: [told, told] },
      );
    });
  }

  it("returns a copy holding both new values", () => {
    const { service } = open();

    assert.deepEqual(service.update("Gin", { name: "London dry", alcoholPercent: 37.5 }), gin({ name: "London dry", alcoholPercent: 37.5 }));
  });

  const refused = [
    { why: "a valid name and a percentage out of range", change: { name: "London dry", alcoholPercent: 101 }, refusal: outOfRange("Gin") },
    { why: "a percentage out of range alone", change: { alcoholPercent: 101 }, refusal: outOfRange("Gin") },
    { why: "a taken name and a valid percentage", change: { name: " lime JUICE", alcoholPercent: 37.5 }, refusal: duplicateLiquid("Lime juice") },
    { why: "a blank name and a valid percentage", change: { name: "  ", alcoholPercent: 37.5 }, refusal: nameless("  ") },
  ];
  for (const { why, change, refusal: expected } of refused) {
    it(`writes nothing, tells no referrer and does not save when ${why}`, () => {
      const relabelled = [];
      const { service, read } = open(shelf(), { referrers: [relabellingReferrer(relabelled)] });
      const result = refusal(() => service.update("Gin", change));

      assert.deepEqual({ ...read(), relabelled, result }, { ...shelf(), relabelled: [], result: expected });
    });
  }
});

describe("removing a liquid that referrers use", () => {
  it("refuses with the stored liquid name and every user, in referrer order", () => {
    const { service } = open(shelf(), {
      referrers: [usingReferrer({ Gin: ["Negroni", "Martini"] }), usingReferrer({ Gin: ["Gimlet"] })],
    });

    assert.deepEqual(
      refusal(() => service.remove(" gin")),
      inUse({ item: "Gin", users: ["Negroni", "Martini", "Gimlet"] }),
    );
  });

  it("refuses when only a later referrer uses it", () => {
    const { service } = open(shelf(), {
      referrers: [usingReferrer({ Gin: [] }), usingReferrer({ Gin: ["Gimlet"] })],
    });

    assert.deepEqual(
      refusal(() => service.remove("Gin")),
      inUse({ item: "Gin", users: ["Gimlet"] }),
    );
  });

  it("leaves the store alone and does not save when it refuses", () => {
    const { service, read } = open(shelf(), { referrers: [usingReferrer({ Gin: ["Negroni"] })] });
    const refused = refusal(() => service.remove("Gin"));

    assert.deepEqual({ ...read(), refused }, { ...shelf(), refused: inUse({ item: "Gin", users: ["Negroni"] }) });
  });

  it("removes it and saves once when no referrer uses it", () => {
    const { service, read } = open(shelf(), {
      referrers: [usingReferrer({ Gin: [] }), usingReferrer({ Gin: [] })],
    });
    service.remove(" GIN");

    assert.deepEqual(read(), shelf({ liquids: [limeJuice()], saves: 1 }));
  });
});

describe("a service that no referrer has been registered with", () => {
  it("removes a liquid as before", () => {
    const { service, read } = open();
    service.remove("Gin");

    assert.deepEqual(read(), shelf({ liquids: [limeJuice()], saves: 1 }));
  });
});
