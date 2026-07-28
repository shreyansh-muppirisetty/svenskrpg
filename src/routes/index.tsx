import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { CHALLENGES, isCorrect, tilesFor, gradeFor } from "@/game/classroom";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Svenska Quest — Classroom Demo" },
      {
        name: "description",
        content:
          "A pixel-art RPG demo where Swedish grammar is the game: build V2 sentences, ask questions, and fill the fluency bar before Fröken Grammatik loses patience.",
      },
      { property: "og:title", content: "Svenska Quest — Classroom Demo" },
      {
        property: "og:description",
        content:
          "Type and arrange Swedish sentences to survive your first lesson. Grammar gates the story.",
      },
    ],
  }),
  component: Game,
});

type Status = "idle" | "wrong" | "right";

function Game() {
  const [i, setI] = useState(0);
  const [fluency, setFluency] = useState(50);
  const [status, setStatus] = useState<Status>("idle");
  const [cleared, setCleared] = useState(0);
  const [misses, setMisses] = useState(0);
  const [text, setText] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [showSubs, setShowSubs] = useState(true);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const c = CHALLENGES[i];
  const bank = useMemo(() => tilesFor(c, i + 1), [c, i]);
  const remaining = useMemo(() => {
    const left = [...bank];
    slots.forEach((w) => {
      const idx = left.indexOf(w);
      if (idx > -1) left.splice(idx, 1);
    });
    return left;
  }, [bank, slots]);

  // Subtitles fade after 3s — you have to actually read fast.
  useEffect(() => {
    setShowSubs(true);
    const t = setTimeout(() => setShowSubs(false), 3000);
    return () => clearTimeout(t);
  }, [i]);

  const answer = c.mode === "tiles" ? slots.join(" ") : text;

  function submit() {
    if (!answer.trim() || done) return;
    if (isCorrect(answer, c)) {
      setStatus("right");
      setFluency((f) => Math.min(100, f + 12));
      setCleared((n) => n + 1);
      setTimeout(() => {
        if (i + 1 >= CHALLENGES.length) {
          setDone(true);
        } else {
          setI(i + 1);
          setText("");
          setSlots([]);
          setStatus("idle");
          inputRef.current?.focus();
        }
      }, 1200);
    } else {
      setStatus("wrong");
      setMisses((n) => n + 1);
      setFluency((f) => Math.max(0, f - 9));
      setTimeout(() => setStatus("idle"), 400);
    }
  }

  function reset() {
    setI(0);
    setFluency(50);
    setCleared(0);
    setMisses(0);
    setText("");
    setSlots([]);
    setStatus("idle");
    setDone(false);
  }

  const grade = gradeFor(cleared, CHALLENGES.length);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-5 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-pixel text-lg leading-relaxed text-primary sm:text-2xl">
            SVENSKA QUEST
          </h1>
          <p className="text-muted-foreground">Zone 1 · Klassrummet · Fröken Grammatik</p>
        </div>
        <div className="pixel-panel rounded-sm bg-card px-3 py-2 text-center">
          <div className="font-pixel text-[9px] text-muted-foreground">BETYG</div>
          <div className="font-pixel text-xl text-accent-foreground">{grade}</div>
        </div>
      </header>

      <FluencyBar value={fluency} />

      {done ? (
        <Ending
          grade={grade}
          misses={misses}
          fluency={fluency}
          total={CHALLENGES.length}
          onReset={reset}
        />
      ) : (
        <>
          <section className="pixel-panel relative rounded-sm bg-chalk p-5 text-chalk-foreground">
            <div className="absolute -top-3 left-4 font-pixel text-[9px] text-accent-foreground">
              <span className="rounded-sm bg-accent px-2 py-1">
                {c.rule === "v2" ? "V2-REGELN" : "FRÅGOR"}
              </span>
            </div>
            <p className="mt-2 text-2xl leading-snug">{c.npc}</p>
            <p
              className={`mt-2 text-base italic transition-opacity duration-700 ${
                showSubs ? "opacity-70" : "opacity-0"
              }`}
            >
              {c.task}
            </p>
            <button
              onClick={() => setShowSubs(true)}
              className="mt-3 font-pixel text-[9px] text-chalk-foreground/60 underline underline-offset-4 hover:text-chalk-foreground"
            >
              visa igen
            </button>
          </section>

          <section
            className={`pixel-panel rounded-sm bg-card p-4 ${status === "wrong" ? "animate-shake" : ""}`}
          >
            {c.mode === "tiles" ? (
              <>
                <div className="mb-3 flex min-h-16 flex-wrap items-center gap-2 rounded-sm border-2 border-dashed border-border bg-secondary/60 p-3">
                  {slots.length === 0 && (
                    <span className="text-muted-foreground">Klicka på orden i rätt ordning…</span>
                  )}
                  {slots.map((w, idx) => (
                    <Tile
                      key={`${w}-${idx}`}
                      word={w}
                      tone={status}
                      slotIndex={idx}
                      onClick={() => setSlots(slots.filter((_, k) => k !== idx))}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {remaining.map((w, idx) => (
                    <Tile key={`${w}-bank-${idx}`} word={w} onClick={() => setSlots([...slots, w])} />
                  ))}
                </div>
              </>
            ) : (
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="Skriv på svenska…"
                autoComplete="off"
                className="w-full rounded-sm border-2 border-border bg-secondary/50 px-3 py-3 text-2xl outline-none focus:border-ring"
              />
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={submit}
                className="rounded-sm border-2 border-border bg-primary px-4 py-2 font-pixel text-[10px] text-primary-foreground shadow-pixel-sm transition-transform active:translate-y-1 active:shadow-none"
              >
                SVARA
              </button>
              {c.mode === "tiles" && slots.length > 0 && (
                <button
                  onClick={() => setSlots([])}
                  className="font-pixel text-[10px] text-muted-foreground underline underline-offset-4"
                >
                  rensa
                </button>
              )}
              <span className="ml-auto font-pixel text-[9px] text-muted-foreground">
                {i + 1} / {CHALLENGES.length}
              </span>
            </div>

            {status === "wrong" && (
              <p className="animate-pop mt-3 text-lg text-destructive">
                Fröken Grammatik rynkar pannan. {c.hint}
              </p>
            )}
            {status === "right" && (
              <p className="animate-pop mt-3 text-lg text-success">
                Hon nickar. “{c.answer}” — helt rätt.
              </p>
            )}
          </section>
        </>
      )}

      <footer className="mt-auto pt-4 font-pixel text-[9px] leading-relaxed text-muted-foreground">
        MVP: Klassrummet · frågeordföljd + V2 · fluency bar · betyg D→A
      </footer>
    </main>
  );
}

function Tile({
  word,
  onClick,
  tone = "idle",
  slotIndex,
}: {
  word: string;
  onClick: () => void;
  tone?: Status;
  slotIndex?: number;
}) {
  const isVerbSlot = slotIndex === 1;
  return (
    <button
      onClick={onClick}
      className={`relative rounded-sm border-2 border-border px-3 py-2 font-pixel text-[11px] shadow-pixel-sm transition-transform active:translate-y-0.5 active:shadow-none ${
        tone === "right"
          ? "bg-success text-success-foreground"
          : tone === "wrong"
            ? "bg-destructive text-destructive-foreground"
            : "bg-tile text-tile-foreground"
      } ${isVerbSlot ? "ring-2 ring-accent" : ""}`}
    >
      {word}
    </button>
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
        <div
          className="h-full bg-primary transition-[width] duration-300"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function Ending({
  grade,
  misses,
  fluency,
  total,
  onReset,
}: {
  grade: string;
  misses: number;
  fluency: number;
  total: number;
  onReset: () => void;
}) {
  return (
    <section className="pixel-panel animate-pop rounded-sm bg-chalk p-6 text-chalk-foreground">
      <h2 className="font-pixel text-base leading-relaxed text-accent">KLASSRUMMET KLARAT</h2>
      <p className="mt-3 text-2xl">
        Du klarade alla {total} repliker. Flyt: {fluency}%. Misstag: {misses}.
      </p>
      <p className="mt-2 text-xl opacity-80">
        Nytt betyg: {grade}. Matsalen (V2 under press) låses upp… i nästa version.
      </p>
      <button
        onClick={onReset}
        className="mt-5 rounded-sm border-2 border-border bg-accent px-4 py-2 font-pixel text-[10px] text-accent-foreground shadow-pixel-sm active:translate-y-1 active:shadow-none"
      >
        SPELA IGEN
      </button>
    </section>
  );
}
