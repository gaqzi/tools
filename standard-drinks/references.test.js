import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { InUseError, Referrers } from "./references.js";

// The state of the error: what was to be removed, who stops it, what it says.
function refusal(overrides = {}) {
  return {
    item: "Gin",
    users: ["Negroni", "Martini"],
    message: '"Gin" is used by Negroni, Martini.',
    ...overrides,
  };
}

function described(error) {
  return { item: error.item, users: error.users, message: error.message };
}

describe("an item that cannot be removed because others use it", () => {
  it("names the item, its users and both in the message", () => {
    assert.deepEqual(described(new InUseError("Gin", ["Negroni", "Martini"])), refusal());
  });

  it("reads naturally with a single user", () => {
    assert.deepEqual(
      described(new InUseError("Gin", ["Negroni"])),
      refusal({ users: ["Negroni"], message: '"Gin" is used by Negroni.' }),
    );
  });
});

// --- Referrers: everything that uses items of one kind by name ---

// A using referrer answers `usesOf` only for the configured names and throws
// for any other, so an unexpected question cannot go unnoticed.
function usingReferrer(uses) {
  return {
    usesOf(name) {
      if (!(name in uses)) throw new Error(`unconfigured usesOf(${name})`);
      return uses[name];
    },
  };
}

// A relabelling referrer appends each relabel call to the given list.
// Reading it back is the last resort: relabelling has no output, since each
// referrer owns the data being rewritten, so the recorded calls are the only
// way to observe that every referrer was told.
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

describe("referrers nobody has added to", () => {
  it("know of no users", () => {
    assert.deepEqual(new Referrers().usersOf("Gin"), []);
  });
});

describe("asking referrers who uses an item", () => {
  it("lists the users from every referrer in the order they were added", () => {
    const referrers = new Referrers();
    referrers.add(usingReferrer({ Gin: ["Negroni", "Martini"] }));
    referrers.add(usingReferrer({ Gin: ["Friday"] }));

    assert.deepEqual(referrers.usersOf("Gin"), ["Negroni", "Martini", "Friday"]);
  });

  it("lists nobody when no referrer uses the item", () => {
    const referrers = new Referrers();
    referrers.add(usingReferrer({ Vodka: [] }));
    referrers.add(usingReferrer({ Vodka: [] }));

    assert.deepEqual(referrers.usersOf("Vodka"), []);
  });
});

describe("relabelling an item across referrers", () => {
  it("tells every referrer the old and the new name", () => {
    const first = [];
    const second = [];
    const referrers = new Referrers();
    referrers.add(relabellingReferrer(first));
    referrers.add(relabellingReferrer(second));
    referrers.relabel("Gin", "London dry");

    assert.deepEqual([first, second], [[relabelling()], [relabelling()]]);
  });
});
