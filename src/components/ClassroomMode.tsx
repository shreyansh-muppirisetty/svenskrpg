import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "svenska-quest-classroom-gemini-key";
const MODEL = "gemini-3.1-flash-lite";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// ── Types ─────────────────────────────────────────────────────────────────────

const ALL_TYPES = [
  "circle_verb", "correct_mistakes", "reading_comprehension",
  "write_story", "kallkritik", "fill_blank", "translate_sentences",
  "word_class", "reorder_sentences", "conjugate_verbs", "en_ett",
  "write_letter", "argumentative_text", "find_synonyms",
  "correct_punctuation", "summarize", "write_dialogue",
  "plural_forms", "past_tense", "write_poem",
] as const;
type AssignmentType = (typeof ALL_TYPES)[number];

type Assignment = {
  type: AssignmentType;
  title: string;
  instructions: string;
  answer_key: string;
  text?: string;
  text_with_blanks?: string;
  words?: string[];
  word_bank?: string[];
  sentences?: string[];
  questions?: string[];
  verbs?: string[];
  prompt?: string;
};

type Message = { role: "user" | "model"; text: string };

// ── Assignment type metadata ──────────────────────────────────────────────────

const TYPE_META: Record<AssignmentType, { label: string; genPrompt: string }> = {
  circle_verb: {
    label: "Hitta verben",
    genPrompt: `Year 7 Swedish exercise: write a paragraph (5–7 sentences, school/everyday life, A2/B1). Student identifies all verbs. Return ONLY valid JSON, no markdown:
{"type":"circle_verb","title":"Hitta verben","instructions":"Klicka på alla verb i texten. Det finns [N] verb totalt.","text":"PARAGRAPH","answer_key":"verb1, verb2, ..."}`,
  },
  correct_mistakes: {
    label: "Rätta felen",
    genPrompt: `Year 7 Swedish exercise: paragraph (5–7 sentences) with exactly 7 grammar/spelling mistakes (wrong verb forms, wrong gender, V2 errors, misspellings). Return ONLY valid JSON:
{"type":"correct_mistakes","title":"Rätta felen","instructions":"Texten innehåller 7 fel. Skriv den korrekta versionen nedan.","text":"PARAGRAPH WITH ERRORS","answer_key":"CORRECTED VERSION"}`,
  },
  reading_comprehension: {
    label: "Läsförståelse",
    genPrompt: `Year 7 Swedish exercise: interesting text (150–200 words, real-world topic) + 5 comprehension questions. Return ONLY valid JSON:
{"type":"reading_comprehension","title":"Läsförståelse","instructions":"Läs texten och svara på frågorna i fullständiga meningar.","text":"TEXT","questions":["Q1","Q2","Q3","Q4","Q5"],"answer_key":"Q1: ...\nQ2: ..."}`,
  },
  write_story: {
    label: "Skriv en berättelse",
    genPrompt: `Year 7 Swedish creative writing task. Varied topic (adventure, mystery, everyday, fantasy). Include starting sentence + requirements (min 150 words, setting, characters, problem, solution). Return ONLY valid JSON:
{"type":"write_story","title":"Skriv en berättelse","instructions":"DETAILED REQUIREMENTS","prompt":"Opening sentence to continue from","answer_key":"Rubric: struktur, ordförråd, grammatik, kreativitet"}`,
  },
  kallkritik: {
    label: "Källkritik",
    genPrompt: `Year 7 Swedish källkritik exercise. Write a fake article/post with credibility problems (no author, exaggerated claims, emotional language, unclear source). Then 4 critical questions. Return ONLY valid JSON:
{"type":"kallkritik","title":"Källkritik","instructions":"Läs källan nedan och svara på frågorna.","text":"FAKE ARTICLE OR SOCIAL MEDIA POST","questions":["Vem har skrivit detta och varför är det viktigt?","Vilka påståenden är svåra att kontrollera?","Vilka ord eller fraser är känslomässiga eller överdrivna?","Hur skulle du kontrollera om informationen stämmer?"],"answer_key":"Expected observations and reasoning"}`,
  },
  fill_blank: {
    label: "Fyll i luckorna",
    genPrompt: `Year 7 Swedish fill-in-the-blank: 7 sentences with ___ for missing words (grammar focus: verb forms, prepositions, articles). Word bank with correct words + 3 distractors. Return ONLY valid JSON:
{"type":"fill_blank","title":"Fyll i luckorna","instructions":"Välj rätt ord från ordbanken och fyll i luckorna.","text_with_blanks":"Sentence with ___ here.\nAnother sentence with ___ here.","word_bank":["word1","word2","word3","word4","word5","word6","word7","distractor1","distractor2","distractor3"],"answer_key":"1. word, 2. word, ..."}`,
  },
  translate_sentences: {
    label: "Översätt meningarna",
    genPrompt: `Year 7 Swedish translation: 7 English sentences → Swedish (A2/B1, varied topics, interesting content). Return ONLY valid JSON:
{"type":"translate_sentences","title":"Översätt till svenska","instructions":"Översätt meningarna till svenska.","sentences":["Eng1","Eng2","Eng3","Eng4","Eng5","Eng6","Eng7"],"answer_key":"1. Swe\n2. Swe..."}`,
  },
  word_class: {
    label: "Ordklasser",
    genPrompt: `Year 7 Swedish word class exercise: 12 Swedish words (mix of substantiv, verb, adjektiv, adverb, preposition — at least 2 of each). Return ONLY valid JSON:
{"type":"word_class","title":"Ordklasser","instructions":"Ange ordklass för varje ord: substantiv, verb, adjektiv, adverb eller preposition.","words":["word1","word2","word3","word4","word5","word6","word7","word8","word9","word10","word11","word12"],"answer_key":"1. word1 = ordklass\n..."}`,
  },
  reorder_sentences: {
    label: "Ordna meningarna",
    genPrompt: `Year 7 Swedish reorder exercise: write a mini-story as 6 logical sentences, then scramble them. Student writes the correct order. Return ONLY valid JSON:
{"type":"reorder_sentences","title":"Ordna meningarna","instructions":"Meningarna är i fel ordning. Skriv rätt ordning som siffror, t.ex. 3,1,5,2,6,4.","sentences":["Scrambled S1","Scrambled S2","Scrambled S3","Scrambled S4","Scrambled S5","Scrambled S6"],"answer_key":"Correct order e.g. 2,5,1,4,6,3 and the story in order"}`,
  },
  conjugate_verbs: {
    label: "Böj verben",
    genPrompt: `Year 7 Swedish verb conjugation: 6 infinitive verbs (mix of conjugation groups 1-4, include some irregular). Return ONLY valid JSON:
{"type":"conjugate_verbs","title":"Böj verben","instructions":"Fyll i verbens former i tabellen.","verbs":["att skriva","att springa","att köpa","att läsa","att äta","att vara"],"answer_key":"att skriva: skriver, skrev, har skrivit\n..."}`,
  },
  en_ett: {
    label: "En eller ett?",
    genPrompt: `Year 7 Swedish en/ett exercise: 14 nouns (good mix of en and ett words, include some tricky ones). Return ONLY valid JSON:
{"type":"en_ett","title":"En eller ett?","instructions":"Välj rätt artikel (en eller ett) för varje substantiv.","words":["hus","bil","barn","skola","bord","lampa","träd","dator","klass","lärare","fönster","bok","hjärta","tid"],"answer_key":"ett hus, en bil, ett barn, en skola, ett bord, en lampa, ett träd, en dator, en klass, en lärare, ett fönster, en bok, ett hjärta, en tid"}`,
  },
  write_letter: {
    label: "Skriv ett brev",
    genPrompt: `Year 7 Swedish letter-writing task (alternate between formal/informal). Clear scenario, who to write to, purpose. Return ONLY valid JSON:
{"type":"write_letter","title":"Skriv ett brev","instructions":"DETAILED: who, why, what to include (hälsningsfras, 3+ stycken, avslutningsfras), min 120 ord","prompt":"Scenario description","answer_key":"Rubric: format, innehåll, språk, längd"}`,
  },
  argumentative_text: {
    label: "Argumenterande text",
    genPrompt: `Year 7 Swedish argumentative writing task. Current/relevant topic, take a side. Include structure guide (inledning, argument x3, avslutning). Return ONLY valid JSON:
{"type":"argumentative_text","title":"Argumenterande text","instructions":"FULL: topic, which side to argue, structure requirements, min 150 ord","prompt":"The debate question","answer_key":"Rubric: struktur, argumentkvalitet, språk, avslutning"}`,
  },
  find_synonyms: {
    label: "Synonymer & antonymer",
    genPrompt: `Year 7 Swedish synonym/antonym exercise: 8 Swedish adjectives or adverbs. Student writes one synonym AND one antonym for each. Return ONLY valid JSON:
{"type":"find_synonyms","title":"Synonymer och antonymer","instructions":"Skriv ett synonym och ett antonym till varje ord.","words":["glad","snabb","stor","gammal","varm","lång","tyst","lätt"],"answer_key":"glad: synonym=lycklig, antonym=ledsen\n..."}`,
  },
  correct_punctuation: {
    label: "Rätta skiljetecknen",
    genPrompt: `Year 7 Swedish punctuation exercise: paragraph (6–8 sentences) with 8 punctuation errors (missing periods, wrong commas, missing capitals after periods, missing question/exclamation marks). Return ONLY valid JSON:
{"type":"correct_punctuation","title":"Rätta skiljetecknen","instructions":"Texten har 8 skiljeteckenfel. Skriv den korrekta versionen.","text":"paragraph without proper punctuation","answer_key":"CORRECT VERSION"}`,
  },
  summarize: {
    label: "Sammanfatta texten",
    genPrompt: `Year 7 Swedish summarize task: interesting text (180–220 words, nature/tech/society/culture). Student summarizes in 50–70 words. Return ONLY valid JSON:
{"type":"summarize","title":"Sammanfatta texten","instructions":"Läs texten och skriv en sammanfattning på 50–70 ord med egna ord.","text":"TEXT","answer_key":"Model summary + criteria: main points, own words, correct length"}`,
  },
  write_dialogue: {
    label: "Skriv en dialog",
    genPrompt: `Year 7 Swedish dialogue-writing task. Vivid scenario between 2 people. Requirements: min 10 repliker, use Swedish dialogue punctuation, natural language. Return ONLY valid JSON:
{"type":"write_dialogue","title":"Skriv en dialog","instructions":"FULL: scenario, min 10 repliker, correct Swedish dialogue punctuation (tankstreck)","prompt":"The scenario","answer_key":"Rubric: antal repliker, naturligt språk, skiljetecken, scenariot"}`,
  },
  plural_forms: {
    label: "Pluralformer",
    genPrompt: `Year 7 Swedish noun plural exercise: 10 nouns covering all 5 declension groups. Student writes obestämd and bestämd plural. Return ONLY valid JSON:
{"type":"plural_forms","title":"Substantivens pluralformer","instructions":"Skriv obestämd pluralform och bestämd pluralform av varje substantiv.","sentences":["en bil","ett hus","en flicka","ett barn","en man","en fågel","ett äpple","en stad","en hand","ett öga"],"answer_key":"en bil → bilar / bilarna\n..."}`,
  },
  past_tense: {
    label: "Skriv om i dåtid",
    genPrompt: `Year 7 Swedish past tense exercise: 7 sentences in present tense, student rewrites in preteritum. Include some irregular verbs. Return ONLY valid JSON:
{"type":"past_tense","title":"Skriv om i dåtid (preteritum)","instructions":"Skriv om meningarna i preteritum.","sentences":["Present S1","Present S2","Present S3","Present S4","Present S5","Present S6","Present S7"],"answer_key":"1. Preteritum\n..."}`,
  },
  write_poem: {
    label: "Skriv en dikt",
    genPrompt: `Year 7 Swedish poetry task. Pick one form: haiku (5-7-5 syllables), akrostikon, rimmat poem, or fri vers. Include form requirements and an evocative theme. Return ONLY valid JSON:
{"type":"write_poem","title":"Skriv en dikt","instructions":"FULL: poem form, theme, structural requirements, examples if needed","prompt":"Theme or starting word","answer_key":"Rubric: följer formen, kreativa bilder, känsla, ansträngning"}`,
  },
};

// ── API helpers ───────────────────────────────────────────────────────────────

function loadKey(): string { try { return localStorage.getItem(STORAGE_KEY) ?? ""; } catch { return ""; } }
function saveKey(k: string) { try { localStorage.setItem(STORAGE_KEY, k); } catch { /* ignore */ } }

function extractJson(raw: string): string {
  const match = raw.match(/\{[\s\S]*\}/);
  return match ? match[0] : raw;
}

async function geminiRaw(key: string, prompt: string, maxTokens = 1500): Promise<string> {
  const res = await fetch(`${API_BASE}/${MODEL}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.9, maxOutputTokens: maxTokens },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function geminiChat(key: string, system: string, history: Message[], userText: string): Promise<string> {
  const contents = [
    ...history.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
    { role: "user", parts: [{ text: userText }] },
  ];
  const res = await fetch(`${API_BASE}/${MODEL}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "(inget svar)";
}

async function generateAssignment(key: string, forceType?: AssignmentType): Promise<Assignment> {
  const type = forceType ?? ALL_TYPES[Math.floor(Math.random() * ALL_TYPES.length)];
  const raw = await geminiRaw(key, TYPE_META[type].genPrompt, 1500);
  const json = JSON.parse(extractJson(raw));
  return { ...json, type } as Assignment;
}

// ── Interactive sub-views ─────────────────────────────────────────────────────

function CircleVerbView({ text, onChange }: { text: string; onChange: (s: string) => void }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const tokens = text.split(/\s+/).filter(Boolean);

  function toggle(i: number) {
    const next = new Set(selected);
    if (next.has(i)) next.delete(i); else next.add(i);
    setSelected(next);
    onChange([...next].sort((a, b) => a - b).map((idx) => tokens[idx].replace(/[.,!?;:]+$/, "")).join(", "));
  }

  return (
    <div className="flex flex-wrap gap-1 leading-loose">
      {tokens.map((token, i) => {
        const word = token.replace(/[.,!?;:]+$/, "");
        const punct = token.slice(word.length);
        return (
          <span key={i}>
            <button
              onClick={() => toggle(i)}
              className={`rounded px-1 py-0.5 text-xl transition-colors ${
                selected.has(i)
                  ? "bg-accent text-accent-foreground font-bold ring-2 ring-accent"
                  : "hover:bg-secondary/60"
              }`}
            >
              {word}
            </button>
            {punct && <span className="text-xl">{punct}</span>}
          </span>
        );
      })}
    </div>
  );
}

function EnEttView({ words, onChange }: { words: string[]; onChange: (s: string) => void }) {
  const [answers, setAnswers] = useState<Record<number, "en" | "ett">>({});

  function pick(i: number, val: "en" | "ett") {
    const next = { ...answers, [i]: val };
    setAnswers(next);
    onChange(words.map((w, idx) => `${next[idx] ?? "?"} ${w}`).join(", "));
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {words.map((w, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-28 text-lg">{w}</span>
          {(["en", "ett"] as const).map((v) => (
            <button
              key={v}
              onClick={() => pick(i, v)}
              className={`rounded-sm border-2 border-border px-3 py-1 font-pixel text-[9px] transition-colors ${
                answers[i] === v ? "bg-primary text-primary-foreground" : "bg-card hover:bg-secondary/60"
              }`}
            >
              {v.toUpperCase()}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function FillBlankView({ textWithBlanks, wordBank, onChange }: { textWithBlanks: string; wordBank: string[]; onChange: (s: string) => void }) {
  const lines = textWithBlanks.split("\n").filter(Boolean);
  const totalBlanks = (textWithBlanks.match(/___/g) ?? []).length;
  const [fills, setFills] = useState<string[]>(Array(totalBlanks).fill(""));
  let blankCounter = 0;

  function update(i: number, val: string) {
    const next = [...fills];
    next[i] = val;
    setFills(next);
    onChange(next.map((v, idx) => `${idx + 1}. ${v || "?"}`).join(", "));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {lines.map((line, li) => {
          const parts = line.split("___");
          return (
            <p key={li} className="text-xl leading-relaxed">
              {parts.map((part, pi) => {
                const idx = blankCounter;
                if (pi < parts.length - 1) blankCounter++;
                return (
                  <span key={pi}>
                    {part}
                    {pi < parts.length - 1 && (
                      <select
                        value={fills[idx]}
                        onChange={(e) => update(idx, e.target.value)}
                        className="mx-1 rounded-sm border-2 border-border bg-secondary/50 px-1 py-0.5 font-pixel text-[9px] outline-none focus:border-ring"
                      >
                        <option value="">___</option>
                        {wordBank.map((w) => <option key={w} value={w}>{w}</option>)}
                      </select>
                    )}
                  </span>
                );
              })}
            </p>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-1 rounded-sm bg-secondary/30 p-2">
        <span className="font-pixel text-[8px] text-muted-foreground mr-1">ORDBANK:</span>
        {wordBank.map((w) => (
          <span key={w} className="rounded-sm bg-secondary px-2 py-0.5 font-pixel text-[8px]">{w}</span>
        ))}
      </div>
    </div>
  );
}

function QuestionsView({ text, questions, onChange }: { text?: string; questions: string[]; onChange: (s: string) => void }) {
  const [answers, setAnswers] = useState<string[]>(Array(questions.length).fill(""));

  function update(i: number, val: string) {
    const next = [...answers];
    next[i] = val;
    setAnswers(next);
    onChange(next.map((a, idx) => `${idx + 1}. ${a}`).join("\n"));
  }

  return (
    <div className="flex flex-col gap-4">
      {text && <div className="rounded-sm bg-secondary/40 p-4 text-lg leading-relaxed whitespace-pre-wrap">{text}</div>}
      <div className="flex flex-col gap-3">
        {questions.map((q, i) => (
          <div key={i} className="flex flex-col gap-1">
            <span className="font-pixel text-[9px] text-muted-foreground">{i + 1}. {q}</span>
            <input
              value={answers[i]}
              onChange={(e) => update(i, e.target.value)}
              placeholder="Ditt svar…"
              className="rounded-sm border-2 border-border bg-secondary/50 px-3 py-2 text-base outline-none focus:border-ring"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ConjugateView({ verbs, onChange }: { verbs: string[]; onChange: (s: string) => void }) {
  const forms = ["Presens", "Preteritum", "Perfekt (har ...)"];
  const [cells, setCells] = useState<string[][]>(verbs.map(() => ["", "", ""]));

  function update(vi: number, fi: number, val: string) {
    const next = cells.map((r) => [...r]);
    next[vi][fi] = val;
    setCells(next);
    onChange(next.map((r, i) => `${verbs[i]}: ${r.join(", ")}`).join("\n"));
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-border">
            <th className="py-2 pr-3 text-left font-pixel text-[8px] text-muted-foreground">INFINITIV</th>
            {forms.map((f) => (
              <th key={f} className="py-2 px-2 text-left font-pixel text-[8px] text-muted-foreground">{f.toUpperCase()}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {verbs.map((v, vi) => (
            <tr key={vi} className="border-b border-border/50">
              <td className="py-2 pr-3 text-lg font-bold">{v}</td>
              {forms.map((_, fi) => (
                <td key={fi} className="py-1 px-1">
                  <input
                    value={cells[vi][fi]}
                    onChange={(e) => update(vi, fi, e.target.value)}
                    placeholder="…"
                    className="w-full rounded-sm border border-border bg-secondary/50 px-2 py-1 text-base outline-none focus:border-ring"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Assignment renderer ───────────────────────────────────────────────────────

function AssignmentView({ assignment, onAnswerChange }: { assignment: Assignment; onAnswerChange: (s: string) => void }) {
  const needsTextarea = !["circle_verb", "en_ett", "fill_blank", "reading_comprehension",
    "kallkritik", "conjugate_verbs"].includes(assignment.type);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="rounded-sm bg-primary px-2 py-0.5 font-pixel text-[8px] text-primary-foreground">
          {TYPE_META[assignment.type].label.toUpperCase()}
        </span>
      </div>

      <h2 className="font-pixel text-[12px] leading-relaxed text-foreground">{assignment.title}</h2>
      <p className="text-lg text-muted-foreground">{assignment.instructions}</p>

      {/* Body text for read-then-do tasks */}
      {["correct_mistakes", "correct_punctuation", "summarize", "word_class"].includes(assignment.type) && assignment.text && (
        <div className="rounded-sm bg-chalk p-4 text-chalk-foreground text-lg leading-relaxed whitespace-pre-wrap">
          {assignment.text}
        </div>
      )}

      {/* Sentence lists */}
      {["translate_sentences", "reorder_sentences", "plural_forms", "past_tense"].includes(assignment.type) && assignment.sentences && (
        <ol className="flex flex-col gap-1.5 pl-4">
          {assignment.sentences.map((s, i) => (
            <li key={i} className="text-lg list-decimal">{s}</li>
          ))}
        </ol>
      )}

      {/* Writing prompt box */}
      {assignment.prompt && (
        <div className="rounded-sm border-l-4 border-accent bg-secondary/40 px-4 py-3 text-lg italic">
          {assignment.prompt}
        </div>
      )}

      {/* Interactive views */}
      {assignment.type === "circle_verb" && assignment.text && (
        <CircleVerbView text={assignment.text} onChange={onAnswerChange} />
      )}
      {assignment.type === "en_ett" && assignment.words && (
        <EnEttView words={assignment.words} onChange={onAnswerChange} />
      )}
      {assignment.type === "fill_blank" && assignment.text_with_blanks && assignment.word_bank && (
        <FillBlankView textWithBlanks={assignment.text_with_blanks} wordBank={assignment.word_bank} onChange={onAnswerChange} />
      )}
      {(assignment.type === "reading_comprehension" || assignment.type === "kallkritik") && assignment.questions && (
        <QuestionsView text={assignment.text} questions={assignment.questions} onChange={onAnswerChange} />
      )}
      {assignment.type === "conjugate_verbs" && assignment.verbs && (
        <ConjugateView verbs={assignment.verbs} onChange={onAnswerChange} />
      )}

      {/* Generic textarea */}
      {needsTextarea && (
        <textarea
          onChange={(e) => onAnswerChange(e.target.value)}
          placeholder="Skriv ditt svar här…"
          rows={7}
          className="rounded-sm border-2 border-border bg-secondary/50 px-3 py-2 text-base outline-none focus:border-ring resize-none"
        />
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ClassroomMode({ onExit }: { onExit: () => void }) {
  const [key, setKey] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [keyStatus, setKeyStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [keyError, setKeyError] = useState("");

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState("");
  const [studentAnswer, setStudentAnswer] = useState("");

  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = loadKey();
    if (stored) { setKey(stored); setKeyInput(stored); setKeyStatus("ok"); }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function testKey() {
    const k = keyInput.trim();
    if (!k) return;
    setKeyStatus("testing");
    setKeyError("");
    try {
      await geminiRaw(k, "Reply with just: OK", 10);
      setKey(k); saveKey(k); setKeyStatus("ok");
    } catch (e) {
      setKeyStatus("fail");
      setKeyError(e instanceof Error ? e.message : "Okänt fel");
    }
  }

  async function newAssignment() {
    if (!key) return;
    setGenLoading(true);
    setGenError("");
    setStudentAnswer("");
    setMessages([]);
    try {
      setAssignment(await generateAssignment(key));
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Kunde inte skapa uppgift");
    } finally {
      setGenLoading(false);
    }
  }

  function teacherSystem() {
    if (!assignment) return "";
    return `You are Läraren, a warm, encouraging Swedish language teacher for Year 7 students (age 13, A2/B1 level).

CURRENT ASSIGNMENT:
Type: ${TYPE_META[assignment.type].label}
Title: ${assignment.title}
Instructions: ${assignment.instructions}
${assignment.text ? `Text: ${assignment.text}` : ""}
${assignment.prompt ? `Prompt: ${assignment.prompt}` : ""}
${assignment.sentences ? `Sentences: ${assignment.sentences.join(" | ")}` : ""}
${assignment.questions ? `Questions: ${assignment.questions.join(" | ")}` : ""}
ANSWER KEY (do NOT reveal — only use when grading): ${assignment.answer_key}

STUDENT'S CURRENT WORK:
${studentAnswer || "(inget svar ännu)"}

RULES:
- Answer questions in simple Swedish, use English only if student writes in English
- Give hints WITHOUT revealing the answer
- When asked to grade (betyg/grade), use A–F with specific, kind feedback
- When asked to correct (rätta), show what was wrong and why, then show the correct version
- Keep replies to 4–7 sentences unless grading
- Be warm, use the student's progress to encourage them`;
  }

  async function sendChat(text: string) {
    if (!text.trim() || chatLoading || !key) return;
    setChatInput("");
    const next: Message[] = [...messages, { role: "user", text: text.trim() }];
    setMessages(next);
    setChatLoading(true);
    try {
      const reply = await geminiChat(key, teacherSystem(), messages, text.trim());
      setMessages([...next, { role: "model", text: reply }]);
    } catch (e) {
      setMessages([...next, { role: "model", text: `⚠️ ${e instanceof Error ? e.message : "Fel"}` }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatInputRef.current?.focus(), 50);
    }
  }

  const hasKey = !!key && keyStatus !== "fail";

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="pixel-panel flex items-center justify-between gap-2 rounded-sm bg-card p-3">
        <div className="flex items-center gap-2">
          <span className="font-pixel text-[11px] text-primary">KLASSRUMSLÄGE</span>
          <span className="rounded-sm bg-accent px-2 py-0.5 font-pixel text-[8px] text-accent-foreground">BETA</span>
        </div>
        <button onClick={onExit} className="rounded-sm border-2 border-border bg-card px-3 py-1.5 font-pixel text-[9px] shadow-pixel-sm active:translate-y-0.5 active:shadow-none">
          KARTAN
        </button>
      </div>

      {/* Key panel */}
      {!hasKey ? (
        <div className="pixel-panel flex flex-col gap-3 rounded-sm bg-card p-4">
          <span className="font-pixel text-[9px] text-muted-foreground">GEMINI API-NYCKEL</span>
          <div className="flex flex-wrap gap-2">
            <input type="password" value={keyInput} onChange={(e) => { setKeyInput(e.target.value); setKeyStatus("idle"); }}
              onKeyDown={(e) => e.key === "Enter" && testKey()} placeholder="AIzaSy..."
              className="flex-1 rounded-sm border-2 border-border bg-secondary/50 px-3 py-2 text-sm outline-none focus:border-ring" />
            <button onClick={testKey} disabled={keyStatus === "testing"}
              className="rounded-sm border-2 border-border bg-primary px-4 py-2 font-pixel text-[9px] text-primary-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none disabled:opacity-50">
              {keyStatus === "testing" ? "TESTAR…" : "TESTA NYCKEL"}
            </button>
          </div>
          {keyStatus === "fail" && <span className="font-pixel text-[9px] text-destructive">✗ {keyError}</span>}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer"
            className="font-pixel text-[8px] text-muted-foreground underline underline-offset-4">
            Hämta gratis nyckel på aistudio.google.com →
          </a>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <span className="font-pixel text-[8px] text-success">✓ NYCKEL AKTIV</span>
          <button onClick={() => { setKey(""); setKeyStatus("idle"); }}
            className="font-pixel text-[8px] text-muted-foreground underline underline-offset-4">
            byt nyckel
          </button>
        </div>
      )}

      {/* Assignment panel */}
      {hasKey && (
        <div className="pixel-panel flex flex-col gap-4 rounded-sm bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-pixel text-[9px] text-muted-foreground">UPPGIFT</span>
            <button onClick={newAssignment} disabled={genLoading}
              className="rounded-sm border-2 border-border bg-accent px-3 py-1.5 font-pixel text-[9px] text-accent-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none disabled:opacity-50">
              {genLoading ? "GENERERAR…" : assignment ? "NY UPPGIFT" : "STARTA LEKTION"}
            </button>
          </div>

          {!assignment && !genLoading && (
            <p className="text-muted-foreground">Tryck på "Starta lektion" för att få din första uppgift. Varje uppgift är unik.</p>
          )}
          {genLoading && <p className="animate-pulse font-pixel text-[9px] text-muted-foreground">Läraren förbereder en uppgift…</p>}
          {genError && <p className="font-pixel text-[9px] text-destructive">✗ {genError}</p>}
          {assignment && !genLoading && (
            <AssignmentView assignment={assignment} onAnswerChange={setStudentAnswer} />
          )}
        </div>
      )}

      {/* Chat panel */}
      {hasKey && assignment && (
        <div className="pixel-panel flex flex-col gap-3 rounded-sm bg-card p-4">
          <span className="font-pixel text-[9px] text-muted-foreground">FRÅGA LÄRAREN</span>

          <div className="flex h-60 flex-col gap-3 overflow-y-auto pr-1">
            {messages.length === 0 && (
              <p className="text-muted-foreground italic">Ställ en fråga, be om en ledtråd, eller be läraren rätta och betygsätta ditt svar.</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`max-w-[88%] rounded-sm px-3 py-2 text-base whitespace-pre-wrap ${
                m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-secondary text-foreground"
              }`}>
                {m.text}
              </div>
            ))}
            {chatLoading && (
              <div className="max-w-[88%] animate-pulse rounded-sm bg-secondary px-3 py-2 font-pixel text-[9px] text-muted-foreground">
                Läraren skriver…
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {["Ge mig en ledtråd 💡", "Rätta mitt svar ✏️", "Sätt ett betyg 🎓", "Förklara uppgiften 📖"].map((q) => (
              <button key={q} onClick={() => sendChat(q)} disabled={chatLoading}
                className="rounded-sm border border-border bg-secondary/60 px-2 py-1 font-pixel text-[8px] text-muted-foreground hover:bg-secondary active:translate-y-0.5 disabled:opacity-40">
                {q}
              </button>
            ))}
          </div>

          <div className="flex gap-2 border-t border-border pt-3">
            <input ref={chatInputRef} value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendChat(chatInput)}
              placeholder="Skriv till läraren…" disabled={chatLoading}
              className="flex-1 rounded-sm border-2 border-border bg-secondary/50 px-3 py-2 text-base outline-none focus:border-ring disabled:opacity-50" />
            <button onClick={() => sendChat(chatInput)} disabled={chatLoading || !chatInput.trim()}
              className="rounded-sm border-2 border-border bg-primary px-4 py-2 font-pixel text-[9px] text-primary-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none disabled:opacity-50">
              SKICKA
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
