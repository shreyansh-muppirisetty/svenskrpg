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
import { closedExerciseGrade, year7AssessmentPrompt } from "./classroom-assessment";

describe("realistic årskurs 7 grading", () => {
  it("maps closed-exercise results to fair grades", () => {
    assert.equal(closedExerciseGrade(1), "A");
    assert.equal(closedExerciseGrade(0.8), "B");
    assert.equal(closedExerciseGrade(0.65), "C");
    assert.equal(closedExerciseGrade(0.5), "D");
    assert.equal(closedExerciseGrade(0.35), "E");
    assert.equal(closedExerciseGrade(0.1), "F");
  });
  it("grades only on stated requirements and rounds borderline cases up", () => {
    assert.equal(CLASSROOM_ASSESSMENT.gradeOnlyStatedRequirements, true);
    assert.equal(CLASSROOM_ASSESSMENT.borderlineGoesUp, true);
    assert.match(year7AssessmentPrompt(), /GRADING CALIBRATION/);
    assert.match(year7AssessmentPrompt(), /higher grade/);
  });
});
