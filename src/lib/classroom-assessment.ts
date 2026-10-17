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
} as const;

export function year7AssessmentPrompt(): string {
  const policy = CLASSROOM_ASSESSMENT;
  return `ASSESSMENT CONTEXT:
- Subject: ${policy.subject}, Swedish grundskola årskurs ${policy.schoolYear}, ${policy.curriculum}. Not svenska som andraspråk and not a CEFR language exam.
- There are no separate national year-7 criteria. Use the Swedish year-${policy.referenceCriteriaYear} criteria proportionately to year 7, the current task, and content actually taught/practised. Do not demand end-of-year-9 achievement.
- Give an assignment-level practice grade, never claim to determine the official subject/term grade. Assess only evidence this task can show; an absent oral task is not failed oral competence.
- E: understandable, mainly coherent writing with simple variation, a basically functioning structure and some adaptation to purpose/reader; mainly functioning language conventions. Basic reading comprehension with simple, relevant reasoning and support from the text. Simple reasoning about source credibility/relevance where asked.
- C: relatively good variation and coherence, a functioning structure, relatively good adaptation and language conventions. Good reading comprehension with developed reasoning and relevant textual examples. Developed reasoning about sources where asked.
- A: good variation and coherence, a well-functioning structure, good adaptation and language conventions. Very good reading comprehension with well-developed, nuanced reasoning supported by relevant examples. Well-developed reasoning about sources where asked. These qualities are judged at year-7 depth, not advanced literary or adult academic level.
- B: evidence overall best matches a level between A and C. D: evidence overall best matches a level between C and E. Use a qualitative overall judgement, not fixed percentages or an arithmetic mean of rubric letters.
- F: submitted work does not demonstrate E-level quality for the assessed task. No submitted work or too little evidence to assess is NOT automatically F: ask for the missing work and do not emit a grade marker.
- Closed grammar/vocabulary exercises: explain actual errors and what understanding they show; the result is practice evidence, not an official subject grade. Accept all grammatically valid answers fitting the context, not only the answer-key wording.
- A does not require error-free work. Weigh recurring errors by their effect on clarity, structure and the skill being assessed. Do not apply an automatic grade ceiling for word count, missing decorative techniques, optional advanced terminology or an isolated spelling error.
- A concise but well-supported answer may demonstrate high quality. Length alone and adult sophistication must not earn or prevent a grade. Treat rigid requirements for sonnets, villanelles, enjambment, complex rhetoric or exact formal letter layout as extension practice, not prerequisites for a passing or high year-7 grade.
- Feedback: identify demonstrated strengths, explain the chosen grade using relevant criteria, and give one concrete next step. Never invent evidence, sources or student performance.`;
}