import { useState } from "react";
import { loadEttWords, deleteEttWord, saveEttWord, type EttWord } from "@/lib/enellerett";

function shuffle<T>(a: T[]): T[] { return [...a].sort(() => Math.random() - 0.5); }

// ── Quiz ──────────────────────────────────────────────────────────────────────

interface QuizState {
  words: EttWord[];
  current: number;
  selected: "en" | "ett" | null;
  score: number;
}

function QuizScreen({ words, onBack }: { words: EttWord[]; onBack: () => void }) {
  const [state, setState] = useState<QuizState>({ words: shuffle(words), current: 0, selected: null, score: 0 });

  if (state.current >= state.words.length) {
    const pct = Math.round((state.score / state.words.length) * 100);
    return (
      <div className="pixel-panel rounded-sm bg-card p-8 flex flex-col items-center gap-4 text-center">
        <p className="font-pixel text-[9px] text-muted-foreground">QUIZ KLART</p>
        <div className={`text-6xl font-bold ${pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-yellow-600" : "text-red-500"}`}>
          {state.score}/{state.words.length}
        </div>
        <p className="text-muted-foreground">{pct}% rätt</p>
        <div className="flex gap-2 mt-2">
          <button onClick={() => setState({ words: shuffle(words), current: 0, selected: null, score: 0 })}
            className="rounded-sm border-2 border-border bg-accent px-5 py-2.5 font-pixel text-[9px] text-accent-foreground shadow-pixel-sm">
            IGEN
          </button>
          <button onClick={onBack}
            className="rounded-sm border-2 border-border bg-card px-5 py-2.5 font-pixel text-[9px] shadow-pixel-sm">
            LISTA
          </button>
        </div>
      </div>
    );
  }

  const w = state.words[state.current];
  const answered = state.selected !== null;
  const correct = answered && state.selected === w.correct;

  function pick(choice: "en" | "ett") {
    if (answered) return;
    setState(s => ({ ...s, selected: choice, score: choice === w.correct ? s.score + 1 : s.score }));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="pixel-panel rounded-sm bg-card p-3">
        <div className="flex justify-between mb-2">
          <span className="font-pixel text-[9px] text-muted-foreground">{state.current + 1} / {state.words.length}</span>
          <span className="font-pixel text-[9px] text-muted-foreground">{state.score} rätt</span>
        </div>
        <div className="flex gap-0.5">
          {state.words.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i < state.current ? "bg-primary" : i === state.current ? "bg-accent" : "bg-secondary"}`} />
          ))}
        </div>
      </div>

      <div className="pixel-panel rounded-sm bg-card p-8 text-center">
        <p className="font-pixel text-[9px] text-muted-foreground mb-3">EN ELLER ETT?</p>
        <p className="text-4xl font-bold">{w.word}</p>
        {answered && (
          <p className={`mt-4 font-pixel text-[10px] ${correct ? "text-emerald-600" : "text-red-500"}`}>
            {correct ? "✓ RÄTT!" : `✗ DET ÄR "${w.correct} ${w.word}"`}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {(["en", "ett"] as const).map(choice => {
          let cls = "border-border bg-card hover:bg-secondary/40";
          if (answered) {
            if (choice === w.correct) cls = "border-emerald-400 bg-emerald-50 text-emerald-800";
            else if (choice === state.selected) cls = "border-red-400 bg-red-50 text-red-800";
          }
          return (
            <button key={choice} onClick={() => pick(choice)}
              className={`rounded-sm border-2 py-5 font-pixel text-[18px] transition-colors shadow-pixel-sm active:translate-y-0.5 active:shadow-none ${cls}`}>
              {choice.toUpperCase()}
            </button>
          );
        })}
      </div>

      {answered && (
        <button onClick={() => setState(s => ({ ...s, current: s.current + 1, selected: null }))}
          className="w-full rounded-sm border-2 border-border bg-accent px-4 py-3 font-pixel text-[10px] text-accent-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none">
          {state.current === state.words.length - 1 ? "SE RESULTAT" : "NÄSTA →"}
        </button>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function EnEllerEtt({ onExit }: { onExit: () => void }) {
  const [words, setWords] = useState<EttWord[]>(() => loadEttWords());
  const [screen, setScreen] = useState<"browse" | "quiz">("browse");
  const [expanded, setExpanded] = useState<string | null>(null);

  function refresh() { setWords(loadEttWords()); }

  function handleDelete(id: string) { deleteEttWord(id); refresh(); }

  // Manual add
  const [addWord, setAddWord] = useState("");
  const [addCorrect, setAddCorrect] = useState<"en" | "ett">("en");

  function handleAdd() {
    if (!addWord.trim()) return;
    saveEttWord(addWord.trim(), addCorrect);
    setAddWord(""); refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="pixel-panel flex items-center justify-between rounded-sm bg-card p-4">
        <div>
          <p className="font-pixel text-[11px] text-primary">EN ELLER ETT</p>
          <p className="text-sm text-muted-foreground">{words.length} ord sparade</p>
        </div>
        <div className="flex gap-2">
          {screen !== "browse" && (
            <button onClick={() => setScreen("browse")}
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

      {screen === "quiz" && <QuizScreen words={words} onBack={() => setScreen("browse")} />}

      {screen === "browse" && (
        <div className="flex flex-col gap-3">
          {/* Manual add */}
          <div className="pixel-panel rounded-sm bg-card p-4 flex flex-col gap-3">
            <p className="font-pixel text-[9px] text-muted-foreground">LÄGG TILL ORD</p>
            <div className="flex gap-2">
              <input value={addWord} onChange={e => setAddWord(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAdd()}
                placeholder="Substantiv…"
                spellCheck={false}
                className="flex-1 rounded-sm border-2 border-border bg-secondary/50 px-3 py-2 text-base outline-none focus:border-ring" />
              <button onClick={() => setAddCorrect(c => c === "en" ? "ett" : "en")}
                className="rounded-sm border-2 border-border bg-card px-4 py-2 font-pixel text-[11px] shadow-pixel-sm min-w-[64px]">
                {addCorrect.toUpperCase()}
              </button>
              <button onClick={handleAdd} disabled={!addWord.trim()}
                className="rounded-sm border-2 border-border bg-accent px-3 py-2 font-pixel text-[9px] text-accent-foreground shadow-pixel-sm disabled:opacity-40">
                +
              </button>
            </div>
          </div>

          {words.length === 0 ? (
            <div className="pixel-panel rounded-sm bg-card p-10 text-center flex flex-col gap-3">
              <p className="text-2xl">🎯</p>
              <p className="font-pixel text-[9px] text-muted-foreground">INGA ORD ÄN</p>
              <p className="text-sm text-muted-foreground">Ord med fel en/ett läggs till automatiskt när du gör uppgifter.</p>
            </div>
          ) : (
            <>
              <button onClick={() => setScreen("quiz")} disabled={words.length < 2}
                className="w-full rounded-sm border-2 border-border bg-accent px-4 py-2.5 font-pixel text-[9px] text-accent-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none disabled:opacity-40">
                🎮 ÖPPNA QUIZ
              </button>

              {/* Word list grouped by en/ett */}
              {(["en", "ett"] as const).map(article => {
                const group = words.filter(w => w.correct === article);
                if (!group.length) return null;
                return (
                  <div key={article} className="pixel-panel rounded-sm bg-card overflow-hidden">
                    <p className="px-4 py-2 font-pixel text-[9px] text-muted-foreground border-b-2 border-border">
                      {article.toUpperCase()}-ORD ({group.length})
                    </p>
                    {group.map(w => (
                      <div key={w.id} className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border/50 last:border-0">
                        <span className="text-base"><span className="text-muted-foreground mr-1">{w.correct}</span><strong>{w.word}</strong></span>
                        <button onClick={() => handleDelete(w.id)}
                          className="font-pixel text-[8px] text-muted-foreground hover:text-destructive transition-colors">
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
