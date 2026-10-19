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
 * Årskurs 7 (Skolverket, "Terminsbetyg"): there are no betygskriterier for årskurs 7. The term grade
 * rests on the pupil's knowledge at the time, the årskurs 9 criteria, and what the teaching has given
 * the pupil the chance to develop (untaught parts are not counted). All grade steps A–F are possible
 * every term, but the requirements are adapted: somewhat lower ("lite lägre krav") than in årskurs 9.
 * The "all parts of E must be shown" rule applies to final grades at the end of årskurs 6 and 9.
 * This app only gives *practice* grades, never an official term grade.
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
  /** Skolverket: every grade step A–F is possible in årskurs 7, with requirements adapted to the year. */
  allGradeStepsPossible: true,
  /** Skolverket: slightly lower requirements in årskurs 7–8 than in årskurs 9 (not much lower). */
  requirementsSlightlyLowerThanYear9: true,
  /** Never steer toward or away from a particular grade (D included); grade what the work deserves. */
  neverSteerTowardAGrade: true,
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
1. Grading is a holistic judgement ("sammantagen bedömning"): set the grade that BEST MATCHES the pupil's knowledge as shown in this work. It is not a points sum, not an average of parts and not a percentage.
2. Identify which criteria this task can show (e.g. skriva, läsa/resonera, språkliga normer). Assess ONLY those. Something the task cannot show (oral skills, a source search) is neither passed nor failed.
3. Judge each shown aspect by Skolverket's value words: E = viss / i huvudsak fungerande / grundläggande / enkla; C = relativt god / fungerande / god / utvecklade; A = god / väl fungerande / mycket god / välutvecklade.
4. If a shown aspect is clearly below E (for example the text is not understandable, or most answers are wrong) the practice grade is F.
5. D = the work is clearly above E but does not fully reach C ("mellan C och E"). B = the work is clearly above C but does not fully reach A ("mellan A och C"). A needs the A-level overall, not in just one aspect. C needs the C-level overall. D and B are completely ordinary grades: use them whenever they are what the work matches.
6. GIVE EVERY GRADE ITS DUE. Grade exactly what the work deserves — A, B, C, D, E or F. Never steer toward or away from any particular grade, never "round up" to be kind and never "round down" to be strict.
7. Use the value words in your explanation, so the pupil can see why the work lands where it does.

HOW ÅRSKURS 7 WORKS (official Skolverket guidance for terminsbetyg):
- There are no betygskriterier for årskurs 7. The grade is based on what the pupil knows now, measured against the årskurs 9 criteria above, and on what the teaching has given the pupil the chance to develop. Parts of the criteria that have not been taught are not counted.
- ALL grade steps A–F are possible in årskurs 7 (even an A in the first term), but the requirements are adapted to the year: Skolverket says to demand somewhat lower ("lite lägre") requirements in årskurs 7 than in årskurs 9 for what e.g. "ett enkelt resonemang" or "ett komplext samband" means. Somewhat lower is not much lower: the value words stay the standard, and a fair year-7 teacher still expects real quality for a high grade.
- The strict rule that every part of E must be shown applies to final grades at the end of årskurs 6 and 9. For this årskurs 7 practice grade, assess the parts this task can show and that have been taught.

YEAR 7 CALIBRATION (our interpretation of the value words for a 13-year-old):
- E = understandable text with a basic working structure (intro, content, ending), some variation in words and sentence openings, mostly follows spelling and punctuation norms even though errors occur. C = clear and well organised, relatively good variation (varied sentence openings, connectors, vocabulary), adapted to the text type and reader, norms followed so that errors are few and rarely disturb. A = varied and well-built, clearly adapted, norms followed very well with only occasional slips, with well-developed ideas.
- Language norms (spelling, punctuation, grammar, word order, en/ett, verb forms) are an actual criterion in all written work, so recurring errors DO count: weigh them by how often they occur and whether they disturb the reader. A still does not require error-free work.
- Do not demand year-9 level, and do not give high grades just because the pupil is 13. The grade should be what an experienced, fair årskurs 7 teacher would honestly give.
- Closed exercises (grammar, vocabulary, translation, word classes, fill in the blanks, conjugation, en/ett) mostly show "följer språkliga normer" and "urskilja språkliga strukturer". Count answers that are valid in context as correct even if the answer key words it differently, and give half credit to answers that are partly right. As a ROUGH aid only (not a rule): A at about ${pct(t.A)} correct, B ${pct(t.B)}, C ${pct(t.C)}, D ${pct(t.D)}, E ${pct(t.E)}, F below. If the share correct and the nature of the errors point in different directions (e.g. all errors are the same misunderstanding vs. random slips), use judgement.
- Open writing (story, letter, opinion text, dialogue, poem, summaries, short answers): judge the whole text against the SKRIVA and LÄSA criteria above. The task deliberately leaves freedom, so do not demand things it never asked for; but quality of language, structure, variation and adaptation to the task still decide the grade. If the text is clearly shorter than asked, it gives less evidence: mention it and let it affect structure/innehåll as it honestly does, without an automatic ceiling.
- Too little to assess (almost nothing submitted) is NOT automatically F: ask for the missing work and do not emit a grade marker.
- Feedback: say the grade, explain it with the value words (which criteria, at which level, and what separates it from the next grade up), name the one or two most useful errors with the correct form, and end with one concrete next step. Honest and encouraging, never invent evidence.`;
}

/** Added to the teacher's instructions for oral (muntliga) assignments. */
export function oralAssessmentPrompt(): string {
  return `ORAL TASK — HOW TO ASSESS IT HERE:
Skolverket's betygskriterier for muntliga framställningar (slutet av årskurs 9, the goal for årskurs 7):
- E: Eleven framför åsikter med till viss del underbyggda argument. Dessutom förbereder och genomför eleven muntliga framställningar med i huvudsak fungerande struktur och innehåll och viss anpassning till syfte, mottagare och sammanhang.
- C: Eleven framför åsikter med relativt väl underbyggda argument. Dessutom förbereder och genomför eleven muntliga framställningar med fungerande struktur och innehåll och relativt god anpassning till syfte, mottagare och sammanhang.
- A: Eleven framför åsikter med väl underbyggda argument. Dessutom förbereder och genomför eleven muntliga framställningar med väl fungerande struktur och innehåll och god anpassning till syfte, mottagare och sammanhang.
Central content (årskurs 7–9): muntliga presentationer och muntligt berättande för olika mottagare; anpassning av språk, innehåll och disposition till syfte, mottagare och sammanhang; talmanus och olika verktyg (med eller utan digital teknik) för att planera och genomföra.
(Skolverket's criteria for samtal and diskussion are not assessed here: this is a prepared presentation, speech or story.)

RULES FOR THIS ORAL TASK:
- The evidence is: an automatic speech-to-text TRANSCRIPT, the slide contents (if any), the time used and the speaking pace. The transcript has no punctuation or paragraphs and can contain recognition errors (wrong words, names, missing words). These are NOT the pupil's mistakes: do not assess spelling or punctuation, and do not count misheard words as language errors. If a passage makes no sense because it is probably misheard, ignore it.
- Assess: struktur (inledning, innehåll, avslutning), innehåll (relevant, enough substance, examples), anpassning till syfte och mottagare (does the pupil speak to an audience, with suitable language), språklig variation and clarity as far as the transcript shows it, and for opinion tasks whether the reasons are underbyggda with examples. Slides are a support: judge whether they help the talk, not how pretty they look; reading slide text out word by word is weaker than explaining it.
- Voice, intonation, volume, eye contact and body language cannot be assessed here. Say so in one sentence in your feedback. Do not guess about them and do not lower the grade for them.
- Time: within about 70–130 % of the target time fits. Clearly too short means less evidence of structure and content: mention it and let it affect those aspects honestly, without an automatic ceiling. Pace is only a gentle remark (about 110–170 words per minute is normal); the transcript cannot show pauses.
- If the transcript is empty or only a few words, ask the pupil to do it again and do NOT give a grade marker.
- Apply the same procedure, the year-7 calibration and the same rule as for written work: a holistic judgement, every grade A–F given exactly as deserved, and the value words used in the explanation.
- Feedback: the grade explained with the value words, one real strength, one concrete thing to improve next time (for example a stronger opening, a clearer ending, or linking each reason to an example), and what could not be assessed.`;
}
