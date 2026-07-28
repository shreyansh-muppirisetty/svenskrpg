import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ZONES,
  RULE_LABEL,
  isCorrect,
  tilesFor,
  gradeFor,
  loadSave,
  storeSave,
  isUnlocked,
  type Zone,
  type Save,
} from "@/game/zones";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Svenska Quest — Grammar Is the Game" },
      {
        name: "description",
        content:
          "A pixel-art RPG where Swedish grammar gates the story: five zones, V2 word order, en/ett, modals and subordinate clauses — under time pressure.",
      },
      { property: "og:title", content: "Svenska Quest — Grammar Is the Game" },
      {
        property: "og:description",
        content:
          "Classroom, canteen, corridor, shop, party. Every door needs correct Swedish. Keep your fluency bar alive.",
      },
    ],
  }),
  component: Game,
});

type Status = "idle" | "wrong" | "right";
type Screen = { view: "map" } | { view: "zone"; zone: Zone };

function Game() {
  const [screen, setScreen] = useState<Screen>({ view: "map" });
  const [save, setSave] = useState<Save>({ cleared: [], grades: {} });

  useEffect(() => setSave(loadSave()), []);

  const persist = useCallback((s: Save) => {
    setSave(s);
    storeSave(s);
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-5 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-pixel text-lg leading-relaxed text-primary sm:text-2xl">
            SVENSKA QUEST
          </h1>
          <p className="text-muted-foreground">
            {screen.view === "map"
              ? "Grammatiken är spelet. Välj en zon."
              : `${screen.zone.name} · ${screen.zone.npc}`}
          </p>
        </div>
        {screen.view === "zone" && (
          <button
            onClick={() => setScreen({ view: "map" })}
            className="rounded-sm border-2 border-border bg-card px-3 py-2 font-pixel text-[9px] shadow-pixel-sm active:translate-y-0.5 active:shadow-none"
          >
            KARTAN
          </button>
        )}
      </header>

      {screen.view === "map" ? (
        <MapScreen
          save={save}
          onPick={(zone) => setScreen({ view: "zone", zone })}
          onWipe={() => persist({ cleared: [], grades: {} })}
        />
      ) : (
        <ZonePlay
          key={screen.zone.id}
          zone={screen.zone}
          onFinish={(grade) =>
            persist({
              cleared: Array.from(new Set([...save.cleared, screen.zone.id])),
              grades: { ...save.grades, [screen.zone.id]: grade },
            })
          }
          onExit={() => setScreen({ view: "map" })}
        />
      )}

      <footer className="mt-auto pt-4 font-pixel text-[9px] leading-relaxed text-muted-foreground">
        5 zoner · frågor · V2 · en/ett · modalverb · bisatser · flyt & betyg
      </footer>
    </main>
  );
}

function MapScreen({
  save,
  onPick,
  onWipe,
}: {
  save: Save;
  onPick: (z: Zone) => void;
  onWipe: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <section className="pixel-panel rounded-sm bg-chalk p-5 text-chalk-foreground">
        <p className="text-2xl leading-snug">
          Du är ny i skolan. Ingen byter till engelska. Varje dörr kräver rätt ordföljd.
        </p>
      </section>

      {ZONES.map((z, idx) => {
        const unlocked = isUnlocked(idx, save.cleared);
        const grade = save.grades[z.id];
        return (
          <button
            key={z.id}
            disabled={!unlocked}
            onClick={() => onPick(z)}
            className={`pixel-panel flex items-center gap-4 rounded-sm bg-card p-4 text-left transition-transform ${
              unlocked
                ? "active:translate-y-0.5"
                : "cursor-not-allowed opacity-50 grayscale"
            }`}
          >
            <span className="font-pixel text-[10px] text-muted-foreground">{idx + 1}</span>
            <span className="flex-1">
              <span className="block font-pixel text-[11px] text-foreground">{z.name}</span>
              <span className="block text-lg text-muted-foreground">{z.blurb}</span>
              <span className="block font-pixel text-[9px] text-muted-foreground">
                {z.challenges.length} repliker ·{" "}
                {z.timeLimit ? `${z.timeLimit}s per replik` : "ingen tidspress"}
              </span>
            </span>
            <span className="font-pixel text-xl text-accent-foreground">
              {grade ?? (unlocked ? "–" : "🔒")}
            </span>
          </button>
        );
      })}

      {save.cleared.length > 0 && (
        <button
          onClick={onWipe}
          className="self-start font-pixel text-[9px] text-muted-foreground underline underline-offset-4"
        >
          nollställ progress
        </button>
      )}
    </div>
  );
}

function ZonePlay({
  zone,
  onFinish,
  onExit,
}: {
  zone: Zone;
  onFinish: (grade: string) => void;
  onExit: () => void;
}) {
  const [i, setI] = useState(0);
  const [fluency, setFluency] = useState(50);
  const [status, setStatus] = useState<Status>("idle");
  const [cleared, setCleared] = useState(0);
  const [misses, setMisses] = useState(0);
  const [text, setText] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [showSubs, setShowSubs] = useState(true);
  const [left, setLeft] = useState(zone.timeLimit);
  const [ended, setEnded] = useState<null | "won" | "lost">(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const c = zone.challenges[i];
  const bank = useMemo(() => tilesFor(c, i + 1), [c, i]);
  const remaining = useMemo(() => {
    const rest = [...bank];
    slots.forEach((w) => {
      const idx = rest.indexOf(w);
      if (idx > -1) rest.splice(idx, 1);
    });
    return rest;
  }, [bank, slots]);

  // Subtitles fade after 3s — you have to actually read fast.
  useEffect(() => {
    setShowSubs(true);
    const t = setTimeout(() => setShowSubs(false), 3000);
    return () => clearTimeout(t);
  }, [i]);

  const penalise = useCallback((amount: number) => {
    setMisses((n) => n + 1);
    setFluency((f) => {
      const next = Math.max(0, f - amount);
      if (next === 0) setEnded("lost");
      return next;
    });
  }, []);

  // Timed zones: running out of time counts as a miss and moves you on.
  useEffect(() => {
    if (!zone.timeLimit || ended || status === "right") return;
    setLeft(zone.timeLimit);
    const t = setInterval(() => {
      setLeft((s) => {
        if (s > 1) return s - 1;
        clearInterval(t);
        setStatus("wrong");
        penalise(12);
        setTimeout(() => setStatus("idle"), 400);
        return 0;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [i, zone.timeLimit, ended, status, penalise]);

  const answer = c.mode === "tiles" ? slots.join(" ") : text;

  function submit() {
    if (!answer.trim() || ended || status === "right") return;
    if (isCorrect(answer, c)) {
      setStatus("right");
      setFluency((f) => Math.min(100, f + 12));
      setCleared((n) => n + 1);
      setTimeout(() => {
        if (i + 1 >= zone.challenges.length) {
          setEnded("won");
          onFinish(gradeFor(cleared + 1, zone.challenges.length));
        } else {
          setI(i + 1);
          setText("");
          setSlots([]);
          setStatus("idle");
          inputRef.current?.focus();
        }
      }, 1100);
    } else {
      setStatus("wrong");
      penalise(9);
      setTimeout(() => setStatus("idle"), 400);
    }
  }

  function retry() {
    setI(0);
    setFluency(50);
    setCleared(0);
    setMisses(0);
    setText("");
    setSlots([]);
    setStatus("idle");
    setEnded(null);
    setLeft(zone.timeLimit);
  }

  const grade = gradeFor(cleared, zone.challenges.length);

  if (ended) {
    return (
      <ZoneEnd
        zone={zone}
        won={ended === "won"}
        grade={grade}
        misses={misses}
        fluency={fluency}
        onRetry={retry}
        onExit={onExit}
      />
    );
  }

  return (
    <>
      <FluencyBar value={fluency} />

      <section className="pixel-panel relative rounded-sm bg-chalk p-5 text-chalk-foreground">
        <div className="absolute -top-3 left-4 font-pixel text-[9px] text-accent-foreground">
          <span className="rounded-sm bg-accent px-2 py-1">{RULE_LABEL[c.rule]}</span>
        </div>
        {zone.timeLimit > 0 && (
          <div
            className={`absolute -top-3 right-4 rounded-sm px-2 py-1 font-pixel text-[9px] ${
              left <= 4 ? "bg-destructive text-destructive-foreground" : "bg-card text-foreground"
            }`}
          >
            {left}s
          </div>
        )}
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
            {i + 1} / {zone.challenges.length} · BETYG {grade}
          </span>
        </div>

        {status === "wrong" && (
          <p className="animate-pop mt-3 text-lg text-destructive">
            {zone.npc} rynkar pannan. {c.hint}
          </p>
        )}
        {status === "right" && (
          <p className="animate-pop mt-3 text-lg text-success">
            Rätt. “{c.answer}”
          </p>
        )}
      </section>
    </>
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

function ZoneEnd({
  zone,
  won,
  grade,
  misses,
  fluency,
  onRetry,
  onExit,
}: {
  zone: Zone;
  won: boolean;
  grade: string;
  misses: number;
  fluency: number;
  onRetry: () => void;
  onExit: () => void;
}) {
  return (
    <section className="pixel-panel animate-pop rounded-sm bg-chalk p-6 text-chalk-foreground">
      <h2 className="font-pixel text-base leading-relaxed text-accent">
        {won ? `${zone.name.toUpperCase()} KLARAT` : "DU TAPPADE FLYTET"}
      </h2>
      <p className="mt-3 text-2xl">
        {won ? zone.outro : `${zone.npc} bytte till engelska. Det är förlust.`}
      </p>
      <p className="mt-2 text-xl opacity-80">
        Flyt: {fluency}%. Misstag: {misses}. Betyg: {grade}.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          onClick={onRetry}
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
