export const HARD_WORDS_STORE = "svenska-quest-hardwords-v1";

export type DictMode = "sv-sv" | "sv-en" | "en-sv";

export interface HardWord {
  id: string;
  word: string;
  mode: DictMode;
  meaning: string;
  addedAt: number;
}

export function loadHardWords(): HardWord[] {
  try { const r = localStorage.getItem(HARD_WORDS_STORE); return r ? JSON.parse(r) : []; }
  catch { return []; }
}

export function saveHardWord(word: string, mode: DictMode, meaning: string) {
  try {
    const words = loadHardWords();
    const id = `${word.toLowerCase().trim()}-${mode}`;
    const entry: HardWord = { id, word: word.trim(), mode, meaning, addedAt: Date.now() };
    const idx = words.findIndex(w => w.id === id);
    if (idx >= 0) words[idx] = entry; else words.unshift(entry);
    localStorage.setItem(HARD_WORDS_STORE, JSON.stringify(words));
  } catch {}
}

export function deleteHardWord(id: string) {
  try {
    const words = loadHardWords().filter(w => w.id !== id);
    localStorage.setItem(HARD_WORDS_STORE, JSON.stringify(words));
  } catch {}
}

// Prompt used by every lookup — forces a compact answer with a short gloss first
export function buildDictPrompt(q: string, mode: DictMode): string {
  const rule = `Första raden MÅSTE vara exakt: "GLOSS: <kort betydelse, max 5 ord, ingen punkt>". Sedan max 5 korta rader. Inga inledningar, ingen extra text, max 60 ord totalt.`;
  if (mode === "sv-sv")
    return `Du är en kortfattad svensk ordbok. Slå upp "${q}".\n${rule}\nRader efter GLOSS: ORDKLASS: ... / DEFINITION: (en mening, enkel svenska) / BÖJNING: ... / EXEMPEL: (en mening) / SYNONYMER: 2-3 ord.`;
  if (mode === "sv-en")
    return `You are a concise Swedish-to-English dictionary. Look up "${q}".\nFirst line MUST be exactly: "GLOSS: <English translation, max 5 words, no period>". Then max 5 short lines. No intro text, max 60 words total.\nLines after GLOSS: WORD CLASS: ... / DEFINITION: (one simple sentence) / EXAMPLE: (one sentence) / SIMILAR WORDS: 2-3 words.`;
  return `Du är en kortfattad engelsk-svensk ordbok. Översätt "${q}".\n${rule}\nRader efter GLOSS: ORDKLASS: ... / DEFINITION: (en mening, enkel svenska) / EXEMPEL: (en mening) / SYNONYMER: 2-3 ord.`;
}

// Clean short one-liner used by the quiz/match games
export function shortMeaning(full: string): string {
  const clean = (s: string) =>
    s.replace(/[*_`#>]/g, "").replace(/\s+/g, " ").replace(/^[-–:\s]+/, "").trim();

  const gloss = full.match(/^\s*GLOSS\s*[:\-]\s*(.+)$/im);
  let out = gloss ? clean(gloss[1]) : "";

  if (!out) {
    const m = full.match(/^\s*(?:ENGLISH|SVENSKA|TRANSLATION|BETYDELSE|DEFINITION)\s*[:\-]\s*(.+)$/im);
    if (m) out = clean(m[1]);
  }
  if (!out) {
    const line = full.split("\n").map(clean).find(l => l.length > 2);
    out = line ?? "";
  }
  // keep it short: first clause, max 8 words / 60 chars
  out = out.split(/[.;(]/)[0].trim();
  const words = out.split(" ").slice(0, 8).join(" ");
  return (words.length > 60 ? words.slice(0, 60).trim() : words) || "?";
}

// Full text including the GLOSS line so users can memorize the definition
export function displayMeaning(full: string): string {
  return full.trim();
}

export const MODE_LABEL: Record<DictMode, string> = {
  "sv-sv": "SV → SV",
  "sv-en": "SV → EN",
  "en-sv": "EN → SV",
};

