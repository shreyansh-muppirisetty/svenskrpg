import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "svenska-quest-classroom-gemini-key";
const MODEL = "gemini-2.0-flash";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const SYSTEM_PROMPT =
  "You are a friendly Swedish language tutor named 'Läraren'. " +
  "Help the student practice Swedish. Respond in simple Swedish unless they ask for English. " +
  "Keep replies short and encouraging. Correct grammar mistakes gently.";

type Message = { role: "user" | "model"; text: string };
type Status = "idle" | "testing" | "ok" | "fail" | "loading";

function loadKey(): string {
  try { return localStorage.getItem(STORAGE_KEY) ?? ""; } catch { return ""; }
}
function saveKey(k: string) {
  try { localStorage.setItem(STORAGE_KEY, k); } catch { /* ignore */ }
}

async function geminiChat(key: string, history: Message[], userText: string): Promise<string> {
  const contents = [
    ...history.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
    { role: "user", parts: [{ text: userText }] },
  ];

  const res = await fetch(`${API_BASE}/${MODEL}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 300 },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "(inget svar)";
}

export function ClassroomMode({ onExit }: { onExit: () => void }) {
  const [key, setKey] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = loadKey();
    if (stored) { setKey(stored); setKeyInput(stored); }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function testKey() {
    const k = keyInput.trim();
    if (!k) return;
    setStatus("testing");
    setError("");
    try {
      await geminiChat(k, [], "Hej! Svara bara: OK");
      setKey(k);
      saveKey(k);
      setStatus("ok");
    } catch (e: unknown) {
      setStatus("fail");
      setError(e instanceof Error ? e.message : "Okänt fel");
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || status === "loading") return;
    setInput("");
    const next: Message[] = [...messages, { role: "user", text }];
    setMessages(next);
    setStatus("loading");
    try {
      const reply = await geminiChat(key, messages, text);
      setMessages([...next, { role: "model", text: reply }]);
    } catch (e: unknown) {
      setMessages([...next, { role: "model", text: `⚠️ Fel: ${e instanceof Error ? e.message : "okänt"}` }]);
    } finally {
      setStatus("ok");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  const hasKey = !!key && status !== "fail";

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="pixel-panel rounded-sm bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-pixel text-[11px] text-primary">KLASSRUMSLÄGE</span>
            <span className="rounded-sm bg-accent px-2 py-0.5 font-pixel text-[8px] text-accent-foreground">
              BETA
            </span>
          </div>
          <button
            onClick={onExit}
            className="rounded-sm border-2 border-border bg-card px-3 py-1.5 font-pixel text-[9px] shadow-pixel-sm active:translate-y-0.5 active:shadow-none"
          >
            KARTAN
          </button>
        </div>
        <p className="mt-1 text-muted-foreground">
          Chatta fritt med Läraren på svenska. Powered by Gemini.
        </p>
      </div>

      {/* Key setup */}
      <div className="pixel-panel rounded-sm bg-card p-4 flex flex-col gap-3">
        <span className="font-pixel text-[9px] text-muted-foreground">GEMINI API-NYCKEL</span>
        <div className="flex flex-wrap gap-2">
          <input
            type="password"
            value={keyInput}
            onChange={(e) => { setKeyInput(e.target.value); setStatus("idle"); }}
            onKeyDown={(e) => e.key === "Enter" && testKey()}
            placeholder="AIzaSy..."
            className="flex-1 rounded-sm border-2 border-border bg-secondary/50 px-3 py-2 text-sm outline-none focus:border-ring"
          />
          <button
            onClick={testKey}
            disabled={status === "testing"}
            className="rounded-sm border-2 border-border bg-primary px-4 py-2 font-pixel text-[9px] text-primary-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none disabled:opacity-50"
          >
            {status === "testing" ? "TESTAR…" : "TESTA NYCKEL"}
          </button>
        </div>
        {status === "ok" && (
          <span className="font-pixel text-[9px] text-success">✓ NYCKEL FUNKAR</span>
        )}
        {status === "fail" && (
          <span className="font-pixel text-[9px] text-destructive">✗ {error}</span>
        )}
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="font-pixel text-[8px] text-muted-foreground underline underline-offset-4"
        >
          Hämta gratis nyckel på aistudio.google.com →
        </a>
      </div>

      {/* Chat */}
      {hasKey && (
        <div className="pixel-panel flex flex-col gap-3 rounded-sm bg-card p-4">
          <div className="flex h-72 flex-col gap-3 overflow-y-auto pr-1">
            {messages.length === 0 && (
              <p className="text-muted-foreground italic">
                Skriv något på svenska för att börja…
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-sm px-3 py-2 text-base ${
                  m.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground"
                }`}
              >
                {m.text}
              </div>
            ))}
            {status === "loading" && (
              <div className="max-w-[85%] rounded-sm bg-secondary px-3 py-2 font-pixel text-[9px] text-muted-foreground animate-pulse">
                Läraren skriver…
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="flex gap-2 border-t border-border pt-3">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Skriv på svenska…"
              disabled={status === "loading"}
              className="flex-1 rounded-sm border-2 border-border bg-secondary/50 px-3 py-2 text-base outline-none focus:border-ring disabled:opacity-50"
            />
            <button
              onClick={send}
              disabled={status === "loading" || !input.trim()}
              className="rounded-sm border-2 border-border bg-primary px-4 py-2 font-pixel text-[9px] text-primary-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none disabled:opacity-50"
            >
              SKICKA
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
