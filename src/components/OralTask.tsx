import { useEffect, useRef, useState } from "react";
import { PresentationMaker, SlideShow } from "@/components/PresentationMaker";
import { useDictation } from "@/hooks/useDictation";
import { buildOralWork, countWords, formatClock, lengthVerdict, oralNeedsSlides, paceLabel, speakingStats } from "@/lib/oral";
import { presentationToText, type Presentation } from "@/lib/presentation";

const btn = "rounded-sm border-2 border-border bg-card px-3 py-1.5 font-pixel text-[9px] shadow-pixel-sm active:translate-y-0.5 active:shadow-none disabled:opacity-40";
const btnPrimary = "rounded-sm border-2 border-border bg-primary px-4 py-2 font-pixel text-[9px] text-primary-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none disabled:opacity-40";
const btnAccent = "rounded-sm border-2 border-border bg-accent px-4 py-2 font-pixel text-[9px] text-accent-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none disabled:opacity-40";
const area = "rounded-sm border-2 border-border bg-secondary/50 px-3 py-2 text-base outline-none focus:border-ring resize-none";
const noCorr = { spellCheck: false, autoCorrect: "off", autoCapitalize: "off", autoComplete: "off" } as const;

type Stage = "prepare" | "speak" | "review" | "sent";

export function OralTask({
  type, title, targetSeconds, disabled, onSubmit,
}: {
  type: string;
  title: string;
  targetSeconds: number;
  disabled?: boolean;
  /** Receives the full work text (transcript, time, slides) for the teacher to grade. */
  onSubmit: (work: string) => void;
}) {
  const needs = oralNeedsSlides(type);
  const dict = useDictation();
  const [stage, setStage] = useState<Stage>("prepare");
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [plan, setPlan] = useState("");
  const [typed, setTyped] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);

  // Live clock while speaking.
  useEffect(() => {
    if (stage !== "speak") return;
    const id = window.setInterval(() => setElapsed(Math.round((Date.now() - startRef.current) / 1000)), 500);
    return () => window.clearInterval(id);
  }, [stage]);

  function begin() {
    setTyped("");
    setElapsed(0);
    startRef.current = Date.now();
    dict.start();
    setStage("speak");
  }

  function finish() {
    dict.stop();
    setSeconds(Math.round((Date.now() - startRef.current) / 1000));
    setStage("review");
  }

  function again() {
    dict.reset();
    setTyped("");
    setStage("prepare");
  }

  const transcript = dict.text.trim() || typed.trim();
  const usingTyped = !dict.text.trim();
  const stats = speakingStats(transcript, seconds);
  const enough = countWords(transcript) >= 8;
  const missingSlides = needs === "required" && !presentation;

  function send() {
    onSubmit(
      buildOralWork({
        title, targetSeconds, seconds, transcript, typedInstead: usingTyped,
        presentationText: presentation ? presentationToText(presentation) : undefined,
        planNotes: plan,
      }),
    );
    setStage("sent");
  }

  const rec = (
    <span className="flex items-center gap-2 rounded-sm bg-white/10 px-2 py-1 font-pixel text-[9px] text-white">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${dict.listening ? "animate-pulse bg-red-500" : "bg-gray-400"}`} />
      {formatClock(elapsed)} / {formatClock(targetSeconds)}
    </span>
  );

  // ── Speaking with slides ──
  if (stage === "speak" && presentation) {
    return <SlideShow presentation={presentation} onExit={finish} onFinish={finish} finishLabel="KLAR" extra={rec} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {stage === "prepare" && (
        <>
          <div className="rounded-sm border-l-4 border-accent bg-secondary/40 px-4 py-3 text-lg">
            <b>Så här går det till:</b> förbered dig, tryck på <b>Börja tala</b> och prata högt i ungefär{" "}
            <b>{formatClock(targetSeconds)}</b> minuter. Appen skriver ut det du säger, och läraren bedömer innehåll, struktur och språk.
            Röst, tonfall och kroppsspråk kan inte bedömas här.
          </div>

          {!dict.supported && (
            <p className="font-pixel text-[8px] leading-relaxed text-destructive">
              ✗ Din webbläsare kan inte skriva ut tal. Använd Chrome eller Safari för bästa resultat. Du kan ändå öva och sedan skriva ner vad du sa.
            </p>
          )}

          {needs !== "none" && (
            <section className="flex flex-col gap-2">
              <span className="font-pixel text-[8px] text-muted-foreground">
                BILDER {needs === "required" ? "(DU BEHÖVER EN PRESENTATION)" : "(VALFRITT)"}
              </span>
              {presentation ? (
                <div className="flex flex-wrap items-center gap-2 rounded-sm border-2 border-border bg-secondary/30 p-2">
                  <span className="min-w-0 flex-1 truncate text-lg font-bold">{presentation.title} · {presentation.slides.length} bilder</span>
                  <button onClick={() => setPickerOpen(true)} className={btn}>BYT / REDIGERA</button>
                  {needs === "optional" && <button onClick={() => setPresentation(null)} className={btn}>TA BORT</button>}
                </div>
              ) : (
                <button onClick={() => setPickerOpen(true)} className={`${btnAccent} self-start`}>SKAPA ELLER VÄLJ PRESENTATION</button>
              )}
              {pickerOpen && (
                <div className="rounded-sm border-2 border-border p-3">
                  <PresentationMaker onPick={(p) => { setPresentation(p); setPickerOpen(false); }} pickLabel="ANVÄND I UPPGIFTEN" />
                  <button onClick={() => setPickerOpen(false)} className={`${btn} mt-3`}>STÄNG</button>
                </div>
              )}
            </section>
          )}

          <label className="flex flex-col gap-1">
            <span className="font-pixel text-[8px] text-muted-foreground">STÖDORD (VALFRITT, VISAS FÖR DIG NÄR DU TALAR)</span>
            <textarea value={plan} onChange={(e) => setPlan(e.target.value)} rows={3} {...noCorr}
              placeholder="Inledning, huvudpunkter, avslutning…" className={area} />
          </label>

          <button onClick={begin} disabled={missingSlides || disabled} className={`${btnPrimary} self-start`}>● BÖRJA TALA</button>
          {missingSlides && <span className="font-pixel text-[8px] text-muted-foreground">Gör eller välj en presentation först.</span>}
        </>
      )}

      {stage === "speak" && !presentation && (
        <div className="flex flex-col gap-3 rounded-sm border-2 border-border p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-pixel text-[10px]">
              <span className={`inline-block h-3 w-3 rounded-full ${dict.listening ? "animate-pulse bg-red-500" : "bg-gray-400"}`} />
              {dict.listening ? "LYSSNAR…" : "MIKROFONEN ÄR AV"}
            </span>
            <span className="font-pixel text-[12px]">{formatClock(elapsed)} / {formatClock(targetSeconds)}</span>
          </div>
          {plan.trim() && <div className="whitespace-pre-wrap rounded-sm bg-secondary/40 p-3 text-lg">{plan}</div>}
          <p className="min-h-12 text-base italic text-muted-foreground">{dict.interim || dict.text.slice(-160) || "Börja tala när du är redo…"}</p>
          {dict.error && <span className="font-pixel text-[8px] text-destructive">✗ {dict.error}</span>}
          <button onClick={finish} className={`${btnAccent} self-start`}>■ KLAR</button>
        </div>
      )}

      {(stage === "review" || stage === "sent") && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ["TID", `${formatClock(stats.seconds)} (${lengthVerdict(stats.seconds, targetSeconds)})`],
              ["ORD", String(stats.words)],
              ["TEMPO", stats.wpm > 0 ? `${stats.wpm}/min · ${paceLabel(stats.wpm)}` : paceLabel(0)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-sm border-2 border-border bg-secondary/30 p-2">
                <div className="font-pixel text-[7px] text-muted-foreground">{k}</div>
                <div className="text-base font-bold">{v}</div>
              </div>
            ))}
          </div>

          {dict.text.trim() ? (
            <div className="flex flex-col gap-1">
              <span className="font-pixel text-[8px] text-muted-foreground">DET HÄR HÖRDE APPEN (FELHÖRNINGAR RÄKNAS INTE SOM DINA FEL)</span>
              <div className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-sm bg-chalk p-3 text-lg text-chalk-foreground">{dict.text}</div>
            </div>
          ) : (
            <label className="flex flex-col gap-1">
              <span className="font-pixel text-[8px] text-destructive">MIKROFONEN FÅNGADE INGENTING — SKRIV NER VAD DU SA SÅ GOTT DU KAN</span>
              <textarea value={typed} onChange={(e) => setTyped(e.target.value)} rows={6} {...noCorr} className={area} />
            </label>
          )}
          {dict.error && <span className="font-pixel text-[8px] text-destructive">✗ {dict.error}</span>}

          <div className="flex flex-wrap gap-2">
            {stage === "review" ? (
              <button onClick={send} disabled={!enough || disabled} className={btnPrimary}>SKICKA TILL LÄRAREN</button>
            ) : (
              <span className="font-pixel text-[9px] text-success">✓ SKICKAT — LÄRAREN BEDÖMER NU</span>
            )}
            <button onClick={again} disabled={disabled} className={btn}>GÖR OM</button>
          </div>
          {stage === "review" && !enough && <span className="font-pixel text-[8px] text-muted-foreground">Det är för lite text för att bedöma. Gör om, eller skriv ner mer.</span>}
        </div>
      )}
    </div>
  );
}
