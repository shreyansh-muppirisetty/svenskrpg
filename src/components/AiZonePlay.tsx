import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { type Zone, RULE_LABEL, gradeFor, isCorrect as staticIsCorrect, tilesFor } from "@/game/zones";
import { generateNpcTurn, evaluateUserResponse, type NpcTurn, type EvaluationResult } from "@/game/ai";
import { useSpeech } from "@/hooks/useSpeech";
import type { Difficulty } from "./DifficultySelector";

type Props = {
  zone: Zone;
  difficulty: Difficulty;
  startingFluency: number;
  onFinish: (grade: string) => void;
  onExit: () => void;
};

type Status = "idle" | "wrong" | "right" | "evaluating";

export function AiZonePlay({ zone, difficulty, startingFluency, onFinish, onExit }: Props) {
  const [turnIndex, setTurnIndex] = useState(0);
  const [fluency, setFluency] = useState(startingFluency);
  const [history, setHistory] = useState<{ role: "npc" | "player"; text: string }[]>([]);

  const [npcTurn, setNpcTurn] = useState<NpcTurn | null>(null);
  const [loadingTurn, setLoadingTurn] = useState(true);

  const [status, setStatus] = useState<Status>("idle");
  const [cleared, setCleared] = useState(0);
  const [misses, setMisses] = useState(0);
  const [evalResult, setEvalResult] = useState<EvaluationResult | null>(null);

  const [text, setText] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [showSubs, setShowSubs] = useState(true);
  const [left, setLeft] = useState(zone.timeLimit);
  const [ended, setEnded] = useState<null | "won" | "lost">(null);

  const speech = useSpeech();
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync mic transcript to text state in Hard mode
  useEffect(() => {
    if (difficulty === "hard" && speech.transcript) {
      setText(speech.transcript);
    }
  }, [difficulty, speech.transcript]);

  // Load next NPC turn
  const loadTurn = useCallback(
    async (currHistory: typeof history, idx: number) => {
      setLoadingTurn(true);
      setStatus("idle");
      setEvalResult(null);
      setText("");
      setSlots([]);
      speech.resetTranscript();

      // Try AI turn generation
      const aiTurn = await generateNpcTurn(zone, currHistory);

      if (aiTurn) {
        setNpcTurn(aiTurn);
        if (difficulty === "hard") {
          speech.speak(aiTurn.npc_swedish);
        }
      } else {
        // Fallback to zone static challenge if AI key not present or fails
        const staticChallenge = zone.challenges[idx % zone.challenges.length];
        const fallbackTurn: NpcTurn = {
          npc_swedish: staticChallenge.npc,
          npc_english_hint: staticChallenge.task,
          expected_answer: staticChallenge.answer,
          ordered_tiles: staticChallenge.answer.split(" "),
          distractor_tiles: ["du", "vad", "varför"],
          rule: staticChallenge.rule,
        };
        setNpcTurn(fallbackTurn);
        if (difficulty === "hard") {
          speech.speak(fallbackTurn.npc_swedish);
        }
      }
      setLoadingTurn(false);
    },
    [zone, difficulty, speech]
  );

  // Initial turn load
  useEffect(() => {
    loadTurn([], 0);
  }, [loadTurn]);

  // Subtitles fade timer
  useEffect(() => {
    setShowSubs(true);
    const t = setTimeout(() => setShowSubs(false), 3000);
    return () => clearTimeout(t);
  }, [turnIndex]);

  // Timer logic for timed zones
  useEffect(() => {
    if (!zone.timeLimit || ended || status === "right" || loadingTurn) return;
    setLeft(zone.timeLimit);
    const t = setInterval(() => {
      setLeft((s) => {
        if (s > 1) return s - 1;
        clearInterval(t);
        setStatus("wrong");
        setMisses((m) => m + 1);
        setFluency((f) => {
          const next = Math.max(0, f - 12);
          if (next === 0) setEnded("lost");
          return next;
        });
        setTimeout(() => setStatus("idle"), 400);
        return 0;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [turnIndex, zone.timeLimit, ended, status, loadingTurn]);

  // Shuffle tiles for Easy mode
  const bank = useMemo(() => {
    if (!npcTurn) return [];
    const combined = [...npcTurn.ordered_tiles, ...npcTurn.distractor_tiles];
    // Simple deterministic shuffle
    return combined.sort((a, b) => (a.length + a.charCodeAt(0)) - (b.length + b.charCodeAt(0)));
  }, [npcTurn]);

  const remaining = useMemo(() => {
    const rest = [...bank];
    slots.forEach((w) => {
      const idx = rest.indexOf(w);
      if (idx > -1) rest.splice(idx, 1);
    });
    return rest;
  }, [bank, slots]);

  const currentAnswer = difficulty === "easy" ? slots.join(" ") : text;

  async function submit() {
    if (!currentAnswer.trim() || ended || status === "right" || status === "evaluating" || !npcTurn) return;

    setStatus("evaluating");
    if (speech.isListening) speech.stopListening();

    // Call Pass B evaluation
    const res = await evaluateUserResponse(zone, npcTurn, currentAnswer);

    const isCorrect = res ? res.is_correct : staticIsCorrect(currentAnswer, {
      npc: npcTurn.npc_swedish,
      task: npcTurn.npc_english_hint,
      rule: npcTurn.rule,
      mode: "type",
      answer: npcTurn.expected_answer,
      hint: "",
    });

    setEvalResult(res ?? {
      is_correct: isCorrect,
      fluency_delta: isCorrect ? 12 : -9,
      grammar_feedback: isCorrect ? "Rätt! Bra jobbat." : "Kolla ordföljden och försök igen.",
      improved_answer: npcTurn.expected_answer,
    });

    if (isCorrect) {
      setStatus("right");
      setFluency((f) => Math.min(100, f + 12));
      setCleared((n) => n + 1);

      const nextHistory = [
        ...history,
        { role: "npc" as const, text: npcTurn.npc_swedish },
        { role: "player" as const, text: currentAnswer },
      ];
      setHistory(nextHistory);

      setTimeout(() => {
        if (turnIndex + 1 >= Math.max(zone.challenges.length, 5)) {
          setEnded("won");
          onFinish(gradeFor(cleared + 1, Math.max(zone.challenges.length, 5)));
        } else {
          setTurnIndex((t) => t + 1);
          loadTurn(nextHistory, turnIndex + 1);
        }
      }, 1500);
    } else {
      setStatus("wrong");
      setMisses((n) => n + 1);
      setFluency((f) => {
        const next = Math.max(0, f - 9);
        if (next === 0) setEnded("lost");
        return next;
      });
      setTimeout(() => setStatus("idle"), 800);
    }
  }

  function retry() {
    setTurnIndex(0);
    setFluency(startingFluency);
    setCleared(0);
    setMisses(0);
    setHistory([]);
    setEnded(null);
    loadTurn([], 0);
  }

  const grade = gradeFor(cleared, Math.max(zone.challenges.length, 5));

  if (ended) {
    return (
      <section className="pixel-panel animate-pop rounded-sm bg-chalk p-6 text-chalk-foreground">
        <h2 className="font-pixel text-base leading-relaxed text-accent">
          {ended === "won" ? `${zone.name.toUpperCase()} KLARAT` : "DU TAPPADE FLYTET"}
        </h2>
        <p className="mt-3 text-2xl">
          {ended === "won" ? zone.outro : `${zone.npc} bytte till engelska. Det är förlust.`}
        </p>
        <p className="mt-2 text-xl opacity-80">
          Flyt: {fluency}%. Misstag: {misses}. Betyg: {grade}.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={retry}
            className="rounded-sm border-2 border-border bg-accent px-4 py-2 font-pixel text-[10px] text-accent-foreground shadow-pixel-sm active:translate-y-1 active:shadow-none"
          >
            SPELA IGEN
          </button>
          <button
            onClick={onExit}
            className="rounded-sm border-2 border-border bg-card px-4 py-2 font-pixel text-[10px] text-foreground shadow-pixel-sm active:translate-y-1 active:shadow-none"
          >
            TILL KARTAN
          </button>
        </div>
      </section>
    );
  }

  return (
    <>
      <FluencyBar value={fluency} />

      <section className="pixel-panel relative rounded-sm bg-chalk p-5 text-chalk-foreground min-h-[160px]">
        {npcTurn && (
          <div className="absolute -top-3 left-4 font-pixel text-[9px] text-accent-foreground">
            <span className="rounded-sm bg-accent px-2 py-1">{RULE_LABEL[npcTurn.rule] ?? "GRAMMATIK"}</span>
          </div>
        )}

        {zone.timeLimit > 0 && (
          <div
            className={`absolute -top-3 right-4 rounded-sm px-2 py-1 font-pixel text-[9px] ${
              left <= 4 ? "bg-destructive text-destructive-foreground" : "bg-card text-foreground"
            }`}
          >
            {left}s
          </div>
        )}

        {loadingTurn ? (
          <p className="mt-4 font-pixel text-xs animate-pulse">{zone.npc} tänker…</p>
        ) : npcTurn ? (
          <>
            <p className="mt-2 text-2xl leading-snug">{npcTurn.npc_swedish}</p>
            <p className={`mt-2 text-base italic transition-opacity duration-700 ${showSubs ? "opacity-70" : "opacity-0"}`}>
              {npcTurn.npc_english_hint}
            </p>
            <button
              onClick={() => setShowSubs(true)}
              className="mt-3 font-pixel text-[9px] text-chalk-foreground/60 underline underline-offset-4 hover:text-chalk-foreground"
            >
              visa igen
            </button>
          </>
        ) : null}
      </section>

      <section className={`pixel-panel rounded-sm bg-card p-4 ${status === "wrong" ? "animate-shake" : ""}`}>
        {difficulty === "easy" ? (
          <>
            <div className="mb-3 flex min-h-16 flex-wrap items-center gap-2 rounded-sm border-2 border-dashed border-border bg-secondary/60 p-3">
              {slots.length === 0 && <span className="text-muted-foreground">Klicka på orden i rätt ordning…</span>}
              {slots.map((w, idx) => (
                <button
                  key={`${w}-${idx}`}
                  onClick={() => setSlots(slots.filter((_, k) => k !== idx))}
                  className="rounded-sm border-2 border-border bg-tile px-3 py-2 font-pixel text-[11px] text-tile-foreground shadow-pixel-sm"
                >
                  {w}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {remaining.map((w, idx) => (
                <button
                  key={`${w}-bank-${idx}`}
                  onClick={() => setSlots([...slots, w])}
                  className="rounded-sm border-2 border-border bg-tile px-3 py-2 font-pixel text-[11px] text-tile-foreground shadow-pixel-sm"
                >
                  {w}
                </button>
              ))}
            </div>
          </>
        ) : difficulty === "medium" ? (
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Skriv på svenska…"
            autoComplete="off"
            className="w-full rounded-sm border-2 border-border bg-secondary/50 px-3 py-3 text-2xl outline-none focus:border-ring"
          />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={speech.isListening ? "Lyssnar på din röst…" : "Tala i mikrofonen eller skriv här…"}
                className="flex-1 rounded-sm border-2 border-border bg-secondary/50 px-3 py-3 text-2xl outline-none focus:border-ring"
              />
              {speech.isSupported ? (
                <button
                  onClick={speech.isListening ? speech.stopListening : speech.startListening}
                  className={`rounded-sm border-2 border-border px-4 py-3 font-pixel text-[10px] shadow-pixel-sm transition-transform active:translate-y-1 ${
                    speech.isListening
                      ? "bg-destructive text-destructive-foreground animate-pulse"
                      : "bg-accent text-accent-foreground"
                  }`}
                >
                  {speech.isListening ? "STOPPA" : "TALA (MIC)"}
                </button>
              ) : (
                <span className="font-pixel text-[8px] text-muted-foreground">Röst stöds ej i din webbläsare</span>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={submit}
            disabled={status === "evaluating" || loadingTurn}
            className="rounded-sm border-2 border-border bg-primary px-4 py-2 font-pixel text-[10px] text-primary-foreground shadow-pixel-sm transition-transform active:translate-y-1 active:shadow-none disabled:opacity-50"
          >
            {status === "evaluating" ? "UTVÄRDERAR…" : "SVARA"}
          </button>
          {difficulty === "easy" && slots.length > 0 && (
            <button
              onClick={() => setSlots([])}
              className="font-pixel text-[10px] text-muted-foreground underline underline-offset-4"
            >
              rensa
            </button>
          )}
          <span className="ml-auto font-pixel text-[9px] text-muted-foreground">
            REPLIK {turnIndex + 1} · BETYG {grade}
          </span>
        </div>

        {evalResult && status === "wrong" && (
          <div className="animate-pop mt-3 rounded-sm bg-destructive/10 border border-destructive p-3 text-destructive">
            <p className="font-pixel text-[10px] mb-1">FEL / REVISION</p>
            <p className="text-lg">{evalResult.grammar_feedback}</p>
            {evalResult.improved_answer && (
              <p className="text-sm italic mt-1 opacity-90">Förslag: “{evalResult.improved_answer}”</p>
            )}
          </div>
        )}

        {evalResult && status === "right" && (
          <div className="animate-pop mt-3 rounded-sm bg-success/10 border border-success p-3 text-success">
            <p className="font-pixel text-[10px] mb-1">RÄTT!</p>
            <p className="text-lg">{evalResult.grammar_feedback}</p>
          </div>
        )}
      </section>
    </>
  );
}

function FluencyBar({ value }: { value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between font-pixel text-[9px] text-muted-foreground">
        <span>FLYT</span>
        <span>{value}%</span>
      </div>
      <div className="pixel-panel h-6 overflow-hidden rounded-sm bg-secondary">
        <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
