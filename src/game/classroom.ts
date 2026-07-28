export type Challenge = {
  /** What the teacher says, in Swedish */
  npc: string;
  /** English hint for what you must say */
  task: string;
  /** Grammar rule being drilled */
  rule: "questions" | "v2";
  /** Tile mode: shuffled words to arrange. Type mode: free text. */
  mode: "tiles" | "type";
  answer: string;
  /** Extra accepted answers (normalised) */
  alt?: string[];
  /** Shown when you get it wrong */
  hint: string;
};

export const CHALLENGES: Challenge[] = [
  {
    npc: "Hej! Välkommen till klassen. Vad heter du?",
    task: "Say: My name is Alex.",
    rule: "questions",
    mode: "tiles",
    answer: "jag heter Alex",
    hint: "Subject – verb – rest. Jag (subject) comes first here.",
  },
  {
    npc: "Trevligt! Och varifrån kommer du?",
    task: "Say: I come from England.",
    rule: "questions",
    mode: "tiles",
    answer: "jag kommer från England",
    hint: "Jag kommer … the verb stays in second position.",
  },
  {
    npc: "Nu får du fråga mig något. Fråga vad jag heter.",
    task: "Ask: What is your name? (formal 'du')",
    rule: "questions",
    mode: "type",
    answer: "vad heter du",
    alt: ["vad heter du?"],
    hint: "Question word first, then the verb, then the subject: Vad heter du?",
  },
  {
    npc: "Bra. Fråga nu om jag talar engelska.",
    task: "Ask: Do you speak English? (yes/no question)",
    rule: "questions",
    mode: "type",
    answer: "talar du engelska",
    alt: ["talar du engelska?"],
    hint: "Yes/no questions start with the verb: Talar du engelska?",
  },
  {
    npc: "Vi börjar med grammatik. Igår … vad gjorde du igår?",
    task: "Say: Yesterday I read a book. (start with 'Igår')",
    rule: "v2",
    mode: "tiles",
    answer: "igår läste jag en bok",
    hint: "Something before the verb pushes the subject after it: Igår läste jag …",
  },
  {
    npc: "Och på morgonen? Vad gör du då?",
    task: "Say: In the morning I drink coffee. (start with 'På morgonen')",
    rule: "v2",
    mode: "tiles",
    answer: "på morgonen dricker jag kaffe",
    hint: "V2: the verb must be the second element, so the subject moves behind it.",
  },
  {
    npc: "Nu utan hjälp. Säg att du idag studerar svenska — börja med 'Idag'.",
    task: "Type: Today I study Swedish. (start with 'Idag')",
    rule: "v2",
    mode: "type",
    answer: "idag studerar jag svenska",
    hint: "Idag studerar jag svenska — verb second, subject third.",
  },
  {
    npc: "Bra jobbat. Nu: i skolan … vad talar vi?",
    task: "Say: At school we speak Swedish. (start with 'I skolan')",
    rule: "v2",
    mode: "tiles",
    answer: "i skolan talar vi svenska",
    hint: "I skolan talar vi … — inversion again.",
  },
  {
    npc: "En sista fråga till mig, tack. Fråga när lektionen börjar.",
    task: "Ask: When does the lesson start?",
    rule: "questions",
    mode: "type",
    answer: "när börjar lektionen",
    alt: ["när börjar lektionen?"],
    hint: "När börjar lektionen? — question word, verb, subject.",
  },
  {
    npc: "Sista. Säg att du imorgon kommer till skolan.",
    task: "Type: Tomorrow I am coming to school. (start with 'Imorgon')",
    rule: "v2",
    mode: "type",
    answer: "imorgon kommer jag till skolan",
    hint: "Imorgon kommer jag till skolan — never 'Imorgon jag kommer'.",
  },
];

const normalise = (s: string) =>
  s
    .toLowerCase()
    .replace(/[.,!?]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export function isCorrect(input: string, c: Challenge) {
  const got = normalise(input);
  return [c.answer, ...(c.alt ?? [])].some((a) => normalise(a) === got);
}

/** Deterministic-ish shuffle so SSR and client agree per index. */
export function tilesFor(c: Challenge, seed: number) {
  const words = c.answer.split(" ");
  const out = [...words];
  let s = seed * 9301 + 49297;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  // avoid handing the player the answer already solved
  if (out.join(" ") === words.join(" ") && out.length > 1) {
    [out[0], out[1]] = [out[1], out[0]];
  }
  return out;
}

export const GRADES = ["D", "C", "B", "A"] as const;

export function gradeFor(cleared: number, total: number) {
  const r = cleared / total;
  if (r >= 1) return "A";
  if (r >= 0.66) return "B";
  if (r >= 0.33) return "C";
  return "D";
}

// ponytail: tiny self-check, run with `bun src/game/classroom.ts`
if (import.meta.main) {
  const c = CHALLENGES[0];
  console.assert(isCorrect("Jag heter Alex.", c), "punctuation/case should pass");
  console.assert(!isCorrect("heter jag Alex", c), "wrong order should fail");
  console.assert(isCorrect("vad heter du?", CHALLENGES[2]), "alt answer should pass");
  console.assert(tilesFor(c, 3).length === 3, "tiles count");
  console.assert(gradeFor(10, 10) === "A" && gradeFor(0, 10) === "D", "grades");
  console.log("ok");
}
