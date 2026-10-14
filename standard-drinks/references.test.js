import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { InUseError } from "./references.js";

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
