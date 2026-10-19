import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  LAYOUTS, TEMPLATES, THEMES, MAX_SLIDES, addSlide, bulletsOf, createPresentation, deletePresentation,
  duplicateSlide, loadPresentations, moveSlide, removeSlide, savePresentations, themeOf, updateSlide,
  upsertPresentation, wordCount,
  type Presentation, type Slide, type SlideLayout, type ThemeId,
} from "@/lib/presentation";

const noCorr = { spellCheck: false, autoCorrect: "off", autoCapitalize: "off", autoComplete: "off" } as const;
const btn = "rounded-sm border-2 border-border bg-card px-3 py-1.5 font-pixel text-[9px] shadow-pixel-sm active:translate-y-0.5 active:shadow-none disabled:opacity-40";
const btnPrimary = "rounded-sm border-2 border-border bg-primary px-3 py-1.5 font-pixel text-[9px] text-primary-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none disabled:opacity-40";
const btnAccent = "rounded-sm border-2 border-border bg-accent px-3 py-1.5 font-pixel text-[9px] text-accent-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none disabled:opacity-40";
const input = "rounded-sm border-2 border-border bg-secondary/50 px-3 py-2 text-base outline-none focus:border-ring";

// ── One slide, drawn at 16:9 and scaled with its container ────────────────────

export function SlideView({ slide, themeId, className = "" }: { slide: Slide; themeId: ThemeId; className?: string }) {
  const t = themeOf(themeId);
  const b1 = bulletsOf(slide.body);
  const b2 = bulletsOf(slide.body2);
  const wrap: CSSProperties = { background: t.bg, color: t.fg, containerType: "inline-size" } as CSSProperties;
  const inner: CSSProperties = { padding: "4cqw", gap: "2cqw" };
  const title = (size: string) => (slide.title ? <div style={{ fontSize: size, fontWeight: 800, lineHeight: 1.15, color: t.accent }}>{slide.title}</div> : null);
  const list = (items: string[]) => (
    <ul style={{ fontSize: "3.4cqw", lineHeight: 1.35, display: "flex", flexDirection: "column", gap: "1cqw" }}>
      {items.map((x, i) => (
        <li key={i} style={{ display: "flex", gap: "1.5cqw" }}>
          <span style={{ color: t.accent }}>▪</span>
          <span>{x}</span>
        </li>
      ))}
    </ul>
  );

  let content: ReactNode;
  switch (slide.layout) {
    case "title":
      content = (
        <div className="flex h-full flex-col items-center justify-center text-center" style={{ gap: "2cqw" }}>
          {title("7.5cqw")}
          {slide.body && <div style={{ fontSize: "3.6cqw", color: t.muted, whiteSpace: "pre-wrap" }}>{slide.body}</div>}
        </div>
      );
      break;
    case "image-text":
      content = (
        <div className="flex h-full flex-col" style={{ gap: "2cqw" }}>
          {title("5.5cqw")}
          <div className="flex min-h-0 flex-1" style={{ gap: "3cqw" }}>
            <div className="min-h-0 flex-1 overflow-hidden" style={{ borderRadius: "1cqw", background: `${t.muted}33` }}>
              {slide.image ? (
                <img src={slide.image} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center" style={{ fontSize: "3cqw", color: t.muted }}>Ingen bild</div>
              )}
            </div>
            <div className="flex-1" style={{ fontSize: "3.4cqw", lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
              {b1.length > 1 ? list(b1) : slide.body}
            </div>
          </div>
        </div>
      );
      break;
    case "two-columns":
      content = (
        <div className="flex h-full flex-col" style={{ gap: "2cqw" }}>
          {title("5.5cqw")}
          <div className="flex flex-1" style={{ gap: "4cqw" }}>
            <div className="flex-1">{list(b1)}</div>
            <div style={{ width: "0.4cqw", background: t.accent, borderRadius: "1cqw" }} />
            <div className="flex-1">{list(b2)}</div>
          </div>
        </div>
      );
      break;
    case "quote":
      content = (
        <div className="flex h-full flex-col items-center justify-center text-center" style={{ gap: "2.5cqw", padding: "3cqw" }}>
          {title("3.6cqw")}
          <div style={{ fontSize: "5.4cqw", fontWeight: 700, lineHeight: 1.25, whiteSpace: "pre-wrap" }}>{slide.body}</div>
        </div>
      );
      break;
    case "bullets":
      content = (
        <div className="flex h-full flex-col" style={{ gap: "2.5cqw" }}>
          {title("5.5cqw")}
          {list(b1)}
        </div>
      );
      break;
    default:
      content = (
        <div className="flex h-full flex-col" style={{ gap: "2cqw" }}>
          {title("5.5cqw")}
          <div style={{ fontSize: "3.4cqw", lineHeight: 1.4, whiteSpace: "pre-wrap" }}>{slide.body}</div>
        </div>
      );
  }

  return (
    <div className={`aspect-video w-full overflow-hidden rounded-sm border-2 border-border ${className}`} style={wrap}>
      <div className="h-full w-full" style={inner}>{content}</div>
    </div>
  );
}

// ── Full-screen slideshow ─────────────────────────────────────────────────────

export function SlideShow({
  presentation, onExit, onSlideChange, extra, finishLabel, onFinish,
}: {
  presentation: Presentation;
  onExit: () => void;
  onSlideChange?: (index: number) => void;
  /** Controls shown at the top right (for example a recording indicator). */
  extra?: ReactNode;
  finishLabel?: string;
  onFinish?: () => void;
}) {
  const [i, setI] = useState(0);
  const [notes, setNotes] = useState(false);
  const last = presentation.slides.length - 1;
  const slide = presentation.slides[Math.min(i, last)];

  function go(n: number) {
    const next = Math.min(Math.max(n, 0), last);
    setI(next);
    onSlideChange?.(next);
  }

  useEffect(() => {
    onSlideChange?.(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); go(i + 1); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); go(i - 1); }
      else if (e.key === "Escape") onExit();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col gap-3 bg-black/95 p-3 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <span className="font-pixel text-[9px] text-white/80">{Math.min(i, last) + 1} / {last + 1}</span>
        <div className="flex items-center gap-2">
          {extra}
          <button onClick={() => setNotes((n) => !n)} className={btn}>{notes ? "DÖLJ STÖD" : "VISA STÖD"}</button>
          <button onClick={onExit} className={btn}>AVSLUTA</button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="w-full" style={{ maxWidth: "min(100%, 160vh)" }}>
          <SlideView slide={slide} themeId={presentation.themeId} />
        </div>
      </div>
      {notes && (
        <div className="max-h-28 overflow-y-auto rounded-sm bg-white/10 p-3 text-base text-white/90 whitespace-pre-wrap">
          {slide.notes.trim() || "Inga anteckningar på den här bilden."}
        </div>
      )}
      <div className="flex items-center justify-center gap-3">
        <button onClick={() => go(i - 1)} disabled={i === 0} className={`${btn} min-w-24 !py-3`}>← FÖREGÅENDE</button>
        {i < last ? (
          <button onClick={() => go(i + 1)} className={`${btnPrimary} min-w-24 !py-3`}>NÄSTA →</button>
        ) : (
          <button onClick={onFinish ?? onExit} className={`${btnAccent} min-w-24 !py-3`}>{finishLabel ?? "KLAR"}</button>
        )}
      </div>
    </div>
  );
}

// ── Image upload (downscaled so it fits in localStorage) ──────────────────────

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        let max = 900;
        let quality = 0.72;
        let out = "";
        for (let attempt = 0; attempt < 3; attempt++) {
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(img.width * scale));
          c.height = Math.max(1, Math.round(img.height * scale));
          c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
          out = c.toDataURL("image/jpeg", quality);
          if (out.length < 300_000) break;
          max = Math.round(max * 0.75);
          quality -= 0.15;
        }
        resolve(out);
      } catch (e) {
        reject(e);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Kunde inte läsa bilden")); };
    img.src = url;
  });
}

// ── Editor ────────────────────────────────────────────────────────────────────

function Editor({
  p, onChange, onClose, onPresent, onPick, pickLabel,
}: {
  p: Presentation;
  onChange: (p: Presentation) => void;
  onClose: () => void;
  onPresent: () => void;
  onPick?: (p: Presentation) => void;
  pickLabel?: string;
}) {
  const [idx, setIdx] = useState(0);
  const [imgErr, setImgErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const cur = Math.min(idx, p.slides.length - 1);
  const slide = p.slides[cur];
  const layout = LAYOUTS.find((l) => l.id === slide.layout) ?? LAYOUTS[0];
  const has = (f: string) => (layout.fields as string[]).includes(f);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setImgErr("");
    try {
      onChange(updateSlide(p, cur, { image: await readImage(file) }));
    } catch (e) {
      setImgErr(e instanceof Error ? e.message : "Bilden gick inte att använda");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input value={p.title} onChange={(e) => onChange({ ...p, title: e.target.value, updatedAt: Date.now() })} {...noCorr}
          aria-label="Titel på presentationen" className={`${input} min-w-0 flex-1 font-bold`} />
        <button onClick={onPresent} className={btnAccent}>▶ PRESENTERA</button>
        {onPick && <button onClick={() => onPick(p)} className={btnPrimary}>{pickLabel ?? "ANVÄND"}</button>}
        <button onClick={onClose} className={btn}>KLAR</button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-pixel text-[8px] text-muted-foreground">FÄRGER</span>
        {THEMES.map((t) => (
          <button key={t.id} onClick={() => onChange({ ...p, themeId: t.id, updatedAt: Date.now() })} title={t.name}
            className={`flex items-center gap-1 rounded-sm border-2 px-2 py-1 text-sm ${p.themeId === t.id ? "border-ring" : "border-border"}`}>
            <span className="inline-block h-4 w-4 rounded-sm border border-border" style={{ background: t.bg }} />
            <span className="inline-block h-4 w-4 rounded-sm border border-border" style={{ background: t.accent }} />
            {t.name}
          </button>
        ))}
        <span className="ml-auto font-pixel text-[8px] text-muted-foreground">{p.slides.length} BILDER · {wordCount(p)} ORD</span>
      </div>

      <div className="grid gap-4 md:grid-cols-[170px_1fr]">
        <div className="flex gap-2 overflow-x-auto md:max-h-[34rem] md:flex-col md:overflow-y-auto md:overflow-x-visible">
          {p.slides.map((s, i) => (
            <button key={s.id} onClick={() => setIdx(i)}
              className={`w-36 shrink-0 rounded-sm border-2 p-1 text-left md:w-full ${i === cur ? "border-ring bg-secondary" : "border-border"}`}>
              <span className="font-pixel text-[7px] text-muted-foreground">{i + 1}</span>
              <SlideView slide={s} themeId={p.themeId} />
            </button>
          ))}
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <SlideView slide={slide} themeId={p.themeId} />

          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => onChange(moveSlide(p, cur, cur - 1))} disabled={cur === 0} className={btn} aria-label="Flytta bilden uppåt">↑</button>
            <button onClick={() => { onChange(moveSlide(p, cur, cur + 1)); setIdx(cur + 1); }} disabled={cur === p.slides.length - 1} className={btn} aria-label="Flytta bilden nedåt">↓</button>
            <button onClick={() => { onChange(duplicateSlide(p, cur)); setIdx(cur + 1); }} disabled={p.slides.length >= MAX_SLIDES} className={btn}>KOPIERA</button>
            <button onClick={() => { onChange(removeSlide(p, cur)); setIdx(Math.max(0, cur - 1)); }} disabled={p.slides.length <= 1} className={btn}>TA BORT</button>
          </div>

          <label className="flex flex-col gap-1">
            <span className="font-pixel text-[8px] text-muted-foreground">UTSEENDE PÅ DEN HÄR BILDEN</span>
            <select value={slide.layout} onChange={(e) => onChange(updateSlide(p, cur, { layout: e.target.value as SlideLayout }))} className={input}>
              {LAYOUTS.map((l) => <option key={l.id} value={l.id}>{l.name} – {l.description}</option>)}
            </select>
          </label>

          {has("title") && (
            <label className="flex flex-col gap-1">
              <span className="font-pixel text-[8px] text-muted-foreground">RUBRIK</span>
              <input value={slide.title} onChange={(e) => onChange(updateSlide(p, cur, { title: e.target.value }))} {...noCorr} className={input} />
            </label>
          )}
          {has("body") && (
            <label className="flex flex-col gap-1">
              <span className="font-pixel text-[8px] text-muted-foreground">
                {slide.layout === "bullets" || slide.layout === "two-columns" ? "TEXT (EN PUNKT PER RAD)" : "TEXT"}
              </span>
              <textarea value={slide.body} rows={4} onChange={(e) => onChange(updateSlide(p, cur, { body: e.target.value }))} {...noCorr} className={`${input} resize-none`} />
            </label>
          )}
          {has("body2") && (
            <label className="flex flex-col gap-1">
              <span className="font-pixel text-[8px] text-muted-foreground">ANDRA KOLUMNEN (EN PUNKT PER RAD)</span>
              <textarea value={slide.body2} rows={4} onChange={(e) => onChange(updateSlide(p, cur, { body2: e.target.value }))} {...noCorr} className={`${input} resize-none`} />
            </label>
          )}
          {has("image") && (
            <div className="flex flex-col gap-1">
              <span className="font-pixel text-[8px] text-muted-foreground">BILD</span>
              <div className="flex flex-wrap items-center gap-2">
                <input ref={fileRef} type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} className="text-sm" />
                {slide.image && <button onClick={() => onChange(updateSlide(p, cur, { image: "" }))} className={btn}>TA BORT BILD</button>}
              </div>
              {imgErr && <span className="font-pixel text-[8px] text-destructive">✗ {imgErr}</span>}
            </div>
          )}
          <label className="flex flex-col gap-1">
            <span className="font-pixel text-[8px] text-muted-foreground">TALARSTÖD (SYNS BARA FÖR DIG NÄR DU PRESENTERAR)</span>
            <textarea value={slide.notes} rows={3} onChange={(e) => onChange(updateSlide(p, cur, { notes: e.target.value }))} {...noCorr}
              placeholder="Stödord eller det du vill komma ihåg att säga…" className={`${input} resize-none`} />
          </label>

          <div className="flex flex-col gap-1">
            <span className="font-pixel text-[8px] text-muted-foreground">LÄGG TILL NY BILD EFTER DEN HÄR</span>
            <div className="flex flex-wrap gap-1.5">
              {LAYOUTS.map((l) => (
                <button key={l.id} disabled={p.slides.length >= MAX_SLIDES}
                  onClick={() => { onChange(addSlide(p, l.id, cur)); setIdx(cur + 1); }} className={btn} title={l.description}>
                  + {l.name.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── The maker: saved presentations, templates, editor ─────────────────────────

export function PresentationMaker({
  onExit, onPick, pickLabel,
}: {
  onExit?: () => void;
  /** When set (for example inside an oral assignment) each presentation can be chosen for the task. */
  onPick?: (p: Presentation) => void;
  pickLabel?: string;
}) {
  const [list, setList] = useState<Presentation[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showing, setShowing] = useState(false);
  const [saveErr, setSaveErr] = useState(false);

  useEffect(() => {
    setList(loadPresentations(window.localStorage));
    setLoaded(true);
  }, []);

  function commit(next: Presentation[]) {
    setList(next);
    setSaveErr(!savePresentations(window.localStorage, next));
  }
  function change(p: Presentation) { commit(upsertPresentation(list, p)); }
  function create(templateId: string) {
    const p = createPresentation(templateId);
    commit(upsertPresentation(list, p));
    setOpenId(p.id);
  }

  const open = list.find((x) => x.id === openId) ?? null;

  if (open && showing) return <SlideShow presentation={open} onExit={() => setShowing(false)} />;

  return (
    <div className="flex flex-col gap-4">
      {!onPick && (
        <div className="pixel-panel flex items-center justify-between gap-2 rounded-sm bg-card p-3">
          <span className="font-pixel text-[11px] text-primary">PRESENTATIONER</span>
          {onExit && <button onClick={onExit} className={btn}>KARTAN</button>}
        </div>
      )}

      {saveErr && (
        <p className="font-pixel text-[9px] leading-relaxed text-destructive">
          ✗ Det gick inte att spara. Webbläsarens utrymme är fullt – ta bort en bild eller en gammal presentation.
        </p>
      )}

      {open ? (
        <div className="pixel-panel rounded-sm bg-card p-4">
          <Editor p={open} onChange={change} onClose={() => setOpenId(null)} onPresent={() => setShowing(true)} onPick={onPick} pickLabel={pickLabel} />
        </div>
      ) : (
        <>
          <section className="pixel-panel flex flex-col gap-3 rounded-sm bg-card p-4">
            <span className="font-pixel text-[9px] text-muted-foreground">STARTA EN NY PRESENTATION</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => create(t.id)}
                  className="flex flex-col gap-1 rounded-sm border-2 border-border bg-secondary/40 p-3 text-left shadow-pixel-sm active:translate-y-0.5 active:shadow-none">
                  <span className="font-pixel text-[9px]">{t.name.toUpperCase()}</span>
                  <span className="text-base text-muted-foreground">{t.description}</span>
                  <span className="font-pixel text-[7px] text-muted-foreground">{t.slides.length} BILDER</span>
                </button>
              ))}
            </div>
          </section>

          <section className="pixel-panel flex flex-col gap-3 rounded-sm bg-card p-4">
            <span className="font-pixel text-[9px] text-muted-foreground">DINA PRESENTATIONER</span>
            {!loaded ? null : list.length === 0 ? (
              <p className="text-muted-foreground">Du har inga sparade presentationer än. Välj en mall ovan för att börja.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {list.map((x) => (
                  <li key={x.id} className="flex flex-wrap items-center gap-2 rounded-sm border-2 border-border bg-secondary/30 p-2">
                    <div className="w-24 shrink-0"><SlideView slide={x.slides[0]} themeId={x.themeId} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-lg font-bold">{x.title}</div>
                      <div className="font-pixel text-[7px] text-muted-foreground">{x.slides.length} BILDER · {wordCount(x)} ORD</div>
                    </div>
                    {onPick && <button onClick={() => onPick(x)} className={btnPrimary}>{pickLabel ?? "ANVÄND"}</button>}
                    <button onClick={() => setOpenId(x.id)} className={btn}>REDIGERA</button>
                    <button onClick={() => { if (window.confirm(`Ta bort "${x.title}"?`)) commit(deletePresentation(list, x.id)); }} className={btn}>TA BORT</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
