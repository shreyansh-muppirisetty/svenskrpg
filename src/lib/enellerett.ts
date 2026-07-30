const STORE = "svenska-quest-enellerett-v1";
const MODEL = "gemini-3.1-flash-lite";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export interface EttWord {
  id: string;
  word: string;        // bare noun, e.g. "hund"
  correct: "en" | "ett";
  addedAt: number;
}

export function loadEttWords(): EttWord[] {
  try { const r = localStorage.getItem(STORE); return r ? JSON.parse(r) : []; } catch { return []; }
}

export function saveEttWord(word: string, correct: "en" | "ett") {
  try {
    const words = loadEttWords();
    const id = word.toLowerCase().trim();
    const entry: EttWord = { id, word: word.trim(), correct, addedAt: Date.now() };
    const idx = words.findIndex(w => w.id === id);
    if (idx >= 0) words[idx] = entry; else words.unshift(entry);
    localStorage.setItem(STORE, JSON.stringify(words));
  } catch {}
}

export function deleteEttWord(id: string) {
  try {
    const words = loadEttWords().filter(w => w.id !== id);
    localStorage.setItem(STORE, JSON.stringify(words));
  } catch {}
}

// Run after any graded student text — fires-and-forgets, no await needed at call site
export async function detectAndSaveEnEtt(key: string, studentText: string) {
  if (!key || !studentText.trim()) return;
  try {
    const res = await fetch(`${API_BASE}/${MODEL}:generateContent?key=${key}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text:
          `In this Swedish student text, find nouns where en/ett is used incorrectly. Only clear errors.
Text: "${studentText.slice(0, 2000)}"
Return ONLY a JSON array: [{"word":"hund","correct":"en"}] — or [] if none. No other text.`
        }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 200 },
      }),
    });
    if (!res.ok) return;
    const d = await res.json();
    const raw = d.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start === -1) return;
    const errors: Array<{ word: string; correct: "en" | "ett" }> = JSON.parse(raw.slice(start, end + 1));
    errors.forEach(e => saveEttWord(e.word, e.correct));
  } catch {}
}
