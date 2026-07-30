import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

const KEY_STORE = "svenska-quest-classroom-gemini-key";
const BOOK_STORE = "svenska-quest-classbook-v1";
const MODEL = "gemini-3.1-flash-lite";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// ── Types ─────────────────────────────────────────────────────────────────────

type LG = "A" | "B" | "C" | "D" | "E" | "F";
const GV: Record<LG, number> = { A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 };
const GC: Record<LG, string> = {
  A: "text-emerald-700", B: "text-green-600", C: "text-yellow-600",
  D: "text-orange-500", E: "text-red-500", F: "text-red-700",
};
const GB: Record<LG, string> = {
  A: "bg-emerald-50 border-emerald-300", B: "bg-green-50 border-green-200",
  C: "bg-yellow-50 border-yellow-200", D: "bg-orange-50 border-orange-200",
  E: "bg-red-50 border-red-200", F: "bg-red-100 border-red-300",
};

interface ChapterMeta { number: number; title: string }
interface BookOption {
  id: string; title: string; author: string; genre: string;
  synopsis: string; chapters: ChapterMeta[];
}
interface ChapterContent { number: number; title: string; content: string }
interface Question { number: number; question: string; type: string }
interface Answer { questionNumber: number; text: string }
interface QuestionResult { number: number; question: string; answer: string; grade: LG; feedback: string }
interface ChapterResult {
  chapterNumber: number; chapterTitle: string;
  questionResults: QuestionResult[];
  overallGrade: LG; teacherComment: string; strengths: string; improvements: string;
}
interface BookProgress {
  book: BookOption; completedChapters: ChapterResult[]; nextChapter: number;
}

type Phase =
  | { name: "loading-books" }
  | { name: "select-book"; books: BookOption[]; savedProgress: BookProgress | null }
  | { name: "loading-chapter"; book: BookOption; chapterNum: number }
  | { name: "reading"; chapter: ChapterContent; questions: Question[]; book: BookOption; progress: BookProgress }
  | { name: "questions"; chapter: ChapterContent; questions: Question[]; currentQ: number; answers: Answer[]; currentText: string; book: BookOption; progress: BookProgress }
  | { name: "grading"; book: BookOption }
  | { name: "chapter-result"; result: ChapterResult; progress: BookProgress }
  | { name: "book-complete"; progress: BookProgress };

// ── Storage ───────────────────────────────────────────────────────────────────

function loadKey(): string { try { return localStorage.getItem(KEY_STORE) ?? ""; } catch { return ""; } }
function loadSaved(): BookProgress | null { try { const r = localStorage.getItem(BOOK_STORE); return r ? JSON.parse(r) : null; } catch { return null; } }
function saveProgress(p: BookProgress) { try { localStorage.setItem(BOOK_STORE, JSON.stringify(p)); } catch {} }
function clearProgress() { try { localStorage.removeItem(BOOK_STORE); } catch {} }

// ── API ───────────────────────────────────────────────────────────────────────

async function gemini(key: string, prompt: string, maxTokens = 1500): Promise<string> {
  const res = await fetch(`${API_BASE}/${MODEL}:generateContent?key=${key}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.85, maxOutputTokens: maxTokens },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const d = await res.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

function parseJSON<T>(raw: string): T {
  const start = raw.search(/[{\[]/);
  const trimmed = start >= 0 ? raw.slice(start) : raw;
  const clean = trimmed.replace(/```(?:json)?\n?/g, "").replace(/```\n?/g, "").trim();
  const last = Math.max(clean.lastIndexOf("}"), clean.lastIndexOf("]"));
  return JSON.parse(last >= 0 ? clean.slice(0, last + 1) : clean);
}

function avgGrade(chapters: ChapterResult[]): LG {
  if (!chapters.length) return "F";
  const avg = chapters.reduce((s, c) => s + GV[c.overallGrade], 0) / chapters.length;
  if (avg >= 4.5) return "A"; if (avg >= 3.5) return "B"; if (avg >= 2.5) return "C";
  if (avg >= 1.5) return "D"; if (avg >= 0.5) return "E"; return "F";
}

// ── Prompts ───────────────────────────────────────────────────────────────────

const booksPrompt = () =>
  `Generera 3 olika svenska romaner för elever i år 7/8 (13-14 år, B1-nivå). Varje bok ska kännas som en riktig publicerad roman med engagerande karaktärer, trovärdiga handlingar och åldersanpassade teman. Variera genrerna — t.ex. mysterium, realistisk ungdomsroman, historisk fiction, thriller. Svenska miljöer och karaktärer.

Returnera BARA giltig JSON utan markdown-tecken:
[
  {
    "id": "unik-slug",
    "title": "Titel",
    "author": "Fiktivt svenskt författarnamn",
    "genre": "Genre",
    "synopsis": "2-3 meningar engagerande synopsis",
    "chapters": [
      {"number":1,"title":"Kapiteltitel"},
      {"number":2,"title":"Kapiteltitel"},
      {"number":3,"title":"Kapiteltitel"},
      {"number":4,"title":"Kapiteltitel"},
      {"number":5,"title":"Kapiteltitel"}
    ]
  }
]
Exakt 3 böcker.`;

const chapterPrompt = (book: BookOption, num: number, title: string, done: ChapterResult[]) => {
  const prev = done.length
    ? `\nTidigare kapitel: ${done.map(c => `Kap. ${c.chapterNumber} – ${c.chapterTitle}`).join(", ")}.`
    : "";
  return `Du skriver kapitel ${num} av "${book.title}" av ${book.author}.

Synopsis: ${book.synopsis}
Kapitelrubrik: "${title}"${prev}

Skriv ett engagerande kapitel för elever i år 7/8 (B1 svenska).
Krav:
- 700–800 ord
- Rika miljöbeskrivningar med minst 3 sinnesintryck
- Realistiska dialoger med korrekt interpunktion
- Karaktärers inre tankar och känslor
- Avslutas med ett ögonblick som skapar nyfikenhet
- Ska kännas som ett kapitel ur en riktig publicerad roman

Skriv BARA kapiteltext. Inga titlar eller rubriker.`;
};

const questionsPrompt = (title: string, content: string) =>
  `Du har just läst detta kapitel ur "${title}":

${content}

Generera exakt 10 provfrågor för år 7/8-elever om detta kapitel.
Mix:
- 2 förståelsefrågor (vad hände — formulera så att korta svar inte räcker)
- 2 analysfrågor (varför, vad säger det om karaktären/temat)
- 2 slutledningsfrågor (läs mellan raderna, vad antyder texten)
- 2 reflektionsfrågor (koppla till egna erfarenheter och åsikter)
- 1 karaktärsfråga (känslor, motivation, utveckling)
- 1 språkfråga (hur beskriver författaren X, vilken effekt skapar det)

Returnera BARA giltig JSON utan markdown:
[{"number":1,"question":"...","type":"förståelse"},...]
Exakt 10 frågor.`;

const gradingPrompt = (bookTitle: string, chapterTitle: string, content: string, qAndA: string) =>
  `Du är en kunnig och rättvis svensk lärare som bedömer en elev i år 7/8.

KAPITEL "${chapterTitle}" ur "${bookTitle}":
${content}

ELEVENS SVAR:
${qAndA}

Betygsätt VARJE svar baserat på TANKEKVALITET och RESONEMANG — INTE faktariktighet. Ett genomtänkt, välargumenterat svar som avviker från det "förväntade" svaret ska ha högt betyg. Ett minimalt "rätt" svar ska ha lågt betyg.

Betygskriterier:
A: Genomarbetat, nyanserat svar. Specifika textbelägg OCH/ELLER djup personlig reflektion. Tydlig argumentation. Går bortom det uppenbara.
B: Bra svar med tydlig argumentation. Viss textanknytning eller reflektion. Besvarar frågan väl med viss utveckling.
C: Godkänt men ytligt. Besvarar frågan men utan djup eller argumentation. Begränsad utveckling.
D: Delvis relevant. Vagt eller underutvecklat resonemang. Påbörjat men inte fullföljt.
E: Minimalt svar. Mycket kort, knappt relevant, dålig struktur.
F: Inget svar, helt off-topic, eller enstaka ord.

VIKTIGT: Bedöm TANKEKVALITETEN. 3 välskrivna meningar med eget resonemang → B eller högre. 1 korrekt faktamening utan utveckling → D eller E.

Returnera BARA giltig JSON utan markdown:
{
  "questionResults": [
    {"number": 1, "grade": "A", "feedback": "Specifik, konstruktiv feedback på svenska (2-3 meningar). Vad var bra, vad kunde fördjupas."},
    ... alla 10
  ],
  "overallGrade": "B",
  "teacherComment": "2-3 meningar helhetsbedömning på svenska. Personlig och specifik.",
  "strengths": "Konkret om vad eleven gjorde bra (1-2 meningar)",
  "improvements": "Konkret om vad eleven bör arbeta på (1-2 meningar)"
}`;

// ── Misc ──────────────────────────────────────────────────────────────────────

const noCorr = { spellCheck: false, autoCorrect: "off", autoCapitalize: "off", autoComplete: "off" } as const;

// ── Main component ────────────────────────────────────────────────────────────

export function ClassBook({ onExit }: { onExit: () => void }) {
  const key = loadKey();
  const [phase, setPhase] = useState<Phase>({ name: "loading-books" });
  const [error, setError] = useState("");
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => { topRef.current?.scrollIntoView({ behavior: "smooth" }); }, [phase.name]);

  useEffect(() => {
    if (!key) { setPhase({ name: "select-book", books: [], savedProgress: loadSaved() }); return; }
    const saved = loadSaved();
    if (saved) { setPhase({ name: "select-book", books: [], savedProgress: saved }); }
    else { fetchBooks(); }
  }, []);

  async function fetchBooks() {
    setPhase({ name: "loading-books" });
    setError("");
    try {
      const raw = await gemini(key, booksPrompt(), 1500);
      const books = parseJSON<BookOption[]>(raw);
      setPhase({ name: "select-book", books, savedProgress: loadSaved() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fel");
      setPhase({ name: "select-book", books: [], savedProgress: loadSaved() });
    }
  }

  async function startBook(book: BookOption) {
    const progress: BookProgress = { book, completedChapters: [], nextChapter: 1 };
    saveProgress(progress);
    await fetchChapter(book, 1, progress);
  }

  async function fetchChapter(book: BookOption, num: number, progress: BookProgress) {
    setPhase({ name: "loading-chapter", book, chapterNum: num });
    setError("");
    const meta = book.chapters.find(c => c.number === num);
    if (!meta) return;
    try {
      const content = await gemini(key, chapterPrompt(book, num, meta.title, progress.completedChapters), 1500);
      const qRaw = await gemini(key, questionsPrompt(book.title, content), 1200);
      const questions = parseJSON<Question[]>(qRaw);
      const chapter: ChapterContent = { number: num, title: meta.title, content };
      setPhase({ name: "reading", chapter, questions, book, progress });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fel vid laddning av kapitel");
    }
  }

  async function gradeChapter(
    chapter: ChapterContent, questions: Question[], answers: Answer[],
    book: BookOption, progress: BookProgress,
  ) {
    setPhase({ name: "grading", book });
    setError("");
    const qAndA = questions.map(q => {
      const ans = answers.find(a => a.questionNumber === q.number)?.text ?? "(inget svar)";
      return `Fråga ${q.number} [${q.type}]: ${q.question}\nSvar: ${ans}`;
    }).join("\n\n");
    try {
      const raw = await gemini(key, gradingPrompt(book.title, chapter.title, chapter.content, qAndA), 2500);
      const data = parseJSON<{
        questionResults: Array<{ number: number; grade: LG; feedback: string }>;
        overallGrade: LG; teacherComment: string; strengths: string; improvements: string;
      }>(raw);
      const result: ChapterResult = {
        chapterNumber: chapter.number, chapterTitle: chapter.title,
        questionResults: data.questionResults.map(r => ({
          ...r,
          question: questions.find(q => q.number === r.number)?.question ?? "",
          answer: answers.find(a => a.questionNumber === r.number)?.text ?? "",
        })),
        overallGrade: data.overallGrade,
        teacherComment: data.teacherComment,
        strengths: data.strengths,
        improvements: data.improvements,
      };
      const newProgress: BookProgress = {
        ...progress,
        completedChapters: [...progress.completedChapters, result],
        nextChapter: chapter.number + 1,
      };
      saveProgress(newProgress);
      setPhase({ name: "chapter-result", result, progress: newProgress });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Betygsättning misslyckades");
    }
  }

  return (
    <div className="flex flex-col gap-4" ref={topRef}>
      {error && (
        <div className="rounded-sm bg-destructive/10 px-4 py-3 font-pixel text-[9px] text-destructive">
          ✗ {error} — <button className="underline" onClick={() => setError("")}>stäng</button>
        </div>
      )}

      {phase.name === "loading-books" && <LoadingPanel text="Läraren väljer böcker…" sub="Genererar bokalternativ" />}

      {phase.name === "select-book" && (
        <SelectBookScreen
          books={phase.books}
          savedProgress={phase.savedProgress}
          noKey={!key}
          onSelect={startBook}
          onContinue={p => fetchChapter(p.book, p.nextChapter, p)}
          onNewBook={() => { clearProgress(); fetchBooks(); }}
          onLoadBooks={fetchBooks}
          onExit={onExit}
        />
      )}

      {phase.name === "loading-chapter" && (
        <LoadingPanel
          text={`Läraren förbereder kapitel ${phase.chapterNum}…`}
          sub="Genererar kapiteltext och frågor — tar ~15 sekunder"
        />
      )}

      {phase.name === "reading" && (
        <ReadingScreen
          chapter={phase.chapter}
          book={phase.book}
          totalChapters={phase.book.chapters.length}
          onDone={() => setPhase({
            name: "questions",
            chapter: phase.chapter, questions: phase.questions,
            currentQ: 0, answers: [], currentText: "",
            book: phase.book, progress: phase.progress,
          })}
          onExit={onExit}
        />
      )}

      {phase.name === "questions" && (
        <QuestionsScreen
          questions={phase.questions}
          currentQ={phase.currentQ}
          currentText={phase.currentText}
          chapterTitle={phase.chapter.title}
          chapterNum={phase.chapter.number}
          onAnswer={text => setPhase(p => p.name === "questions" ? { ...p, currentText: text } : p)}
          onNext={() => {
            if (phase.name !== "questions") return;
            const { questions, currentQ, answers, currentText, chapter, book, progress } = phase;
            const newAnswers = [...answers, { questionNumber: questions[currentQ].number, text: currentText }];
            if (currentQ < questions.length - 1) {
              setPhase({ ...phase, currentQ: currentQ + 1, answers: newAnswers, currentText: "" });
            } else {
              gradeChapter(chapter, questions, newAnswers, book, progress);
            }
          }}
        />
      )}

      {phase.name === "grading" && (
        <LoadingPanel
          text="Läraren rättar dina svar…"
          sub="Varje svar bedöms noggrant på tankekvalitet och argumentation"
        />
      )}

      {phase.name === "chapter-result" && (
        <ChapterResultScreen
          result={phase.result}
          progress={phase.progress}
          isBookDone={phase.progress.nextChapter > phase.progress.book.chapters.length}
          onNext={() => {
            const { progress } = phase;
            if (progress.nextChapter > progress.book.chapters.length) {
              setPhase({ name: "book-complete", progress });
            } else {
              fetchChapter(progress.book, progress.nextChapter, progress);
            }
          }}
          onNewBook={() => { clearProgress(); fetchBooks(); }}
          onExit={onExit}
        />
      )}

      {phase.name === "book-complete" && (
        <BookCompleteScreen
          progress={phase.progress}
          onNewBook={() => { clearProgress(); fetchBooks(); }}
          onExit={onExit}
        />
      )}
    </div>
  );
}

// ── Sub-screens ───────────────────────────────────────────────────────────────

function LoadingPanel({ text, sub }: { text: string; sub?: string }) {
  return (
    <div className="pixel-panel flex flex-col items-center gap-3 rounded-sm bg-card p-16 text-center">
      <div className="animate-pulse font-pixel text-[9px] text-muted-foreground">{text}</div>
      {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

function SelectBookScreen({
  books, savedProgress, noKey,
  onSelect, onContinue, onNewBook, onLoadBooks, onExit,
}: {
  books: BookOption[]; savedProgress: BookProgress | null; noKey: boolean;
  onSelect: (b: BookOption) => void; onContinue: (p: BookProgress) => void;
  onNewBook: () => void; onLoadBooks: () => void; onExit: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="pixel-panel flex items-center justify-between rounded-sm bg-card p-4">
        <div>
          <p className="font-pixel text-[11px] text-primary">KLASSBOK</p>
          <p className="text-muted-foreground text-sm mt-0.5">Läs ett kapitel, svara på 10 frågor, få betyg.</p>
        </div>
        <button onClick={onExit} className="rounded-sm border-2 border-border bg-card px-3 py-1.5 font-pixel text-[9px] shadow-pixel-sm">
          KARTAN
        </button>
      </div>

      {noKey && (
        <div className="pixel-panel rounded-sm bg-card p-6">
          <p className="font-pixel text-[9px] text-destructive mb-2">INGEN API-NYCKEL</p>
          <p className="text-muted-foreground">Ange din Gemini API-nyckel i Klassrumsläget först.</p>
        </div>
      )}

      {/* Continue existing book */}
      {savedProgress && (
        <div className="pixel-panel rounded-sm bg-card p-5 flex flex-col gap-3">
          <p className="font-pixel text-[9px] text-muted-foreground">PÅGÅENDE BOK</p>
          <div>
            <p className="text-xl font-semibold">{savedProgress.book.title}</p>
            <p className="text-muted-foreground text-sm">{savedProgress.book.author} · {savedProgress.book.genre}</p>
            <div className="flex gap-1 mt-2">
              {savedProgress.book.chapters.map(c => (
                <div key={c.number} className={`h-1.5 flex-1 rounded-full ${c.number < savedProgress.nextChapter ? "bg-primary" : "bg-secondary"}`} />
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {savedProgress.completedChapters.length} av {savedProgress.book.chapters.length} kapitel klara
              {savedProgress.completedChapters.length > 0 && (
                <span className={`ml-2 font-semibold ${GC[avgGrade(savedProgress.completedChapters)]}`}>
                  Snitt: {avgGrade(savedProgress.completedChapters)}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => onContinue(savedProgress)}
              className="flex-1 rounded-sm border-2 border-border bg-accent px-3 py-2.5 font-pixel text-[9px] text-accent-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none">
              FORTSÄTT — KAPITEL {savedProgress.nextChapter}
            </button>
            <button onClick={onNewBook}
              className="rounded-sm border-2 border-border bg-card px-3 py-2.5 font-pixel text-[9px] shadow-pixel-sm active:translate-y-0.5 active:shadow-none">
              NY BOK
            </button>
          </div>
        </div>
      )}

      {/* Book selection */}
      {!savedProgress && books.length === 0 && !noKey && (
        <div className="pixel-panel rounded-sm bg-card p-6 flex flex-col items-center gap-3">
          <button onClick={onLoadBooks}
            className="rounded-sm border-2 border-border bg-accent px-6 py-3 font-pixel text-[9px] text-accent-foreground shadow-pixel-sm">
            VÄLJ EN BOK
          </button>
        </div>
      )}

      {!savedProgress && books.length > 0 && (
        <>
          <p className="font-pixel text-[9px] text-muted-foreground px-1">VÄLJ EN BOK ATT LÄSA</p>
          {books.map(book => (
            <div key={book.id} className="pixel-panel rounded-sm bg-card p-5 flex flex-col gap-3">
              <div>
                <p className="text-xl font-semibold">{book.title}</p>
                <p className="text-muted-foreground text-sm">{book.author} · {book.genre}</p>
              </div>
              <p className="text-base leading-relaxed">{book.synopsis}</p>
              <div className="flex flex-wrap gap-1">
                {book.chapters.map(c => (
                  <span key={c.number} className="rounded-sm bg-secondary/60 px-2 py-0.5 font-pixel text-[7px] text-muted-foreground">
                    {c.number}. {c.title}
                  </span>
                ))}
              </div>
              <button onClick={() => onSelect(book)}
                className="rounded-sm border-2 border-border bg-accent px-4 py-2.5 font-pixel text-[9px] text-accent-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none">
                LÄS DEN HÄR BOKEN →
              </button>
            </div>
          ))}
          <button onClick={onLoadBooks}
            className="rounded-sm border-2 border-border bg-card px-3 py-2 font-pixel text-[9px] shadow-pixel-sm active:translate-y-0.5 active:shadow-none">
            GENERERA NYA BÖCKER
          </button>
        </>
      )}
    </div>
  );
}

function ReadingScreen({
  chapter, book, totalChapters, onDone, onExit,
}: {
  chapter: ChapterContent; book: BookOption; totalChapters: number;
  onDone: () => void; onExit: () => void;
}) {
  const [canFinish, setCanFinish] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Unlock button when user scrolls to end of chapter
  useEffect(() => {
    const el = endRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setCanFinish(true); }, { threshold: 0.5 });
    obs.observe(el);
    // Fallback: unlock after 60s anyway
    const t = setTimeout(() => setCanFinish(true), 60000);
    return () => { obs.disconnect(); clearTimeout(t); };
  }, []);

  const paragraphs = chapter.content.split("\n").filter(p => p.trim());

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="pixel-panel flex items-center justify-between rounded-sm bg-card p-4">
        <div className="flex-1 min-w-0">
          <p className="font-pixel text-[9px] text-muted-foreground truncate">{book.title} · {book.author}</p>
          <p className="font-semibold text-lg mt-0.5 truncate">Kapitel {chapter.number}: {chapter.title}</p>
          {/* progress bar */}
          <div className="flex gap-0.5 mt-2">
            {Array.from({ length: totalChapters }).map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full ${i < chapter.number ? "bg-primary" : "bg-secondary"}`} />
            ))}
          </div>
        </div>
        <button onClick={onExit} className="ml-4 rounded-sm border-2 border-border bg-card px-3 py-1.5 font-pixel text-[9px] shadow-pixel-sm shrink-0">
          KARTAN
        </button>
      </div>

      {/* Chapter text — book-like reading */}
      <div className="pixel-panel rounded-sm bg-[#fdf6e3] p-6 sm:p-8 border-2 border-border shadow-pixel">
        <div className="mx-auto max-w-prose">
          <h2 className="text-center font-serif text-muted-foreground text-sm mb-8 tracking-widest uppercase">
            — {chapter.number} —
          </h2>
          {paragraphs.map((para, i) => (
            <p key={i} className="mb-5 text-[17px] leading-8 text-gray-800 font-serif">{para}</p>
          ))}
          <div ref={endRef} className="h-1" />
        </div>
      </div>

      {/* Done reading */}
      <div className="flex flex-col items-center gap-2 pb-2">
        {!canFinish && (
          <p className="font-pixel text-[8px] text-muted-foreground">Läs till slutet för att låsa upp frågorna</p>
        )}
        <button
          onClick={onDone}
          disabled={!canFinish}
          className="w-full rounded-sm border-2 border-border bg-accent px-4 py-3 font-pixel text-[10px] text-accent-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed"
        >
          JAG HAR LÄST KLART — BÖRJA FRÅGORNA →
        </button>
      </div>
    </div>
  );
}

function QuestionsScreen({
  questions, currentQ, currentText, chapterTitle, chapterNum,
  onAnswer, onNext,
}: {
  questions: Question[]; currentQ: number; currentText: string;
  chapterTitle: string; chapterNum: number;
  onAnswer: (t: string) => void; onNext: () => void;
}) {
  const q = questions[currentQ];
  const isLast = currentQ === questions.length - 1;
  const charLen = currentText.trim().length;

  const charColor = charLen < 60 ? "text-red-500" : charLen < 150 ? "text-yellow-600" : "text-emerald-600";
  const charMsg = charLen < 60 ? "Skriv mer — för kort svar ger lågt betyg" : charLen < 150 ? "Bra, fortsätt utveckla ditt svar" : "Utmärkt längd!";

  return (
    <div className="flex flex-col gap-4">
      {/* Progress */}
      <div className="pixel-panel rounded-sm bg-card p-3">
        <div className="flex justify-between items-center mb-2">
          <span className="font-pixel text-[9px] text-muted-foreground">
            Kap. {chapterNum}: {chapterTitle}
          </span>
          <span className="font-pixel text-[9px] text-muted-foreground">
            FRÅGA {currentQ + 1} / {questions.length}
          </span>
        </div>
        <div className="flex gap-0.5">
          {questions.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < currentQ ? "bg-primary" : i === currentQ ? "bg-accent" : "bg-secondary"
            }`} />
          ))}
        </div>
        <p className="mt-1.5 font-pixel text-[7px] text-muted-foreground uppercase tracking-wider">{q.type}</p>
      </div>

      {/* Question */}
      <div className="pixel-panel rounded-sm bg-card p-6">
        <p className="text-xl leading-relaxed">{q.question}</p>
      </div>

      {/* Answer */}
      <div className="flex flex-col gap-2">
        <textarea
          value={currentText}
          onChange={e => onAnswer(e.target.value)}
          placeholder="Skriv ditt svar här. Utveckla och motivera — betyget baseras på hur du resonerar, inte om du har 'rätt'."
          rows={7}
          {...noCorr}
          className="w-full rounded-sm border-2 border-border bg-card px-4 py-3 text-base leading-relaxed outline-none focus:border-ring resize-none"
        />
        <div className="flex items-center justify-between gap-3">
          <span className={`font-pixel text-[8px] ${charColor}`}>
            {currentText.length} tecken — {charMsg}
          </span>
          <button
            onClick={onNext}
            disabled={charLen < 5}
            className="rounded-sm border-2 border-border bg-accent px-5 py-2 font-pixel text-[9px] text-accent-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none disabled:opacity-40"
          >
            {isLast ? "SKICKA IN ALLA SVAR" : "NÄSTA FRÅGA →"}
          </button>
        </div>
      </div>

      <div className="rounded-sm bg-secondary/40 px-4 py-3 font-pixel text-[8px] text-muted-foreground leading-relaxed">
        💡 Använd textbelägg, motivera åsikter, koppla till egna erfarenheter. Du kan ha ett "fel" svar och ändå få A — det handlar om hur du tänker.
      </div>
    </div>
  );
}

function ChapterResultScreen({
  result, progress, isBookDone, onNext, onNewBook, onExit,
}: {
  result: ChapterResult; progress: BookProgress; isBookDone: boolean;
  onNext: () => void; onNewBook: () => void; onExit: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="pixel-panel flex items-center justify-between rounded-sm bg-card p-4">
        <span className="font-pixel text-[11px] text-primary">KLASSBOK</span>
        <button onClick={onExit} className="rounded-sm border-2 border-border bg-card px-3 py-1.5 font-pixel text-[9px] shadow-pixel-sm">KARTAN</button>
      </div>

      {/* Overall grade */}
      <div className="pixel-panel rounded-sm bg-card p-8 flex flex-col items-center gap-3 text-center">
        <p className="font-pixel text-[9px] text-muted-foreground">KAPITEL {result.chapterNumber}: {result.chapterTitle}</p>
        <div className={`text-[88px] font-bold leading-none ${GC[result.overallGrade]}`}>{result.overallGrade}</div>
        <p className="text-base leading-relaxed text-muted-foreground max-w-sm mt-2">{result.teacherComment}</p>
        <div className="grid grid-cols-2 gap-4 mt-3 w-full max-w-sm">
          <div className="rounded-sm bg-secondary/40 p-3 text-left">
            <p className="font-pixel text-[8px] text-muted-foreground mb-1">STYRKOR</p>
            <p className="text-sm leading-relaxed">{result.strengths}</p>
          </div>
          <div className="rounded-sm bg-secondary/40 p-3 text-left">
            <p className="font-pixel text-[8px] text-muted-foreground mb-1">ATT ARBETA PÅ</p>
            <p className="text-sm leading-relaxed">{result.improvements}</p>
          </div>
        </div>
      </div>

      {/* Question-by-question breakdown */}
      <div className="pixel-panel rounded-sm bg-card p-4 flex flex-col gap-3">
        <p className="font-pixel text-[9px] text-muted-foreground">DETALJERADE SVAR</p>
        {result.questionResults.map(qr => (
          <div key={qr.number} className={`rounded-sm border-2 p-4 ${GB[qr.grade]}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm leading-snug">{qr.number}. {qr.question}</p>
                <p className="text-sm text-gray-500 mt-2 italic leading-relaxed">"{qr.answer}"</p>
                <div className="mt-2 text-sm leading-relaxed prose prose-sm max-w-none">
                  <ReactMarkdown>{qr.feedback}</ReactMarkdown>
                </div>
              </div>
              <div className={`text-4xl font-bold shrink-0 ${GC[qr.grade]}`}>{qr.grade}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex gap-2">
        {!isBookDone ? (
          <button onClick={onNext}
            className="flex-1 rounded-sm border-2 border-border bg-accent px-4 py-3 font-pixel text-[10px] text-accent-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none">
            NÄSTA KAPITEL →
          </button>
        ) : (
          <button onClick={onNext}
            className="flex-1 rounded-sm border-2 border-border bg-accent px-4 py-3 font-pixel text-[10px] text-accent-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none">
            SE BOKRESULTAT →
          </button>
        )}
        <button onClick={onNewBook}
          className="rounded-sm border-2 border-border bg-card px-4 py-3 font-pixel text-[9px] shadow-pixel-sm active:translate-y-0.5 active:shadow-none">
          NY BOK
        </button>
      </div>
    </div>
  );
}

function BookCompleteScreen({
  progress, onNewBook, onExit,
}: {
  progress: BookProgress; onNewBook: () => void; onExit: () => void;
}) {
  const overall = avgGrade(progress.completedChapters);
  return (
    <div className="flex flex-col gap-4">
      <div className="pixel-panel flex items-center justify-between rounded-sm bg-card p-4">
        <span className="font-pixel text-[11px] text-primary">KLASSBOK</span>
        <button onClick={onExit} className="rounded-sm border-2 border-border bg-card px-3 py-1.5 font-pixel text-[9px] shadow-pixel-sm">KARTAN</button>
      </div>

      <div className="pixel-panel rounded-sm bg-card p-8 flex flex-col items-center gap-2 text-center">
        <p className="font-pixel text-[9px] text-muted-foreground">BOK AVKLARAD</p>
        <p className="text-2xl font-semibold mt-1">{progress.book.title}</p>
        <p className="text-muted-foreground">{progress.book.author}</p>
        <div className={`text-[88px] font-bold leading-none mt-4 ${GC[overall]}`}>{overall}</div>
        <p className="font-pixel text-[9px] text-muted-foreground">SLUTBETYG</p>
      </div>

      <div className="pixel-panel rounded-sm bg-card p-4 flex flex-col gap-1">
        <p className="font-pixel text-[9px] text-muted-foreground mb-2">KAPITEL FÖR KAPITEL</p>
        {progress.completedChapters.map(c => (
          <div key={c.chapterNumber} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
            <div>
              <p className="font-semibold">Kapitel {c.chapterNumber}</p>
              <p className="text-sm text-muted-foreground">{c.chapterTitle}</p>
            </div>
            <span className={`text-3xl font-bold ${GC[c.overallGrade]}`}>{c.overallGrade}</span>
          </div>
        ))}
      </div>

      <button onClick={onNewBook}
        className="rounded-sm border-2 border-border bg-accent px-4 py-3 font-pixel text-[10px] text-accent-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none">
        LÄS EN NY BOK →
      </button>
    </div>
  );
}
