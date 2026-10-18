/**
 * Data layer for the simple presentation maker (browser-safe, no React).
 * Slides, templates, themes, safe loading/saving and a plain-text export used when
 * a presentation is graded as an oral task.
 */

export type SlideLayout = "title" | "bullets" | "image-text" | "two-columns" | "quote" | "blank";
export type ThemeId = "chalk" | "night" | "forest" | "sunset";
export type SlideField = "title" | "body" | "body2" | "image";

export type Slide = {
  id: string;
  layout: SlideLayout;
  title: string;
  body: string;
  body2: string;
  /** Downscaled JPEG data URL, or "" */
  image: string;
  /** Speaker notes (talmanus / stödord). Never shown on the slide itself. */
  notes: string;
};

export type Presentation = {
  id: string;
  title: string;
  themeId: ThemeId;
  slides: Slide[];
  updatedAt: number;
};

export const PRESENTATIONS_KEY = "svenska-quest-presentations-v1";
export const MAX_SLIDES = 30;

export const LAYOUTS: { id: SlideLayout; name: string; description: string; fields: SlideField[] }[] = [
  { id: "title", name: "Titel", description: "Stor rubrik med en underrubrik", fields: ["title", "body"] },
  { id: "bullets", name: "Punkter", description: "Rubrik och en lista med punkter", fields: ["title", "body"] },
  { id: "image-text", name: "Bild + text", description: "En bild bredvid en kort text", fields: ["title", "body", "image"] },
  { id: "two-columns", name: "Två kolumner", description: "Jämför två saker", fields: ["title", "body", "body2"] },
  { id: "quote", name: "Citat / budskap", description: "En stor mening att komma ihåg", fields: ["title", "body"] },
  { id: "blank", name: "Tom", description: "Bara en rubrik och fri text", fields: ["title", "body"] },
];

export const THEMES: { id: ThemeId; name: string; bg: string; fg: string; accent: string; muted: string }[] = [
  { id: "chalk", name: "Krita", bg: "#f6f1e4", fg: "#2b2a33", accent: "#c2410c", muted: "#6b6a73" },
  { id: "night", name: "Natt", bg: "#1e1b3a", fg: "#f4f1ff", accent: "#fbbf24", muted: "#b8b2dd" },
  { id: "forest", name: "Skog", bg: "#173a2c", fg: "#effbf3", accent: "#86efac", muted: "#a7d3b6" },
  { id: "sunset", name: "Solnedgång", bg: "#fff1e6", fg: "#3b1d0e", accent: "#db2777", muted: "#8a5a44" },
];

export function themeOf(id: string) {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

let idCounter = 0;
export function newId(): string {
  idCounter += 1;
  return `${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createSlide(layout: SlideLayout, fields: Partial<Omit<Slide, "id" | "layout">> = {}): Slide {
  return { id: newId(), layout, title: "", body: "", body2: "", image: "", notes: "", ...fields };
}

type TemplateSlide = { layout: SlideLayout } & Partial<Omit<Slide, "id" | "layout">>;

export const TEMPLATES: { id: string; name: string; description: string; title: string; slides: TemplateSlide[] }[] = [
  {
    id: "blank",
    name: "Från början",
    description: "En tom start. Lägg till egna bilder.",
    title: "Min presentation",
    slides: [{ layout: "title", title: "Rubrik", body: "Ditt namn" }],
  },
  {
    id: "topic",
    name: "Berätta om något jag gillar",
    description: "En hobby, ett intresse, en plats eller en person.",
    title: "Det här gillar jag",
    slides: [
      { layout: "title", title: "Titel på ditt ämne", body: "Ditt namn" },
      { layout: "bullets", title: "Vad är det?", body: "- Förklara kort vad det handlar om\n- Ge ett exempel\n- Berätta när du började" },
      { layout: "image-text", title: "Så ser det ut", body: "Berätta om bilden med egna ord." },
      { layout: "bullets", title: "Varför gillar jag det?", body: "- Min första anledning\n- Min andra anledning\n- Något som överraskar" },
      { layout: "quote", title: "Det viktigaste", body: "Skriv en mening som publiken ska komma ihåg." },
    ],
  },
  {
    id: "opinion",
    name: "Argumentera för min åsikt",
    description: "Ett kort anförande där du övertygar med argument.",
    title: "Min åsikt",
    slides: [
      { layout: "title", title: "Min åsikt: …", body: "Ditt namn" },
      { layout: "bullets", title: "Varför bryr jag mig?", body: "- Något som fångar publiken\n- Vad frågan handlar om" },
      { layout: "bullets", title: "Argument 1", body: "- Mitt argument\n- Ett exempel eller en fakta som stödjer det" },
      { layout: "bullets", title: "Argument 2", body: "- Mitt argument\n- Ett exempel eller en fakta som stödjer det" },
      { layout: "two-columns", title: "Vad säger de som tycker annorlunda?", body: "- Deras argument", body2: "- Mitt svar" },
      { layout: "quote", title: "Sammanfattning", body: "Därför tycker jag att …" },
    ],
  },
  {
    id: "facts",
    name: "Redovisa ett ämne (fakta)",
    description: "Fakta, jämförelse och källor, som en skolredovisning.",
    title: "Redovisning",
    slides: [
      { layout: "title", title: "Ämnets namn", body: "Ditt namn" },
      { layout: "bullets", title: "Fakta", body: "- Viktig fakta 1\n- Viktig fakta 2\n- Viktig fakta 3" },
      { layout: "two-columns", title: "Jämförelse", body: "- Egenskaper hos A", body2: "- Egenskaper hos B" },
      { layout: "bullets", title: "Mina källor", body: "- Källa 1\n- Källa 2" },
      { layout: "title", title: "Frågor?", body: "Tack för att ni lyssnade" },
    ],
  },
  {
    id: "story",
    name: "Berätta en historia",
    description: "Muntligt berättande med början, vändpunkt och slut.",
    title: "Min berättelse",
    slides: [
      { layout: "title", title: "Berättelsens titel", body: "Ditt namn" },
      { layout: "bullets", title: "Början", body: "- Vem är det? Var är de?\n- Hur ser en vanlig dag ut?" },
      { layout: "bullets", title: "Problemet", body: "- Vad händer som ändrar allt?" },
      { layout: "bullets", title: "Vändpunkten", body: "- Vad gör huvudpersonen?" },
      { layout: "quote", title: "Slutet", body: "Hur slutar det, och vad lärde sig personen?" },
    ],
  },
];

export function createPresentation(templateId: string, title?: string): Presentation {
  const t = TEMPLATES.find((x) => x.id === templateId) ?? TEMPLATES[0];
  return {
    id: newId(),
    title: (title ?? t.title).trim() || t.title,
    themeId: "chalk",
    slides: t.slides.map(({ layout, ...rest }) => createSlide(layout, rest)),
    updatedAt: Date.now(),
  };
}

function touched(p: Presentation, slides: Slide[]): Presentation {
  return { ...p, slides, updatedAt: Date.now() };
}

export function updateSlide(p: Presentation, index: number, patch: Partial<Omit<Slide, "id">>): Presentation {
  if (index < 0 || index >= p.slides.length) return p;
  return touched(p, p.slides.map((s, i) => (i === index ? { ...s, ...patch } : s)));
}

export function addSlide(p: Presentation, layout: SlideLayout, afterIndex: number = p.slides.length - 1): Presentation {
  if (p.slides.length >= MAX_SLIDES) return p;
  const at = Math.min(Math.max(afterIndex + 1, 0), p.slides.length);
  const slides = [...p.slides];
  slides.splice(at, 0, createSlide(layout, layout === "title" ? { title: "Ny rubrik" } : { title: "Ny bild" }));
  return touched(p, slides);
}

export function duplicateSlide(p: Presentation, index: number): Presentation {
  if (index < 0 || index >= p.slides.length || p.slides.length >= MAX_SLIDES) return p;
  const slides = [...p.slides];
  slides.splice(index + 1, 0, { ...p.slides[index], id: newId() });
  return touched(p, slides);
}

/** A presentation always keeps at least one slide. */
export function removeSlide(p: Presentation, index: number): Presentation {
  if (p.slides.length <= 1 || index < 0 || index >= p.slides.length) return p;
  return touched(p, p.slides.filter((_, i) => i !== index));
}

export function moveSlide(p: Presentation, from: number, to: number): Presentation {
  const last = p.slides.length - 1;
  if (from < 0 || from > last) return p;
  const target = Math.min(Math.max(to, 0), last);
  if (target === from) return p;
  const slides = [...p.slides];
  const [s] = slides.splice(from, 1);
  slides.splice(target, 0, s);
  return touched(p, slides);
}

/** Lines of a body text as bullet items (leading -, •, * or – is stripped). */
export function bulletsOf(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.replace(/^\s*[-•*–]\s*/, "").trim())
    .filter(Boolean);
}

function words(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export function wordCount(p: Presentation): number {
  return p.slides.reduce((n, s) => n + words(s.title) + words(s.body) + words(s.body2), 0);
}

/** Plain-text version of the slides, shown to the teacher when an oral task is graded. */
export function presentationToText(p: Presentation): string {
  const layoutName = (l: SlideLayout) => LAYOUTS.find((x) => x.id === l)?.name ?? l;
  const lines = [`Presentation: "${p.title}" (${p.slides.length} bilder)`];
  p.slides.forEach((s, i) => {
    const parts = [`Bild ${i + 1} (${layoutName(s.layout)})`];
    if (s.title.trim()) parts.push(`rubrik: ${s.title.trim()}`);
    const b = bulletsOf(s.body);
    if (b.length) parts.push(`text: ${b.join(" / ")}`);
    const b2 = bulletsOf(s.body2);
    if (b2.length) parts.push(`kolumn 2: ${b2.join(" / ")}`);
    if (s.image) parts.push("bild: ja");
    if (s.notes.trim()) parts.push("talarstöd: ja");
    lines.push(parts.join(" · "));
  });
  return lines.join("\n");
}

// ── Safe storage ─────────────────────────────────────────────────────────────

const LAYOUT_IDS = LAYOUTS.map((l) => l.id as string);
const THEME_IDS = THEMES.map((t) => t.id as string);
const str = (v: unknown) => (typeof v === "string" ? v : "");

function parseSlide(raw: unknown): Slide | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const layout = LAYOUT_IDS.includes(str(r.layout)) ? (r.layout as SlideLayout) : "blank";
  return {
    id: str(r.id) || newId(),
    layout,
    title: str(r.title),
    body: str(r.body),
    body2: str(r.body2),
    image: str(r.image).startsWith("data:image/") ? str(r.image) : "",
    notes: str(r.notes),
  };
}

export function parsePresentations(raw: string | null | undefined): Presentation[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const out: Presentation[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const slides = (Array.isArray(r.slides) ? r.slides : []).map(parseSlide).filter((s): s is Slide => s !== null).slice(0, MAX_SLIDES);
    if (!slides.length) continue;
    out.push({
      id: str(r.id) || newId(),
      title: str(r.title).trim() || "Utan titel",
      themeId: THEME_IDS.includes(str(r.themeId)) ? (r.themeId as ThemeId) : "chalk",
      slides,
      updatedAt: typeof r.updatedAt === "number" ? r.updatedAt : 0,
    });
  }
  return out;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function loadPresentations(storage: StorageLike): Presentation[] {
  try {
    return parsePresentations(storage.getItem(PRESENTATIONS_KEY));
  } catch {
    return [];
  }
}

/** Returns false when the browser refuses the write (for example a full quota). */
export function savePresentations(storage: StorageLike, list: Presentation[]): boolean {
  try {
    storage.setItem(PRESENTATIONS_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function upsertPresentation(list: Presentation[], p: Presentation): Presentation[] {
  const exists = list.some((x) => x.id === p.id);
  const next = exists ? list.map((x) => (x.id === p.id ? p : x)) : [p, ...list];
  return [...next].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function deletePresentation(list: Presentation[], id: string): Presentation[] {
  return list.filter((x) => x.id !== id);
}
