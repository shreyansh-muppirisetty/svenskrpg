import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { saveHardWord, type DictMode } from "@/lib/hardwords";

const MODEL = "gemini-3.1-flash-lite";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const noCorr = { spellCheck: false, autoCorrect: "off", autoCapitalize: "off", autoComplete: "off" } as const;

function buildPrompt(q: string, mode: DictMode): string {
  if (mode === "sv-sv")
    return `Du är en svensk ordbok. Slå upp: "${q}". Ge: ORDKLASS, DEFINITION (på enkel svenska), BÖJNING (viktiga former), EXEMPEL (en mening), SYNONYMER (2-3). Kortfattad.`;
  if (mode === "sv-en")
    return `You are a Swedish-to-English school dictionary for Year 7/8 students. Translate the Swedish word or phrase: "${q}". Reply in English. Give: ENGLISH (translation), WORD CLASS, DEFINITION (simple English), EXAMPLE (one natural English sentence), SIMILAR WORDS (2-3 English synonyms).`;
  return `Swedish dictionary. Translate English: "${q}". Give: SVENSKA (translation), ORDKLASS, DEFINITION (in simple Swedish), EXEMPEL (both languages), SYNONYMER. Answer in Swedish.`;
}

export function DictionaryPanel({ apiKey }: { apiKey: string }) {
  const [mode, setMode] = useState<DictMode>("sv-sv");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function lookup() {
    const q = query.trim();
    if (!q || loading) return;
    setLoading(true); setResult(""); setError(""); setSaved(false);
    try {
      const res = await fetch(`${API_BASE}/${MODEL}:generateContent?key=${apiKey}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: buildPrompt(q, mode) }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 400 },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      const text = d.candidates?.[0]?.content?.parts?.[0]?.text ?? "(inget svar)";
      setResult(text);
      saveHardWord(q, mode, text);
      setSaved(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Fel"); }
    finally { setLoading(false); }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1">
        {([ ["sv-sv", "SV → SV"], ["sv-en", "SV → EN"], ["en-sv", "EN → SV"] ] as [DictMode, string][]).map(([m, label]) => (
          <button key={m}
            onClick={() => { setMode(m); setResult(""); setQuery(""); setSaved(false); setTimeout(() => inputRef.current?.focus(), 50); }}
            className={`rounded-sm border-2 border-border px-3 py-1.5 font-pixel text-[9px] transition-colors ${mode === m ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-secondary/60"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && lookup()}
          placeholder={mode === "en-sv" ? "Search an English word…" : "Sök ett svenskt ord…"}
          disabled={loading} {...noCorr}
          className="flex-1 rounded-sm border-2 border-border bg-secondary/50 px-3 py-2 text-base outline-none focus:border-ring disabled:opacity-50" />
        <button onClick={lookup} disabled={loading || !query.trim()}
          className="rounded-sm border-2 border-border bg-accent px-4 py-2 font-pixel text-[9px] text-accent-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none disabled:opacity-50">
          {loading ? "…" : "SLÅ UPP"}
        </button>
      </div>
      {error && <p className="font-pixel text-[9px] text-destructive">✗ {error}</p>}
      {result && (
        <div className="rounded-sm bg-secondary/40 p-4 text-base leading-relaxed prose prose-sm max-w-none">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-pixel text-[9px] text-muted-foreground">
              {mode === "sv-sv" ? "🇸🇪 SV → SV" : mode === "sv-en" ? "🇸🇪 SV → 🇬🇧 EN" : "🇬🇧 EN → SV"} — {query}
            </span>
            {saved && <span className="font-pixel text-[8px] text-emerald-600 shrink-0">✓ sparat i svåra ord</span>}
          </div>
          <ReactMarkdown>{result}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
