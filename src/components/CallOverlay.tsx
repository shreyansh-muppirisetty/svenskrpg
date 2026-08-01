import { useCallback, useEffect, useRef, useState } from "react";

// ── Minimal Gemini call (self-contained) ─────────────────────────────────────

const MODEL = "gemini-3.1-flash-lite";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

interface Turn { role: "user" | "model"; text: string }

async function gemini(key: string, turns: Turn[], system: string): Promise<string> {
  const res = await fetch(`${API_BASE}/${MODEL}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
      system_instruction: { parts: [{ text: system }] },
      generationConfig: { temperature: 0.9, maxOutputTokens: 90 },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const d = await res.json();
  const text = d.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Inget svar");
  return String(text).trim();
}

// ── Speech recognition typing ────────────────────────────────────────────────

type SRType = {
  lang: string; continuous: boolean; interimResults: boolean;
  start: () => void; stop: () => void; abort: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function getSR(): (new () => SRType) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SRType; webkitSpeechRecognition?: new () => SRType };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function pickSwedishVoice(): SpeechSynthesisVoice | null {
  try {
    const voices = window.speechSynthesis.getVoices() || [];
    return (
      voices.find((v) => v.lang?.toLowerCase().replace("_", "-") === "sv-se") ||
      voices.find((v) => v.lang?.toLowerCase().startsWith("sv")) ||
      null
    );
  } catch { return null; }
}

type Phase = "ringing" | "listening" | "thinking" | "speaking" | "ended";

export interface CallContact { name: string; initials: string; color: string }

export function CallOverlay({
  contact, persona, apiKey, onEnd,
}: { contact: CallContact; persona: string; apiKey: string; onEnd: () => void }) {
  const [phase, setPhase] = useState<Phase>("ringing");
  const [heard, setHeard] = useState("");
  const [said, setSaid] = useState("");
  const [err, setErr] = useState("");
  const [secs, setSecs] = useState(0);
  const [muted, setMuted] = useState(false);

  const historyRef = useRef<Turn[]>([]);
  const recRef = useRef<SRType | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const aliveRef = useRef(true);
  const mutedRef = useRef(false);
  const supported = !!getSR();

  useEffect(() => { mutedRef.current = muted; }, [muted]);

  const speak = useCallback(async (text: string) => {
    // Prefer cloud Swedish voice; fall back to a system sv-SE voice.
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      audioRef.current = audio;
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        void audio.play().catch(() => resolve());
      });
      return;
    } catch { /* fall through */ }
    try {
      const voice = pickSwedishVoice();
      await new Promise<void>((resolve) => {
        const u = new SpeechSynthesisUtterance(text);
        if (voice) u.voice = voice;
        u.lang = voice?.lang || "sv-SE";
        u.rate = 0.98;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      });
    } catch { /* ignore */ }
  }, []);

  const listen = useCallback(() => {
    const SR = getSR();
    if (!SR || !aliveRef.current) return;
    let finalText = "";
    const rec = new SR();
    recRef.current = rec;
    rec.lang = "sv-SE";
    rec.continuous = false;
    rec.interimResults = true;
    setHeard("");
    setPhase("listening");
    rec.onresult = (e) => {
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        const t = r[0]?.transcript ?? "";
        if (r.isFinal) finalText += t; else interim += t;
      }
      setHeard((finalText + interim).trim());
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed") setErr("Mikrofonen blockerad — tillåt mikrofon i webbläsaren.");
    };
    rec.onend = () => {
      if (!aliveRef.current) return;
      const text = finalText.trim();
      if (!text) { listen(); return; }
      void respond(text);
    };
    try { rec.start(); } catch { /* already running */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const respond = useCallback(async (text: string) => {
    if (!aliveRef.current) return;
    setPhase("thinking");
    historyRef.current = [...historyRef.current.slice(-10), { role: "user", text }];
    try {
      const reply = await gemini(apiKey, historyRef.current, `${persona}\nYou are on a PHONE CALL — speak naturally, 1-2 short spoken Swedish sentences. No emoji, no asterisks, no formatting.`);
      if (!aliveRef.current) return;
      historyRef.current = [...historyRef.current, { role: "model", text: reply }];
      setSaid(reply);
      setPhase("speaking");
      await speak(reply);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Fel");
    }
    if (!aliveRef.current) return;
    if (mutedRef.current) { setPhase("listening"); return; }
    listen();
  }, [apiKey, persona, speak, listen]);

  // Ring, then answer and greet.
  useEffect(() => {
    aliveRef.current = true;
    const t = setTimeout(async () => {
      if (!aliveRef.current) return;
      setPhase("thinking");
      try {
        const greet = await gemini(apiKey, [{ role: "user", text: "Du svarar precis i telefonen. Säg en kort naturlig hälsning på svenska, en mening." }], persona);
        if (!aliveRef.current) return;
        historyRef.current = [{ role: "model", text: greet }];
        setSaid(greet);
        setPhase("speaking");
        await speak(greet);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Fel");
      }
      if (aliveRef.current) listen();
    }, 1800);
    return () => {
      clearTimeout(t);
      aliveRef.current = false;
      try { recRef.current?.abort(); } catch { /* ignore */ }
      try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
      audioRef.current?.pause();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Call timer
  useEffect(() => {
    if (phase === "ringing" || phase === "ended") return;
    const i = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(i);
  }, [phase]);

  function toggleMute() {
    setMuted((m) => {
      const next = !m;
      if (next) { try { recRef.current?.abort(); } catch { /* ignore */ } }
      else if (phase !== "thinking" && phase !== "speaking") listen();
      return next;
    });
  }

  const mmss = `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, "0")}`;
  const status =
    phase === "ringing" ? "ringer…"
    : phase === "listening" ? (muted ? "mikrofon av" : "lyssnar… prata!")
    : phase === "thinking" ? "tänker…"
    : phase === "speaking" ? "pratar…"
    : "samtal avslutat";

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-background/95 p-6">
      <div className="flex flex-col items-center gap-3 pt-16">
        <div className="flex h-24 w-24 items-center justify-center border-2 border-border font-pixel text-[16px] text-white shadow-pixel-sm"
          style={{ background: contact.color }}>{contact.initials}</div>
        <p className="font-pixel text-[14px]">{contact.name}</p>
        <p className="font-pixel text-[9px] text-muted-foreground">{phase === "ringing" ? status : `${mmss} · ${status}`}</p>
        {!supported && <p className="max-w-xs text-center font-pixel text-[8px] text-destructive">Din webbläsare stödjer inte röstigenkänning (prova Chrome).</p>}
        {err && <p className="max-w-xs text-center font-pixel text-[8px] text-destructive">✗ {err}</p>}
      </div>

      <div className="w-full max-w-sm space-y-2">
        {said && (
          <div className="border-2 border-border bg-card p-3">
            <p className="font-pixel text-[7px] text-muted-foreground">{contact.name}</p>
            <p className="text-sm leading-snug">{said}</p>
          </div>
        )}
        {heard && (
          <div className="border-2 border-border bg-accent p-3">
            <p className="font-pixel text-[7px] text-muted-foreground">Du</p>
            <p className="text-sm leading-snug">{heard}</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 pb-10">
        <button type="button" onClick={toggleMute}
          className="h-14 w-14 border-2 border-border bg-card font-pixel text-[9px] shadow-pixel-sm active:translate-y-0.5">
          {muted ? "🔇" : "🎤"}
        </button>
        <button type="button" onClick={() => { aliveRef.current = false; setPhase("ended"); onEnd(); }}
          className="h-14 w-20 border-2 border-border bg-destructive font-pixel text-[9px] text-white shadow-pixel-sm active:translate-y-0.5">
          LÄGG PÅ
        </button>
      </div>
    </div>
  );
}
