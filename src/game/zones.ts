export type Challenge = {
  /** What the NPC says, in Swedish */
  npc: string;
  /** English hint for what you must say */
  task: string;
  /** Grammar rule being drilled */
  rule: "questions" | "v2" | "gender" | "modal" | "bisats";
  /** Tile mode: shuffled words to arrange. Type mode: free text. */
  mode: "tiles" | "type";
  answer: string;
  /** Extra accepted answers (normalised) */
  alt?: string[];
  /** Shown when you get it wrong */
  hint: string;
};

export type Zone = {
  id: string;
  name: string;
  npc: string;
  /** One-line pitch shown on the map */
  blurb: string;
  /** Seconds per line; 0 = no pressure */
  timeLimit: number;
  intro: string;
  outro: string;
  challenges: Challenge[];
};

export const ZONES: Zone[] = [
  {
    id: "klassrummet",
    name: "Klassrummet",
    npc: "Fröken Grammatik",
    blurb: "Frågeordföljd + V2. Din första lektion.",
    timeLimit: 0,
    intro: "Nya eleven. Sätt dig. Vi ska prata — på svenska.",
    outro: "Godkänt. Du överlevde lektionen. Matsalen väntar.",
    challenges: [
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
        task: "Ask: What is your name?",
        rule: "questions",
        mode: "type",
        answer: "vad heter du",
        hint: "Question word first, then the verb, then the subject: Vad heter du?",
      },
      {
        npc: "Bra. Fråga nu om jag talar engelska.",
        task: "Ask: Do you speak English? (yes/no question)",
        rule: "questions",
        mode: "type",
        answer: "talar du engelska",
        hint: "Yes/no questions start with the verb: Talar du engelska?",
      },
      {
        npc: "Vi börjar med grammatik. Vad gjorde du igår?",
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
        npc: "Nu utan hjälp. Säg att du idag studerar svenska.",
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
    ],
  },
  {
    id: "matsalen",
    name: "Matsalen",
    npc: "Kökschefen Berit",
    blurb: "V2 under press. Kön rör sig. Berit väntar inte.",
    timeLimit: 12,
    intro: "Nästa! Jag har hundra elever kvar. Prata fort.",
    outro: "Du fick mat. Knappt. Nästa gång: snabbare.",
    challenges: [
      {
        npc: "Ja? Vad vill du ha?",
        task: "Say: I would like fish, please.",
        rule: "modal",
        mode: "tiles",
        answer: "jag vill ha fisk tack",
        hint: "Vill ha = would like. Jag vill ha …",
      },
      {
        npc: "Fisk är slut. Idag …?",
        task: "Say: Today I take the soup. (start with 'Idag')",
        rule: "v2",
        mode: "tiles",
        answer: "idag tar jag soppan",
        hint: "Idag tar jag … — verb second.",
      },
      {
        npc: "Bröd?",
        task: "Ask: Can I get bread too?",
        rule: "modal",
        mode: "type",
        answer: "kan jag få bröd också",
        hint: "Kan jag få …? — modal verb first in a yes/no question.",
      },
      {
        npc: "Var vill du sitta?",
        task: "Say: Over there I see a free table. (start with 'Där borta')",
        rule: "v2",
        mode: "tiles",
        answer: "där borta ser jag ett ledigt bord",
        hint: "Där borta ser jag … — inversion after the adverb.",
      },
      {
        npc: "Du glömde något!",
        task: "Say: Now I must take a fork. (start with 'Nu')",
        rule: "v2",
        mode: "type",
        answer: "nu måste jag ta en gaffel",
        hint: "Nu måste jag ta … — the modal is the second element.",
      },
      {
        npc: "Smakar det bra?",
        task: "Say: The food tastes very good.",
        rule: "gender",
        mode: "tiles",
        answer: "maten smakar mycket bra",
        hint: "Mat → maten (definite en-word).",
      },
      {
        npc: "Vill du ha mer? Skynda!",
        task: "Say: No thanks, I am full.",
        rule: "modal",
        mode: "type",
        answer: "nej tack jag är mätt",
        hint: "Nej tack, jag är mätt.",
      },
      {
        npc: "Var lämnar man tallriken?",
        task: "Ask: Where do I leave the plate?",
        rule: "questions",
        mode: "type",
        answer: "var lämnar jag tallriken",
        hint: "Var lämnar jag …? — question word, verb, subject.",
      },
    ],
  },
  {
    id: "korridoren",
    name: "Korridoren",
    npc: "Vaktmästaren Olle",
    blurb: "En eller ett? Bestämd form. Olle rättar allt.",
    timeLimit: 15,
    intro: "Nyckel till skåpet? Först: säg det rätt. En eller ett, grabben.",
    outro: "Du fick nyckeln. Och lite grammatik på köpet.",
    challenges: [
      {
        npc: "Vad letar du efter?",
        task: "Say: I am looking for a locker. (skåp = ett-word)",
        rule: "gender",
        mode: "tiles",
        answer: "jag letar efter ett skåp",
        hint: "Skåp is an ett-word: ett skåp.",
      },
      {
        npc: "Vilket skåp?",
        task: "Say: The locker is green.",
        rule: "gender",
        mode: "tiles",
        answer: "skåpet är grönt",
        hint: "ett skåp → skåpet, and the adjective takes -t: grönt.",
      },
      {
        npc: "Har du en penna?",
        task: "Say: Yes, I have a pen. (penna = en-word)",
        rule: "gender",
        mode: "type",
        answer: "ja jag har en penna",
        hint: "Penna is an en-word: en penna.",
      },
      {
        npc: "Var är boken?",
        task: "Say: The book lies on the table.",
        rule: "gender",
        mode: "tiles",
        answer: "boken ligger på bordet",
        hint: "en bok → boken, ett bord → bordet.",
      },
      {
        npc: "Och dina saker?",
        task: "Say: I have two books and three pens.",
        rule: "gender",
        mode: "type",
        answer: "jag har två böcker och tre pennor",
        hint: "Plurals: bok → böcker, penna → pennor.",
      },
      {
        npc: "Vart ska du nu?",
        task: "Say: Now I am going to the classroom. (start with 'Nu')",
        rule: "v2",
        mode: "tiles",
        answer: "nu går jag till klassrummet",
        hint: "Nu går jag … — V2 again, always.",
      },
      {
        npc: "Fråga mig var toaletten är.",
        task: "Ask: Where is the toilet?",
        rule: "questions",
        mode: "type",
        answer: "var är toaletten",
        hint: "Var är toaletten? — verb second.",
      },
    ],
  },
  {
    id: "affaren",
    name: "Affären",
    npc: "Kassören Nils",
    blurb: "Artighet, modalverb och siffror. Kortet funkar inte.",
    timeLimit: 12,
    intro: "Hej hej. Är det allt? Kortet strular idag, förresten.",
    outro: "Du betalade. På svenska. Utan att peka.",
    challenges: [
      {
        npc: "Hej! Behöver du hjälp?",
        task: "Say: Yes, I need help.",
        rule: "modal",
        mode: "tiles",
        answer: "ja jag behöver hjälp",
        hint: "Jag behöver hjälp — subject, verb, object.",
      },
      {
        npc: "Vad söker du?",
        task: "Ask: Do you have milk?",
        rule: "questions",
        mode: "type",
        answer: "har du mjölk",
        hint: "Yes/no question: verb first — Har du mjölk?",
      },
      {
        npc: "Där borta. Något mer?",
        task: "Say: I would also like to buy bread.",
        rule: "modal",
        mode: "tiles",
        answer: "jag vill också köpa bröd",
        hint: "Modal + infinitive: vill köpa. Också goes after the finite verb.",
      },
      {
        npc: "Det blir 89 kronor.",
        task: "Ask: Can I pay by card?",
        rule: "modal",
        mode: "type",
        answer: "kan jag betala med kort",
        hint: "Kan jag betala …? — modal first in the question.",
      },
      {
        npc: "Kortet funkar inte, tyvärr.",
        task: "Say: Then I pay cash. (start with 'Då')",
        rule: "v2",
        mode: "tiles",
        answer: "då betalar jag kontant",
        hint: "Då betalar jag … — inversion after 'då'.",
      },
      {
        npc: "Kvitto?",
        task: "Say: No thanks, I do not need a receipt.",
        rule: "bisats",
        mode: "type",
        answer: "nej tack jag behöver inte ett kvitto",
        alt: ["nej tack jag behöver inget kvitto"],
        hint: "Inte goes after the finite verb in a main clause: jag behöver inte …",
      },
      {
        npc: "Ha en bra dag! Säg något trevligt tillbaka.",
        task: "Say: Thanks, see you later.",
        rule: "questions",
        mode: "tiles",
        answer: "tack vi ses senare",
        hint: "Vi ses senare — the standard sign-off.",
      },
    ],
  },
  {
    id: "festen",
    name: "Festen",
    npc: "Klasskompisen Saga",
    blurb: "Bisatser: att, för att, eftersom. Ordföljden byter regler.",
    timeLimit: 14,
    intro: "Äntligen! Kom in. Och snälla — prata inte som en lärobok.",
    outro: "Du pratade svenska hela kvällen. Ingen bytte till engelska. Det är segern.",
    challenges: [
      {
        npc: "Kul att du kom! Varför kom du så sent?",
        task: "Say: I came late because I studied Swedish.",
        rule: "bisats",
        mode: "tiles",
        answer: "jag kom sent eftersom jag studerade svenska",
        hint: "After eftersom the subordinate clause keeps subject before verb.",
      },
      {
        npc: "Gillar du festen?",
        task: "Say: I think that the party is nice.",
        rule: "bisats",
        mode: "tiles",
        answer: "jag tycker att festen är trevlig",
        hint: "att + subject + verb: … att festen är trevlig.",
      },
      {
        npc: "Vill du ha något att dricka?",
        task: "Say: I do not drink beer because I am driving.",
        rule: "bisats",
        mode: "type",
        answer: "jag dricker inte öl eftersom jag kör bil",
        hint: "Main clause: verb then inte. Subordinate: subject then verb.",
      },
      {
        npc: "Berätta något om dig.",
        task: "Say: When I was little I lived in Spain. (start with 'När')",
        rule: "bisats",
        mode: "tiles",
        answer: "när jag var liten bodde jag i Spanien",
        hint: "A leading subordinate clause counts as element one — verb next: … bodde jag …",
      },
      {
        npc: "Ska du stanna länge?",
        task: "Say: I do not know if I can stay.",
        rule: "bisats",
        mode: "type",
        answer: "jag vet inte om jag kan stanna",
        hint: "om + subject + verb: … om jag kan stanna.",
      },
      {
        npc: "Sista frågan. Varför lär du dig svenska?",
        task: "Say: I am learning Swedish because I live here.",
        rule: "bisats",
        mode: "type",
        answer: "jag lär mig svenska eftersom jag bor här",
        hint: "eftersom jag bor här — subject before verb in the bisats.",
      },
    ],
  },
];

export const RULE_LABEL: Record<Challenge["rule"], string> = {
  questions: "FRÅGOR",
  v2: "V2-REGELN",
  gender: "EN / ETT",
  modal: "MODALVERB",
  bisats: "BISATSER",
};

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

export function gradeFor(cleared: number, total: number) {
  const r = total ? cleared / total : 0;
  if (r >= 1) return "A";
  if (r >= 0.66) return "B";
  if (r >= 0.33) return "C";
  return "D";
}

export const SAVE_KEY = "svenska-quest-progress";

export type Save = { cleared: string[]; grades: Record<string, string> };

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { cleared: [], grades: {} };
    const p = JSON.parse(raw) as Save;
    return { cleared: p.cleared ?? [], grades: p.grades ?? {} };
  } catch {
    return { cleared: [], grades: {} };
  }
}

export function storeSave(s: Save) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    /* private mode: progress is just lost */
  }
}

export const ADMIN_UNLOCK_KEY = "svenska-quest-admin-unlock-all";

export function isAdminUnlocked(): boolean {
  try {
    return localStorage.getItem(ADMIN_UNLOCK_KEY) === "true";
  } catch {
    return false;
  }
}

/** A zone unlocks when the previous one has been cleared or if admin unlock is enabled. */
export function isUnlocked(index: number, cleared: string[], zones: Zone[] = ZONES, adminUnlockOverride?: boolean) {
  if (adminUnlockOverride ?? isAdminUnlocked()) return true;
  return index === 0 || cleared.includes(zones[index - 1].id);
}


// ponytail: tiny self-check, run with `bun src/game/zones.ts`
if (import.meta.main) {
  const c = ZONES[0].challenges[0];
  console.assert(isCorrect("Jag heter Alex.", c), "punctuation/case should pass");
  console.assert(!isCorrect("heter jag Alex", c), "wrong order should fail");
  console.assert(isCorrect("vad heter du?", ZONES[0].challenges[2]), "punctuation stripped");
  console.assert(tilesFor(c, 3).length === 3, "tiles count");
  console.assert(gradeFor(10, 10) === "A" && gradeFor(0, 10) === "D", "grades");
  console.assert(isUnlocked(0, []) && !isUnlocked(1, []), "gating");
  console.assert(isUnlocked(1, ["klassrummet"]), "unlock after clear");
  console.assert(
    ZONES.every((z) => z.challenges.length > 0),
    "every zone has content",
  );
  console.log("ok");
}
