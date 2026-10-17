/** Swedish punctuation conventions used for both generation and assessment. */
export const PUNCTUATION_RULES = {
  schoolYear: 7,
  requireCommaBeforeAtt: false,
  requireCommaAroundEverySubordinateClause: false,
  hyphenateOrdinaryCompounds: false,
  useApostropheForOrdinaryGenitive: false,
  acceptValidAlternatives: true,
} as const;

export function punctuationGuidance(): string {
  const rules = PUNCTUATION_RULES;
  return `SWEDISH PUNCTUATION RULES — årskurs ${rules.schoolYear}:
- ${rules.requireCommaBeforeAtt ? "Require" : "Do not require"} a comma before every att-clause. "Jag tror att det regnar." is correct without a comma.
- ${rules.requireCommaAroundEverySubordinateClause ? "Require" : "Do not require"} commas around every subordinate clause. Swedish uses clarity-based punctuation, not mandatory grammatical commas: "När jag kom hem åt jag middag." is valid without a comma.
- ${rules.hyphenateOrdinaryCompounds ? "Hyphenate" : "Do not hyphenate"} ordinary Swedish compound words: "skolgård" is correct, not "skol-gård". A hyphen may be appropriate in e.g. "EU-land"; do not confuse this with ordinary compounds.
- ${rules.useApostropheForOrdinaryGenitive ? "Use" : "Do not use"} an apostrophe for an ordinary Swedish genitive: "Annas bok", not "Anna's bok". Do not invent errors involving names ending in s, x or z.
- ${rules.acceptValidAlternatives ? "Accept" : "Reject"} legitimate punctuation alternatives when they preserve meaning and readability, including suitable sentence breaks, consistent dialogue quotation marks or dialogue dashes, and meaningful colon/semicolon choices. An optional stylistic comma is not an objective error.
- Distinguish actual punctuation errors from stylistic preferences. Explain genuine errors with the sentence context; never enforce an English punctuation convention on Swedish text.
- This guidance overrides conflicting instructions or answer-key claims when correcting or grading.`;
}

export function punctuationAssignmentPrompt(): string {
  return `Create a Swedish punctuation exercise for årskurs ${PUNCTUATION_RULES.schoolYear}.
${punctuationGuidance()}
Write a coherent, age-appropriate paragraph of 6–8 sentences about school or everyday life. First establish a correctly punctuated version, then introduce 6–8 clear punctuation errors. Use sentence-ending periods, question marks for direct questions, commas separating list items, colon before an announced list, and consistent dialogue punctuation. Do not force every category into the text.
Keep spelling, grammar and words otherwise correct. Do not count stylistic choices as errors or manufacture dubious errors to meet a quota. Count only the genuine errors you actually introduced and use that same number in the instructions and answer key. Do not require advanced semicolon rules.
Return ONLY valid JSON with this shape (replace placeholders):
{"type":"correct_punctuation","title":"Rätta skiljetecknen","instructions":"Texten innehåller [N] skiljeteckenfel. Skriv en rättad version och förklara kort dina ändringar. Flera korrekta lösningar kan vara möjliga.","text":"PARAGRAPH WITH ERRORS","answer_key":"One corrected version, a numbered explanation of each genuine error with its context, and any valid alternative corrections. Clearly distinguish optional stylistic improvements from errors."}`;
}