import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { CLASSROOM_ASSESSMENT } from "./classroom-assessment";

describe("requested Swedish årskurs 7 assessment", () => {
  it("assesses svenska in year 7 rather than combined year 7/8", () => {
    assert.equal(CLASSROOM_ASSESSMENT.schoolYear, 7);
    assert.equal(CLASSROOM_ASSESSMENT.subject, "svenska");
  });
  it("does not equate a Swedish school year with CEFR B1", () => {
    assert.equal(CLASSROOM_ASSESSMENT.cefrRequirement, null);
  });
  it("adapts the reference criteria to content already taught", () => {
    assert.equal(CLASSROOM_ASSESSMENT.referenceCriteriaYear, 9);
    assert.equal(CLASSROOM_ASSESSMENT.assessOnlyTaughtContent, true);
  });
});