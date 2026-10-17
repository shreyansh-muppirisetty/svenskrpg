import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { PUNCTUATION_RULES } from "./classroom-punctuation";

describe("Swedish year-seven punctuation conventions", () => {
  it("does not require a comma before every att-clause", () => {
    assert.equal(PUNCTUATION_RULES.requireCommaBeforeAtt, false);
  });
  it("does not require commas around every subordinate clause", () => {
    assert.equal(PUNCTUATION_RULES.requireCommaAroundEverySubordinateClause, false);
  });
  it("does not add hyphens to ordinary Swedish compounds", () => {
    assert.equal(PUNCTUATION_RULES.hyphenateOrdinaryCompounds, false);
  });
  it("does not apply English apostrophe genitives", () => {
    assert.equal(PUNCTUATION_RULES.useApostropheForOrdinaryGenitive, false);
  });
  it("accepts legitimate alternative punctuation", () => {
    assert.equal(PUNCTUATION_RULES.acceptValidAlternatives, true);
  });
  it("keeps punctuation exercises at årskurs 7", () => {
    assert.equal(PUNCTUATION_RULES.schoolYear, 7);
  });
});