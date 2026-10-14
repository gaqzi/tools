import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { nameKey, sameName, trimmedName } from "./names.js";

describe("the key a name is matched by", () => {
  const cases = [
    { name: "a name as stored", given: "Gin", want: "gin" },
    { name: "a name with spaces around it", given: "  Sweet vermouth ", want: "sweet vermouth" },
    { name: "a name in mixed casing", given: "gIN", want: "gin" },
  ];
  for (const { name, given, want } of cases) {
    it(`lowercases and trims ${name}`, () => {
      assert.equal(nameKey(given), want);
    });
  }
});

describe("comparing two names", () => {
  const cases = [
    { name: "the same name", a: "Gin", b: "Gin", want: true },
    { name: "a name trimmed and in another casing", a: "Gin", b: " gIN  ", want: true },
    { name: "different names", a: "Gin", b: "Vodka", want: false },
  ];
  for (const { name, a, b, want } of cases) {
    it(`finds ${name} ${want ? "the same" : "different"}`, () => {
      assert.equal(sameName(a, b), want);
    });
  }
});

describe("trimming a name to store", () => {
  const cases = [
    { name: "a name with spaces around it", given: "  Sweet vermouth ", want: "Sweet vermouth" },
    { name: "a blank name", given: "   ", want: "" },
    { name: "something that is not a string", given: 42, want: "" },
  ];
  for (const { name, given, want } of cases) {
    it(`gives ${JSON.stringify(want)} for ${name}`, () => {
      assert.equal(trimmedName(given), want);
    });
  }
});
