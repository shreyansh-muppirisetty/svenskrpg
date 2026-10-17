import { describe, expect, it } from "bun:test";
import { CLASSROOM_ASSESSMENT } from "./classroom-assessment";

describe("requested Swedish årskurs 7 assessment", () => {
  it("assesses svenska in year 7 rather than combined year 7/8", () => {
    expect(CLASSROOM_ASSESSMENT.schoolYear).toBe(7);
    expect(CLASSROOM_ASSESSMENT.subject).toBe("svenska");
  });
  it("does not equate a Swedish school year with CEFR B1", () => {
    expect(CLASSROOM_ASSESSMENT.cefrRequirement).toBeNull();
  });
  it("adapts the reference criteria to content already taught", () => {
    expect(CLASSROOM_ASSESSMENT.referenceCriteriaYear).toBe(9);
    expect(CLASSROOM_ASSESSMENT.assessOnlyTaughtContent).toBe(true);
  });
});