import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  Liquids,
  DuplicateLiquidError,
  InvalidLiquidError,
  UnknownLiquidError,
} from "./liquids.js";
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

// The kind of error a call is refused with, so a refusal is part of the state.
function refusal(fn) {
  return caught(fn)?.constructor.name ?? "none";
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

  it("refuses an unknown name", () => {
    const { service } = open();

    assert.ok(caught(() => service.get("Rum")) instanceof UnknownLiquidError);
  });

  it("names the unknown liquid on the error", () => {
    const { service } = open();

    assert.equal(caught(() => service.get("Rum")).liquid, "Rum");
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

  it("refuses a name that exists, ignoring case and surrounding space", () => {
    const { service } = open();

    assert.ok(caught(() => service.add({ name: "gin ", alcoholPercent: 40 })) instanceof DuplicateLiquidError);
  });

  it("names the existing liquid on the duplicate error", () => {
    const { service } = open();

    assert.equal(caught(() => service.add({ name: "gin ", alcoholPercent: 40 })).liquid, "Gin");
  });

  it("leaves the store alone and does not save when it refuses a duplicate", () => {
    const { service, read } = open();
    const refused = refusal(() => service.add({ name: "gin", alcoholPercent: 40 }));

    assert.deepEqual({ ...read(), refused }, { ...shelf(), refused: "DuplicateLiquidError" });
  });

  const invalid = [
    { why: "an empty name", liquid: { name: "", alcoholPercent: 40 } },
    { why: "a blank name", liquid: { name: "   ", alcoholPercent: 40 } },
    { why: "a negative percentage", liquid: { name: "Rum", alcoholPercent: -1 } },
    { why: "a percentage over 100", liquid: { name: "Rum", alcoholPercent: 100.5 } },
    { why: "a percentage that is not a number", liquid: { name: "Rum", alcoholPercent: "40" } },
    { why: "a percentage of NaN", liquid: { name: "Rum", alcoholPercent: NaN } },
  ];
  for (const { why, liquid } of invalid) {
    it(`refuses ${why}`, () => {
      const { service } = open();

      assert.ok(caught(() => service.add(liquid)) instanceof InvalidLiquidError);
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
  it("changes its alcohol percentage and saves once", () => {
    const { service, read } = open();
    service.update("gin", { alcoholPercent: 37.5 });

    assert.deepEqual(read(), shelf({ liquids: [gin({ alcoholPercent: 37.5 }), limeJuice()], saves: 1 }));
  });

  it("returns a copy of the updated liquid", () => {
    const { service } = open();

    assert.deepEqual(service.update("Gin", { alcoholPercent: 37.5 }), gin({ alcoholPercent: 37.5 }));
  });

  it("refuses an unknown name", () => {
    const { service } = open();

    assert.ok(caught(() => service.update("Rum", { alcoholPercent: 40 })) instanceof UnknownLiquidError);
  });

  it("refuses a percentage outside 0 to 100", () => {
    const { service } = open();

    assert.ok(caught(() => service.update("Gin", { alcoholPercent: 101 })) instanceof InvalidLiquidError);
  });

  it("does not save when it refuses", () => {
    const { service, read } = open();
    const refused = refusal(() => service.update("Gin", { alcoholPercent: 101 }));

    assert.deepEqual({ ...read(), refused }, { ...shelf(), refused: "InvalidLiquidError" });
  });
});

describe("renaming a liquid", () => {
  it("gives it the trimmed new name, keeps its place and saves once", () => {
    const { service, read } = open();
    service.rename("gin", "  London dry ");

    assert.deepEqual(read(), shelf({ liquids: [gin({ name: "London dry" }), limeJuice()], saves: 1 }));
  });

  it("returns a copy of the renamed liquid", () => {
    const { service } = open();

    assert.deepEqual(service.rename("Gin", "London dry"), gin({ name: "London dry" }));
  });

  it("allows a different casing of its own name", () => {
    const { service, read } = open();
    service.rename("Gin", "GIN");

    assert.deepEqual(read(), shelf({ liquids: [gin({ name: "GIN" }), limeJuice()], saves: 1 }));
  });

  it("refuses an unknown name", () => {
    const { service } = open();

    assert.ok(caught(() => service.rename("Rum", "Dark rum")) instanceof UnknownLiquidError);
  });

  it("refuses a name another liquid has", () => {
    const { service } = open();

    assert.ok(caught(() => service.rename("Gin", " lime JUICE")) instanceof DuplicateLiquidError);
  });

  it("refuses a blank new name", () => {
    const { service } = open();

    assert.ok(caught(() => service.rename("Gin", "  ")) instanceof InvalidLiquidError);
  });

  it("does not save when it refuses", () => {
    const { service, read } = open();
    const refused = refusal(() => service.rename("Gin", "lime juice"));

    assert.deepEqual({ ...read(), refused }, { ...shelf(), refused: "DuplicateLiquidError" });
  });
});

describe("removing a liquid", () => {
  it("takes it out of the store and saves once", () => {
    const { service, read } = open();
    service.remove(" GIN");

    assert.deepEqual(read(), shelf({ liquids: [limeJuice()], saves: 1 }));
  });

  it("refuses an unknown name", () => {
    const { service } = open();

    assert.ok(caught(() => service.remove("Rum")) instanceof UnknownLiquidError);
  });

  it("does not save when it refuses", () => {
    const { service, read } = open();
    const refused = refusal(() => service.remove("Rum"));

    assert.deepEqual({ ...read(), refused }, { ...shelf(), refused: "UnknownLiquidError" });
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

function inUse(error) {
  return { name: error.name, item: error.item, users: error.users };
}

describe("renaming a liquid that referrers use", () => {
  it("tells every referrer the stored old name and the trimmed new name, then saves once", () => {
    const first = [];
    const second = [];
    const { service, read } = open(shelf(), {
      referrers: [relabellingReferrer(first), relabellingReferrer(second)],
    });
    service.rename("gin", "  London dry ");

    assert.deepEqual(
      { ...read(), relabelled: [first, second] },
      { ...shelf({ liquids: [gin({ name: "London dry" }), limeJuice()], saves: 1 }), relabelled: [[relabelling()], [relabelling()]] },
    );
  });

  it("tells no referrer and does not save when the rename is refused", () => {
    const relabelled = [];
    const { service, read } = open(shelf(), { referrers: [relabellingReferrer(relabelled)] });
    const refused = refusal(() => service.rename("Gin", "lime juice"));

    assert.deepEqual({ ...read(), relabelled, refused }, { ...shelf(), relabelled: [], refused: "DuplicateLiquidError" });
  });
});

describe("removing a liquid that referrers use", () => {
  it("refuses with the stored liquid name and every user, in referrer order", () => {
    const { service } = open(shelf(), {
      referrers: [usingReferrer({ Gin: ["Negroni", "Martini"] }), usingReferrer({ Gin: ["Gimlet"] })],
    });

    assert.deepEqual(inUse(caught(() => service.remove(" gin"))), {
      name: "InUseError",
      item: "Gin",
      users: ["Negroni", "Martini", "Gimlet"],
    });
  });

  it("is an InUseError", () => {
    const { service } = open(shelf(), { referrers: [usingReferrer({ Gin: ["Negroni"] })] });

    assert.ok(caught(() => service.remove("Gin")) instanceof InUseError);
  });

  it("refuses when only a later referrer uses it", () => {
    const { service } = open(shelf(), {
      referrers: [usingReferrer({ Gin: [] }), usingReferrer({ Gin: ["Gimlet"] })],
    });

    assert.deepEqual(inUse(caught(() => service.remove("Gin"))), {
      name: "InUseError",
      item: "Gin",
      users: ["Gimlet"],
    });
  });

  it("leaves the store alone and does not save when it refuses", () => {
    const { service, read } = open(shelf(), { referrers: [usingReferrer({ Gin: ["Negroni"] })] });
    const refused = refusal(() => service.remove("Gin"));

    assert.deepEqual({ ...read(), refused }, { ...shelf(), refused: "InUseError" });
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
