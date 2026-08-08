import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { loadHardWords, deleteHardWord, saveHardWord, shortMeaning, displayMeaning, buildDictPrompt, MODE_LABEL, type HardWord, type DictMode } from "@/lib/hardwords";

const MODEL = "gemini-3.1-flash-lite";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const KEY_STORE = "svenska-quest-classroom-gemini-key";
const noCorr = { spellCheck: false, autoCorrect: "off", autoCapitalize: "off", autoComplete: "off" } as const;

function loadKey() { try { return localStorage.getItem(KEY_STORE) ?? ""; } catch { return ""; } }

// ── Types ─────────────────────────────────────────────────────────────────────

type Screen = "browse" | "quiz" | "match";

interface QuizQuestion {
  word: HardWord;
  options: string[];      // 4 short meanings
  correctIdx: number;
}
interface QuizState {
  questions: QuizQuestion[];
  current: number;
  selected: number | null;
  score: number;
  done: boolean;
}

interface MatchPair { id: string; word: string; meaning: string }
interface MatchState {
  pairs: MatchPair[];           // left column (fixed order)
  rightOrder: MatchPair[];      // right column (shuffled)
  selectedLeft: string | null;
  matched: string[];            // IDs of completed pairs
  wrong: string[];              // IDs flashing red
  attempts: number;
  correct: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] { return [...arr].sort(() => Math.random() - 0.5); }

function buildQuiz(words: HardWord[]): QuizQuestion[] {
  return shuffle(words).map(w => {
    const distractors = shuffle(words.filter(x => x.id !== w.id))
      .slice(0, 3)
      .map(x => shortMeaning(x.meaning));
    const correctIdx = Math.floor(Math.random() * 4);
    const options = [...distractors];
    options.splice(correctIdx, 0, shortMeaning(w.meaning));
    return { word: w, options, correctIdx };
  });
}

function buildMatch(words: HardWord[]): MatchState {
  const batch = shuffle(words).slice(0, 4);
  const pairs: MatchPair[] = batch.map(w => ({ id: w.id, word: w.word, meaning: shortMeaning(w.meaning) }));
  return { pairs, rightOrder: shuffle(pairs), selectedLeft: null, matched: [], wrong: [], attempts: 0, correct: 0 };
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function HardWords({ onExit }: { onExit: () => void }) {
  const [words, setWords] = useState<HardWord[]>(() => loadHardWords());
  const [screen, setScreen] = useState<Screen>("browse");
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [match, setMatch] = useState<MatchState | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  function refresh() { setWords(loadHardWords()); }

  function goBack() {
    setScreen("browse");
    setQuiz(null);
    setMatch(null);
  }

  function startQuiz() {
    setQuiz({ questions: buildQuiz(words), current: 0, selected: null, score: 0, done: false });
    setScreen("quiz");
  }

  function startMatch() {
    setMatch(buildMatch(words));
    setScreen("match");
  }

  function handleAdd(word: string, mode: DictMode, meaning: string) {
    saveHardWord(word, mode, meaning);
    refresh();
  }

  function handleDelete(id: string) {
    deleteHardWord(id);
    refresh();
    if (expanded === id) setExpanded(null);
  }

  const canPlay = words.length >= 4;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="pixel-panel flex items-center justify-between rounded-sm bg-card p-4">
        <div>
          <p className="font-pixel text-[11px] text-primary">SVÅRA ORD</p>
          <p className="text-sm text-muted-foreground">{words.length} ord sparade</p>
        </div>
        <div className="flex gap-2">
          {screen !== "browse" && (
            <button onClick={goBack}
              className="rounded-sm border-2 border-border bg-card px-3 py-1.5 font-pixel text-[9px] shadow-pixel-sm active:translate-y-0.5 active:shadow-none">
              ← LISTA
            </button>
          )}
          <button onClick={onExit}
            className="rounded-sm border-2 border-border bg-card px-3 py-1.5 font-pixel text-[9px] shadow-pixel-sm active:translate-y-0.5 active:shadow-none">
            KARTAN
          </button>
        </div>
      </div>

      {screen === "browse" && (
        <BrowseScreen
          words={words} expanded={expanded} canPlay={canPlay}
          onExpand={id => setExpanded(prev => prev === id ? null : id)}
          onDelete={handleDelete}
          onQuiz={startQuiz} onMatch={startMatch}
          onAdd={handleAdd}
        />
      )}

      {screen === "quiz" && quiz && (
        <QuizScreen state={quiz} onChange={setQuiz} onBack={goBack} onRestart={startQuiz} />
      )}

      {screen === "match" && match && (
        <MatchScreen
          state={match} onChange={setMatch}
          onRematch={() => setMatch(buildMatch(words))}
          onBack={goBack}
        />
      )}
    </div>
  );
}

// ── Browse ────────────────────────────────────────────────────────────────────

function BrowseScreen({ words, expanded, canPlay, onExpand, onDelete, onQuiz, onMatch, onAdd }: {
  words: HardWord[]; expanded: string | null; canPlay: boolean;
  onExpand: (id: string) => void; onDelete: (id: string) => void;
  onQuiz: () => void; onMatch: () => void;
  onAdd: (word: string, mode: DictMode, meaning: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [word, setWord] = useState("");
  const [mode, setMode] = useState<DictMode>("sv-sv");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const key = loadKey();

  async function lookupAndAdd() {
    const q = word.trim();
    if (!q || loading || !key) return;
    setLoading(true); setErr("");
    try {
      const res = await fetch(`${API_BASE}/${MODEL}:generateContent?key=${key}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: buildDictPrompt(q, mode) }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 220 } }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      const meaning = d.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (!meaning) throw new Error("Inget svar");
      onAdd(q, mode, meaning);
      setWord(""); setShowForm(false);
    } catch (e) { setErr(e instanceof Error ? e.message : "Fel"); }
    finally { setLoading(false); }
  }

  function save() { lookupAndAdd(); }
  return (
    <div className="flex flex-col gap-3">
      {/* Add word form */}
      <div className="pixel-panel rounded-sm bg-card overflow-hidden">
        <button onClick={() => setShowForm(s => !s)}
          className="w-full flex items-center justify-between px-4 py-3 font-pixel text-[9px] text-muted-foreground hover:bg-secondary/30 transition-colors">
          <span>+ LÄGG TILL ORD MANUELLT</span>
          <span>{showForm ? "▲" : "▼"}</span>
        </button>
        {showForm && (
          <div className="border-t-2 border-border p-4 flex flex-col gap-3">
            <div className="flex gap-1 flex-wrap">
              {([ ["sv-sv", "SV → SV"], ["sv-en", "SV → EN"], ["en-sv", "EN → SV"] ] as [DictMode, string][]).map(([m, label]) => (
                <button key={m} onClick={() => setMode(m)}
                  className={`rounded-sm border-2 border-border px-3 py-1.5 font-pixel text-[9px] ${mode === m ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={word} onChange={e => setWord(e.target.value)}
                onKeyDown={e => e.key === "Enter" && save()}
                placeholder={mode === "en-sv" ? "English word…" : "Skriv ett ord…"}
                disabled={loading} {...noCorr}
                className="flex-1 rounded-sm border-2 border-border bg-secondary/50 px-3 py-2 text-base outline-none focus:border-ring disabled:opacity-50" />
              <button onClick={save} disabled={!word.trim() || loading || !key}
                className="rounded-sm border-2 border-border bg-accent px-4 py-2 font-pixel text-[9px] text-accent-foreground shadow-pixel-sm disabled:opacity-40">
                {loading ? "…" : "LÄGG TILL"}
              </button>
            </div>
            {!key && <p className="font-pixel text-[8px] text-destructive">Ange API-nyckel i Klassrumsläget först</p>}
            {err && <p className="font-pixel text-[8px] text-destructive">✗ {err}</p>}
          </div>
        )}
      </div>

      {words.length === 0 ? (
        <div className="pixel-panel rounded-sm bg-card p-10 text-center flex flex-col gap-3">
          <p className="text-2xl">📖</p>
          <p className="font-pixel text-[9px] text-muted-foreground">INGA ORD ÄN</p>
          <p className="text-muted-foreground text-sm">Slå upp ord i ordboken eller lägg till manuellt ovan.</p>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <button onClick={onMatch} disabled={!canPlay}
              className="flex-1 rounded-sm border-2 border-border bg-accent px-3 py-2.5 font-pixel text-[9px] text-accent-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed">
              🎮 MATCHA ORD
            </button>
            <button onClick={onQuiz} disabled={!canPlay}
              className="flex-1 rounded-sm border-2 border-border bg-card px-3 py-2.5 font-pixel text-[9px] shadow-pixel-sm active:translate-y-0.5 active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed">
              📝 QUIZ
            </button>
          </div>
          {!canPlay && <p className="text-center font-pixel text-[8px] text-muted-foreground">Lägg till minst 4 ord för att spela</p>}
          {words.map(w => (
            <div key={w.id} className="pixel-panel rounded-sm bg-card overflow-hidden">
              <button onClick={() => onExpand(w.id)}
                className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-secondary/30 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-lg font-semibold truncate">{w.word}</span>
                  <span className="rounded-sm bg-secondary/60 px-1.5 py-0.5 font-pixel text-[7px] text-muted-foreground shrink-0">{MODE_LABEL[w.mode]}</span>
                </div>
                <span className="text-muted-foreground shrink-0">{expanded === w.id ? "▲" : "▼"}</span>
              </button>
              {expanded === w.id && (
                <div className="border-t-2 border-border px-4 pb-4 pt-3 flex flex-col gap-3">
                  <div className="prose prose-sm max-w-none text-sm leading-relaxed">
                    <ReactMarkdown>{displayMeaning(w.meaning)}</ReactMarkdown>
                  </div>
                  <button onClick={() => onDelete(w.id)}
                    className="self-end rounded-sm border-2 border-border bg-destructive/10 px-3 py-1.5 font-pixel text-[8px] text-destructive shadow-pixel-sm active:translate-y-0.5 active:shadow-none">
                    TA BORT
                  </button>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── Quiz ──────────────────────────────────────────────────────────────────────

function QuizScreen({ state, onChange, onBack, onRestart }: {
  state: QuizState;
  onChange: (s: QuizState) => void;
  onBack: () => void;
  onRestart: () => void;
}) {
  if (state.done) {
    const pct = Math.round((state.score / state.questions.length) * 100);
    return (
      <div className="pixel-panel rounded-sm bg-card p-8 flex flex-col items-center gap-4 text-center">
        <p className="font-pixel text-[9px] text-muted-foreground">QUIZ KLART</p>
        <div className={`text-6xl font-bold ${pct >= 80 ? "text-emerald-600" : pct >= 60 ? "text-yellow-600" : "text-red-500"}`}>
          {state.score}/{state.questions.length}
        </div>
        <p className="text-muted-foreground">{pct}% rätt</p>
        <p className="text-base">
          {pct >= 80 ? "Utmärkt! Du kan de här orden." : pct >= 60 ? "Bra jobbat! Öva lite till." : "Fortsätt öva — det går bättre!"}
        </p>
        <div className="flex gap-2 mt-2">
          <button onClick={onRestart}
            className="rounded-sm border-2 border-border bg-accent px-5 py-2.5 font-pixel text-[9px] text-accent-foreground shadow-pixel-sm">
            FÖRSÖK IGEN
          </button>
          <button onClick={onBack}
            className="rounded-sm border-2 border-border bg-card px-5 py-2.5 font-pixel text-[9px] shadow-pixel-sm">
            LISTA
          </button>
        </div>
      </div>
    );
  }

  const q = state.questions[state.current];
  const answered = state.selected !== null;

  function select(idx: number) {
    if (answered) return;
    onChange({
      ...state,
      selected: idx,
      score: idx === q.correctIdx ? state.score + 1 : state.score,
    });
  }

  function next() {
    const isLast = state.current === state.questions.length - 1;
    onChange({ ...state, current: isLast ? state.current : state.current + 1, selected: null, done: isLast });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Progress */}
      <div className="pixel-panel rounded-sm bg-card p-3">
        <div className="flex justify-between mb-2">
          <span className="font-pixel text-[9px] text-muted-foreground">FRÅGA {state.current + 1} / {state.questions.length}</span>
          <span className="font-pixel text-[9px] text-muted-foreground">{state.score} rätt</span>
        </div>
        <div className="flex gap-0.5">
          {state.questions.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i < state.current ? "bg-primary" : i === state.current ? "bg-accent" : "bg-secondary"}`} />
          ))}
        </div>
      </div>

      {/* Word */}
      <div className="pixel-panel rounded-sm bg-card p-6 text-center">
        <p className="font-pixel text-[9px] text-muted-foreground mb-2">{MODE_LABEL[q.word.mode]}</p>
        <p className="text-3xl font-bold">{q.word.word}</p>
      </div>

      {/* Options */}
      <div className="flex flex-col gap-2">
        {q.options.map((opt, i) => {
          const isSelected = state.selected === i;
          const isCorrect = i === q.correctIdx;
          let cls = "border-border bg-card hover:bg-secondary/40";
          if (answered) {
            if (isCorrect) cls = "border-emerald-400 bg-emerald-50 text-emerald-800";
            else if (isSelected && !isCorrect) cls = "border-red-400 bg-red-50 text-red-800";
          } else if (isSelected) {
            cls = "border-accent bg-accent/20";
          }
          return (
            <button key={i} onClick={() => select(i)}
              className={`rounded-sm border-2 px-4 py-3 text-left text-base transition-colors ${cls}`}>
              {answered && isCorrect && <span className="mr-2">✓</span>}
              {answered && isSelected && !isCorrect && <span className="mr-2">✗</span>}
              {opt}
            </button>
          );
        })}
      </div>

      {answered && (
        <button onClick={next}
          className="w-full rounded-sm border-2 border-border bg-accent px-4 py-3 font-pixel text-[10px] text-accent-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none">
          {state.current === state.questions.length - 1 ? "SE RESULTAT" : "NÄSTA →"}
        </button>
      )}
    </div>
  );
}

// ── Matching game ─────────────────────────────────────────────────────────────

function MatchScreen({ state, onChange, onRematch, onBack }: {
  state: MatchState;
  onChange: (s: MatchState | null) => void;
  onRematch: () => void;
  onBack: () => void;
}) {
  const allMatched = state.matched.length === state.pairs.length;

  function clickLeft(id: string) {
    if (state.matched.includes(id) || state.wrong.includes(id)) return;
    onChange({ ...state, selectedLeft: id });
  }

  function clickRight(id: string) {
    if (state.matched.includes(id) || state.wrong.includes(id)) return;
    const { selectedLeft } = state;
    if (!selectedLeft) return;

    const newAttempts = state.attempts + 1;
    if (selectedLeft === id) {
      // Correct!
      onChange({
        ...state,
        matched: [...state.matched, id],
        selectedLeft: null,
        attempts: newAttempts,
        correct: state.correct + 1,
      });
    } else {
      // Wrong — flash red briefly
      onChange({ ...state, wrong: [selectedLeft, id], selectedLeft: null, attempts: newAttempts });
      setTimeout(() => onChange({ ...state, wrong: [], selectedLeft: null, attempts: newAttempts }), 650);
    }
  }

  const accuracy = state.attempts > 0 ? Math.round((state.correct / state.attempts) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Score bar */}
      <div className="pixel-panel rounded-sm bg-card p-3 flex justify-between items-center">
        <span className="font-pixel text-[9px] text-muted-foreground">
          {state.matched.length} / {state.pairs.length} par matchade
        </span>
        {state.attempts > 0 && (
          <span className="font-pixel text-[9px] text-muted-foreground">{accuracy}% träff</span>
        )}
      </div>

      {allMatched ? (
        <div className="pixel-panel rounded-sm bg-card p-8 flex flex-col items-center gap-4 text-center">
          <p className="font-pixel text-[9px] text-muted-foreground">OMGÅNG KLAR</p>
          <div className={`text-6xl font-bold ${accuracy >= 80 ? "text-emerald-600" : accuracy >= 60 ? "text-yellow-600" : "text-red-500"}`}>
            {accuracy}%
          </div>
          <p className="text-muted-foreground">{state.correct} rätt av {state.attempts} försök</p>
          <div className="flex gap-2 mt-2">
            <button onClick={onRematch}
              className="rounded-sm border-2 border-border bg-accent px-5 py-2.5 font-pixel text-[9px] text-accent-foreground shadow-pixel-sm">
              NY OMGÅNG
            </button>
            <button onClick={onBack}
              className="rounded-sm border-2 border-border bg-card px-5 py-2.5 font-pixel text-[9px] shadow-pixel-sm">
              LISTA
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="font-pixel text-[8px] text-muted-foreground text-center">
            Klicka ett ord till vänster, sedan rätt betydelse till höger
          </p>
          <div className="grid grid-cols-2 gap-2">
            {/* Left: words */}
            <div className="flex flex-col gap-2">
              {state.pairs.map(p => {
                const isMatched = state.matched.includes(p.id);
                const isSelected = state.selectedLeft === p.id;
                const isWrong = state.wrong.includes(p.id);
                return (
                  <button key={p.id} onClick={() => clickLeft(p.id)}
                    className={`rounded-sm border-2 px-3 py-3 text-left text-base font-semibold transition-all min-h-[56px] ${
                      isMatched ? "border-emerald-300 bg-emerald-50 text-emerald-700 cursor-default opacity-60" :
                      isWrong ? "border-red-400 bg-red-50 text-red-700 scale-95" :
                      isSelected ? "border-accent bg-accent text-accent-foreground shadow-pixel-sm" :
                      "border-border bg-card hover:bg-secondary/40 active:translate-y-0.5"
                    }`}>
                    {isMatched ? <span className="mr-1">✓</span> : null}{p.word}
                  </button>
                );
              })}
            </div>
            {/* Right: shuffled meanings */}
            <div className="flex flex-col gap-2">
              {state.rightOrder.map(p => {
                const isMatched = state.matched.includes(p.id);
                const isWrong = state.wrong.includes(p.id);
                return (
                  <button key={p.id} onClick={() => clickRight(p.id)}
                    className={`rounded-sm border-2 px-3 py-3 text-left text-sm leading-snug transition-all min-h-[56px] ${
                      isMatched ? "border-emerald-300 bg-emerald-50 text-emerald-700 cursor-default opacity-60" :
                      isWrong ? "border-red-400 bg-red-50 text-red-700 scale-95" :
                      "border-border bg-card hover:bg-secondary/40 active:translate-y-0.5"
                    }`}>
                    {isMatched ? <span className="mr-1">✓</span> : null}{p.meaning}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
