import { useCallback, useEffect, useRef, useState } from "react";

interface SRAlternative { transcript: string }
interface SRResult { isFinal: boolean; [index: number]: SRAlternative }
interface SREvent extends Event { resultIndex: number; results: ArrayLike<SRResult> }
interface SRErrorEvent extends Event { error: string }
interface SRInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
}
type SRCtor = new () => SRInstance;

function getCtor(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Long-form Swedish speech-to-text for oral assignments. The browser stops recognition after
 * a pause, so it is restarted automatically until stop() is called.
 */
export function useDictation() {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const recRef = useRef<SRInstance | null>(null);
  const wantRef = useRef(false);
  const finalRef = useRef("");

  useEffect(() => {
    setSupported(getCtor() !== null);
    return () => {
      wantRef.current = false;
      try { recRef.current?.abort(); } catch { /* already stopped */ }
    };
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    setError("");
    finalRef.current = "";
    setText("");
    setInterim("");
    const rec = new Ctor();
    rec.lang = "sv-SE";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += (finalRef.current ? " " : "") + r[0].transcript.trim();
        else live += r[0].transcript;
      }
      setText(finalRef.current);
      setInterim(live);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        wantRef.current = false;
        setError("Mikrofonen är blockerad. Tillåt mikrofon för den här sidan i webbläsaren.");
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        setError(`Taligenkänningen stannade (${e.error}).`);
      }
    };
    rec.onend = () => {
      if (wantRef.current) {
        try { rec.start(); } catch { setListening(false); }
      } else {
        setListening(false);
      }
    };
    recRef.current = rec;
    wantRef.current = true;
    try {
      rec.start();
      setListening(true);
    } catch {
      wantRef.current = false;
      setError("Kunde inte starta mikrofonen.");
    }
  }, []);

  const stop = useCallback(() => {
    wantRef.current = false;
    try { recRef.current?.stop(); } catch { /* already stopped */ }
    setListening(false);
    setInterim("");
  }, []);

  const reset = useCallback(() => {
    finalRef.current = "";
    setText("");
    setInterim("");
    setError("");
  }, []);

  return { supported, listening, text, interim, error, start, stop, reset };
}
