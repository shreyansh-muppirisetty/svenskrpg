/**
 * Local practice grading policy for årskurs 7 svenska.
 *
 * Source: Skolverket, Lgr22 kursplan i svenska, "Betygskriterier för slutet av årskurs 9"
 * (https://www.skolverket.se/…/curriculums/LGR22/GRGRSVE01) and Skolverket's rules for
 * betygssättning (from 1 July 2022): the teacher makes a *sammantagen bedömning* and sets the
 * grade that *bäst motsvarar* the pupil's knowledge. Grading is not mechanical — no fixed
 * percentages exist in the national rules. D = "mellan C och E", B = "mellan A och C".
 * E requires that the criteria for E are met in the assessed parts.
 *
 * There are no separate national criteria for årskurs 7 (national criteria exist for årskurs 6
 * and 9), so the årskurs 9 criteria are the goal and are applied in proportion to what has been
 * taught in årskurs 7. This app only gives *practice* grades, never an official term grade.
 */
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
  /** Grades are a holistic judgement against the criteria, not an average or a point sum. */
  holisticJudgement: true,
  /** D sits between C and E, B between A and C (Skolverket's wording). */
  intermediateGrades: { D: ["C", "E"], B: ["A", "C"] },
  /**
   * Rough practice aid for CLOSED grammar/vocabulary exercises only. Skolverket sets no
   * percentages; this just turns "i huvudsak fungerande / fungerande / väl fungerande" into
   * something a model can apply consistently. Open writing never uses it.
   */
  closedExerciseThresholds: { A: 0.9, B: 0.8, C: 0.7, D: 0.6, E: 0.5 },
} as const;

/** Rough grade for a closed exercise from the share of correct answers (0–1). */
export function closedExerciseGrade(share: number): "A" | "B" | "C" | "D" | "E" | "F" {
  const t = CLASSROOM_ASSESSMENT.closedExerciseThresholds;
  if (share >= t.A) return "A";
  if (share >= t.B) return "B";
  if (share >= t.C) return "C";
  if (share >= t.D) return "D";
  if (share >= t.E) return "E";
  return "F";
}

/** Skolverket's betygskriterier (Lgr22, svenska, slutet av årskurs 9) for the parts a written task can show. */
const SKOLVERKET_CRITERIA = `OFFICIAL SKOLVERKET BETYGSKRITERIER, svenska, slutet av årskurs 9 (Lgr22) — the goal that årskurs 7 work is measured toward:

SKRIVA
- E: Eleven skriver olika slags texter med viss språklig variation, i huvudsak fungerande struktur och innehåll samt viss anpassning till texttyp, syfte, mottagare och sammanhang. Eleven följer språkliga normer på ett i huvudsak fungerande sätt.
- C: Eleven skriver olika slags texter med relativt god språklig variation, fungerande struktur och innehåll samt relativt god anpassning till texttyp, syfte, mottagare och sammanhang. Eleven följer språkliga normer på ett fungerande sätt.
- A: Eleven skriver olika slags texter med god språklig variation, väl fungerande struktur och innehåll samt god anpassning till texttyp, syfte, mottagare och sammanhang. Eleven följer språkliga normer på ett väl fungerande sätt.

LÄSA, SAMMANFATTA OCH RESONERA
- E: grundläggande läsförståelse; sammanfattar texter med viss säkerhet; för enkla resonemang om innehållet i olika texter.
- C: god läsförståelse; sammanfattar texter med god säkerhet; för utvecklade resonemang om innehållet i olika texter.
- A: mycket god läsförståelse; sammanfattar texter med mycket god säkerhet; för välutvecklade resonemang om innehållet i olika texter.

KÄLLOR OCH INFORMATION
- E: söker och väljer information med viss säkerhet och presenterar den på ett i huvudsak fungerande sätt med egna formuleringar; för till viss del underbyggda resonemang om källornas trovärdighet och relevans.
- C: relativt god säkerhet; presenterar informationen på ett fungerande sätt; för relativt väl underbyggda resonemang om trovärdighet och relevans.
- A: god säkerhet; presenterar informationen på ett väl fungerande sätt; för väl underbyggda resonemang om trovärdighet och relevans.

SPRÅK OCH SPRÅKBRUK
- E: för utifrån givna exempel enkla resonemang om språk och språkbruk. C: utvecklade resonemang. A: välutvecklade resonemang.

BETYGEN D OCH B: D = elevens kunskaper bedöms sammantaget vara mellan C och E. B = sammantaget mellan A och C.`;

export function year7AssessmentPrompt(): string {
  const policy = CLASSROOM_ASSESSMENT;
  const t = policy.closedExerciseThresholds;
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  return `ASSESSMENT CONTEXT:
- Subject: ${policy.subject}, Swedish grundskola årskurs ${policy.schoolYear}, ${policy.curriculum}. Not svenska som andraspråk and not a CEFR language exam.
- This is a PRACTICE grade for one task. Never claim it is the official term grade; a real subject grade is the teacher's holistic assessment of everything the pupil has shown.

${SKOLVERKET_CRITERIA}

HOW SKOLVERKET SAYS TO GRADE (follow this procedure):
1. Grading is a holistic judgement ("sammantagen bedömning"): set the grade that BEST MATCHES the pupil's knowledge as shown in this work. It is not a points sum, not an average of parts and not a percentage. Do not look for reasons to go up or down; decide what the evidence honestly matches.
2. Identify which criteria this task can show (e.g. skriva, läsa/resonera, språkliga normer). Assess ONLY those. Something the task cannot show (oral skills, a source search) is neither passed nor failed.
3. Judge each shown aspect by Skolverket's value words: E = viss / i huvudsak fungerande / grundläggande / enkla; C = relativt god / fungerande / god / utvecklade; A = god / väl fungerande / mycket god / välutvecklade.
4. E requires that the E-level is reached in every aspect the task shows. If a shown aspect is clearly below E (for example the text is not understandable, or most answers are wrong) the practice grade is F.
5. D = E is fully reached and C is reached to a considerable extent, but not fully ("mellan C och E"). B = C is fully reached and A is reached to a considerable extent ("mellan A och C"). A needs the A-level overall, not in just one aspect. C needs the C-level overall.
6. Use the value words in your explanation, so the pupil can see why the work lands where it does.

YEAR 7 CALIBRATION (our interpretation — firm but realistic):
- There are no national year-7 criteria. The årskurs 9 criteria above are the goal; judge how well this årskurs 7 pupil's work meets them for what has actually been taught and practised. Do not demand end-of-year-9 achievement, and do not hand out high grades just because the pupil is 13.
- Typical meanings for a 13-year-old: E = understandable text with a basic working structure (intro, content, ending), some variation in words and sentence openings, mostly follows spelling and punctuation norms even though errors occur. C = clear and well organised, relatively good variation (varied sentence openings, connectors, vocabulary), adapted to the text type and reader, norms followed so that errors are few and rarely disturb. A = varied and well-built, clearly adapted, norms followed very well with only occasional slips, with well-developed ideas.
- Language norms (spelling, punctuation, grammar, word order, en/ett, verb forms) are an actual criterion in all written work, so recurring errors DO count: weigh them by how often they occur and whether they disturb the reader. A still does not require error-free work.
- A is clearly strong work for the level, not the default for a decent attempt. C is a good, solid result. E is acceptable but simple. Do not inflate, and do not punish: the grade should be what an experienced, fair årskurs 7 teacher would honestly give.
- Closed exercises (grammar, vocabulary, translation, word classes, fill in the blanks, conjugation, en/ett) mostly show "följer språkliga normer" and "urskilja språkliga strukturer". Count answers that are valid in context as correct even if the answer key words it differently, and give half credit to answers that are partly right. As a ROUGH aid only (not a rule): A at about ${pct(t.A)} correct, B ${pct(t.B)}, C ${pct(t.C)}, D ${pct(t.D)}, E ${pct(t.E)}, F below. If the share correct and the nature of the errors point in different directions (e.g. errors are all the same misunderstanding vs. random slips), use judgement.
- Open writing (story, letter, opinion text, dialogue, poem, summaries, short answers): judge the whole text against the SKRIVA and LÄSA criteria above. The task deliberately leaves freedom, so do not demand things it never asked for; but quality of language, structure, variation and adaptation to the task still decide the grade. If the text is clearly shorter than asked, it gives less evidence: mention it and let it affect structure/innehåll as it honestly does, without an automatic ceiling.
- Too little to assess (almost nothing submitted) is NOT automatically F: ask for the missing work and do not emit a grade marker.
- Feedback: say the grade, explain it with the value words (which criteria, at which level, and what separates it from the next grade up), name the one or two most useful errors with the correct form, and end with one concrete next step. Honest and encouraging, never invent evidence.`;
}
