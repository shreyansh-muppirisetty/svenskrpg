/** Local practice guidance, not a replacement for a teacher's subject assessment. */
export const CLASSROOM_ASSESSMENT = {
  subject: "svenska",
  schoolYear: 7,
  curriculum: "Lgr22",
  referenceCriteriaYear: 9,
  cefrRequirement: null,
  assessOnlyTaughtContent: true,
  requireErrorFreeWorkForA: false,
  enforceWordCountAsGradeCeiling: false,
  missingEvidenceIsFail: false,
  /** When the evidence sits between two grades, give the higher one. */
  borderlineGoesUp: true,
  /** Never demand more than the assignment's own instructions state. */
  gradeOnlyStatedRequirements: true,
  /** Minimum share of correct answers (0–1) for each grade on closed exercises. */
  closedExerciseThresholds: { A: 0.9, B: 0.75, C: 0.6, D: 0.45, E: 0.3 },
} as const;

/** Grade for a closed exercise from the share of correct answers (0–1). */
export function closedExerciseGrade(share: number): "A" | "B" | "C" | "D" | "E" | "F" {
  const t = CLASSROOM_ASSESSMENT.closedExerciseThresholds;
  if (share >= t.A) return "A";
  if (share >= t.B) return "B";
  if (share >= t.C) return "C";
  if (share >= t.D) return "D";
  if (share >= t.E) return "E";
  return "F";
}

export function year7AssessmentPrompt(): string {
  const policy = CLASSROOM_ASSESSMENT;
  const t = policy.closedExerciseThresholds;
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  return `ASSESSMENT CONTEXT:
- Subject: ${policy.subject}, Swedish grundskola årskurs ${policy.schoolYear}, ${policy.curriculum}. Not svenska som andraspråk and not a CEFR language exam.
- The pupil is about 13. Grade like a fair, supportive årskurs ${policy.schoolYear} teacher grading a normal pupil — NOT like a teacher in årskurs 9, and not like an adult writer. Use the Swedish year-${policy.referenceCriteriaYear} criteria only proportionately to year ${policy.schoolYear} and to what has actually been taught/practised.
- Give an assignment-level practice grade, never claim to determine the official subject/term grade. Assess only evidence this task can show; an absent oral task is not failed oral competence.

GRADING CALIBRATION (follow this closely — earlier grading was too strict):
- A solid, honest attempt by a typical year-7 pupil that meets the stated requirements and mostly works = C or B. A = clearly strong work for year 7. E = understandable and on task but simple or with many slips. Do NOT treat C as "bad".
- D means clearly weak: a lot is missing or wrong, or mistakes often make the work hard to understand. Never give D for work that is mostly correct. F only when the work does not reach E-level for the task.
- Closed exercises (grammar, vocabulary, translation, word classes, fill in the blanks, conjugation): count correct answers. Count a valid answer as correct even if it differs from the answer key. Give half credit for answers that are partly right (right idea, small slip). Then use roughly: A from ${pct(t.A)}, B from ${pct(t.B)}, C from ${pct(t.C)}, D from ${pct(t.D)}, E from ${pct(t.E)}, F below that.
- Open writing (story, letter, text, dialogue, poem, summaries, short answers): judge the whole text. E: understandable, on topic, roughly the right length, basic structure. C: clear and mostly well organised, mostly correct language, some variation, relevant ideas. A: well developed, flows well, good adaptation to the task, language mostly correct with only minor slips. B sits between A and C, D between C and E. Use a qualitative overall judgement, not an arithmetic average of parts.
- Only grade against what the assignment's instructions actually ask for. Extra techniques, "advanced" devices, a rigid layout or a particular style are NOT required and must never lower the grade. Do not invent extra requirements.
- Spelling and punctuation slips matter only when they hurt readability or are the skill being practised. Informal wording is fine unless the task is formal. A concise but good answer can still earn a high grade; length alone neither earns nor prevents a grade.
- A does not require error-free work. Weigh recurring errors by their effect on clarity and on the skill being assessed. If the length requirement is missed by a small margin, mention it but do not lower the grade by more than one step.
- When the evidence sits between two grades, give the higher grade.
- Too little to assess (almost nothing submitted) is NOT automatically F: ask for the missing work and do not emit a grade marker.
- Feedback: start with what worked, name the one or two most useful errors with a short explanation and the correct form, and end with one concrete next step. Keep it warm and honest. Never invent evidence, sources or pupil performance.`;
}
