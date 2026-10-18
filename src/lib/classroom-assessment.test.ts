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

describe("grading follows Skolverket's rules", () => {
  it("is a holistic judgement with D between C and E and B between A and C", () => {
    assert.equal(CLASSROOM_ASSESSMENT.holisticJudgement, true);
    assert.deepEqual(CLASSROOM_ASSESSMENT.intermediateGrades, { D: ["C", "E"], B: ["A", "C"] });
  });
  it("quotes the official årskurs 9 criteria and value words", () => {
    const prompt = year7AssessmentPrompt();
    assert.match(prompt, /i huvudsak fungerande struktur och innehåll/);
    assert.match(prompt, /relativt god språklig variation/);
    assert.match(prompt, /väl fungerande struktur och innehåll/);
    assert.match(prompt, /mellan C och E/);
    assert.match(prompt, /mellan A och C/);
    assert.match(prompt, /sammantagen bedömning/);
  });
  it("keeps language norms as a real criterion and does not inflate grades", () => {
    const prompt = year7AssessmentPrompt();
    assert.match(prompt, /recurring errors DO count/);
    assert.match(prompt, /do not give high grades just because the pupil is 13/);
    assert.doesNotMatch(prompt, /higher grade/);
  });
  it("uses the percentage scale only as a rough aid for closed exercises", () => {
    assert.equal(closedExerciseGrade(0.95), "A");
    assert.equal(closedExerciseGrade(0.82), "B");
    assert.equal(closedExerciseGrade(0.72), "C");
    assert.equal(closedExerciseGrade(0.62), "D");
    assert.equal(closedExerciseGrade(0.5), "E");
    assert.equal(closedExerciseGrade(0.4), "F");
    assert.match(year7AssessmentPrompt(), /ROUGH aid only/);
  });
});

describe("årskurs 7 follows Skolverket's terminsbetyg guidance", () => {
  it("allows every grade step with somewhat lower requirements than årskurs 9", () => {
    assert.equal(CLASSROOM_ASSESSMENT.allGradeStepsPossible, true);
    assert.equal(CLASSROOM_ASSESSMENT.requirementsSlightlyLowerThanYear9, true);
    const prompt = year7AssessmentPrompt();
    assert.match(prompt, /HOW ÅRSKURS 7 WORKS/);
    assert.match(prompt, /ALL grade steps A–F are possible/);
    assert.match(prompt, /not counted/);
  });
  it("never steers toward or away from a grade, D included", () => {
    assert.equal(CLASSROOM_ASSESSMENT.neverSteerTowardAGrade, true);
    const prompt = year7AssessmentPrompt();
    assert.match(prompt, /GIVE EVERY GRADE ITS DUE/);
    assert.match(prompt, /D and B are completely ordinary grades/);
    assert.doesNotMatch(prompt, /Never give D|D is rare|rarely give D/i);
  });
});
