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

// Extract a short one-liner for use in games
export function shortMeaning(full: string): string {
  const match = full.match(/(?:Betydelse|Definition|English|ENGLISH|Translation):\s*(.+)/i);
  if (match) return match[1].trim().replace(/\*+/g, "").slice(0, 120);
  const lines = full.split("\n").map(l => l.replace(/\*+/g, "").trim()).filter(l => l.length > 8);
  return (lines[0] ?? full).slice(0, 120);
}

export const MODE_LABEL: Record<DictMode, string> = {
  "sv-sv": "SV → SV",
  "sv-en": "SV → EN",
  "en-sv": "EN → SV",
};
