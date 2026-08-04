import { useState, useRef, useEffect, useMemo } from "react";
import { CallOverlay } from "./CallOverlay";
import { voiceFor } from "@/lib/voices";


// ── Gemini (same as rest of app) ──────────────────────────────────────────────

const MODEL = "gemini-3.1-flash-lite";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const KEY_STORE = "svenska-quest-classroom-gemini-key";

function loadKey() { try { return localStorage.getItem(KEY_STORE) ?? ""; } catch { return ""; } }

export interface InlineFile { mime: string; data: string; name?: string }
interface GeminiTurn { role: "user" | "model"; text: string; files?: InlineFile[] }

async function gemini(key: string, turns: GeminiTurn[], system?: string, maxTokens = 200): Promise<string> {
  const body: Record<string, unknown> = {
    contents: turns.map(t => ({
      role: t.role,
      parts: [
        { text: t.text },
        ...(t.files ?? []).map(f => ({ inline_data: { mime_type: f.mime, data: f.data } })),
      ],
    })),
    generationConfig: { temperature: 0.9, maxOutputTokens: maxTokens },
  };
  if (system) body.system_instruction = { parts: [{ text: system }] };
  const res = await fetch(`${API_BASE}/${MODEL}:generateContent?key=${key}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const d = await res.json();
  const text = d.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No response");
  return text;
}

function parseArr<T>(raw: string): T[] {
  const s = raw.indexOf("["), e = raw.lastIndexOf("]");
  if (s === -1) return [];
  return JSON.parse(raw.slice(s, e + 1));
}

// ── Config ────────────────────────────────────────────────────────────────────

interface Contact { id: string; name: string; initials: string; color: string; sub: string; isGroup?: boolean }

const BASE_CONTACTS: Contact[] = [
  { id: "johnny", name: "Johnny",      initials: "JO", color: "#c0392b", sub: "online" },
  { id: "jacob",  name: "Jacob",       initials: "JA", color: "#16a085", sub: "last seen today at 14:32" },
  { id: "sam",    name: "Sam",         initials: "SA", color: "#2980b9", sub: "online" },
  { id: "class",  name: "Klass 8B 🎒", initials: "8B", color: "#8e44ad", sub: "22 members", isGroup: true },
];

type CID = string;

const PERSONAS: Record<string, string> = {
  johnny: `You are Johnny, 15yo Swedish student. You think you're the coolest kid in school. Huge ego. Use lots of abbrevs mixed into Swedish: ngl, fr, lowkey, no cap, tbh, bruh, lol. Max 1-2 very short sentences. Never show weakness. Act unbothered. No full stops at end. Speak Swedish — full sentences in Swedish with English slang words mixed in naturally like Swedish teens do.`,
  jacob:  `You are Jacob, 15yo Swedish student. Kind and sweet but a little sensitive — gets feelings hurt easily. Warm, caring. Short messages 1-2 sentences. Sometimes overthinks. Speak Swedish. You can mix in the odd English word naturally like Swedish teens do but full sentences are Swedish.`,
  sam:    `You are Sam, 15yo Swedish student. COMPLETELY obsessed with football (soccer). Bring football into every single reply no matter how unrelated. 1-2 sentences. Enthusiastic. Speak Swedish. Mix in occasional English football terms naturally.`,
};


const CLASS_CHARS = `Alex: quiet, rarely texts, strict parents, soft-hearted; Hugo: football obsessed, best friends with Sam; Viggo: the user's rival/enemy, rarely joins unless there is drama or he is directly involved, but whenever he does write he is ALWAYS mean, mocking and hostile toward the user specifically (never nice, throws sarcastic insults and put-downs at the user, still friendly-ish to others); Sam: totally obsessed with football, enthusiastic; Jacob: kind and sweet but sensitive, overthinks; Johnny: popular, huge ego, cool, uses slang like ngl/fr/lowkey/no cap, never shows weakness; Emma: class representative, responsible, reminds about homework; Ella: always has the latest gossip; Noah: lurker, mostly short reactions; Lucas: funny and sarcastic, teases everyone; William: tech nerd into games, PCs and AI; Oscar: class clown, memes and jokes; Leo: relaxed, does not care about drama; Filip: competitive, tries to win every discussion; Elias: friendly, tries to stop arguments; Isak: dry humor, very short replies; Nils: loves cars and motorcycles; Maja: loud, energetic, starts conversations; Olivia: popular but kind, voice of reason; Sofia: friendly and supportive; Klara: curious, asks lots of questions`;

const CLASS_NAMES = ["Alex","Hugo","Viggo","Sam","Jacob","Johnny","Emma","Ella","Noah","Lucas","William","Oscar","Leo","Filip","Elias","Isak","Nils","Maja","Olivia","Sofia","Klara"];

// ── Presence / offline simulation helpers ────────────────────────────────────

const STORE = "svenska-quest-whatsapp-state";
/** Max messages that can pile up while the player is away. */
const MAX_OFFLINE_GROUP = 23;
const MAX_OFFLINE_SOLO = 3;

const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]] = [a[j],a[i]]; }
  return a;
}
const pickN = <T,>(arr: T[], n: number) => shuffle(arr).slice(0, Math.max(0, n));

/** Random number of repliers — sometimes nobody answers at all. */
function replyCount(): number {
  const r = Math.random();
  if (r < 0.22) return 0;
  if (r < 0.62) return 1;
  if (r < 0.87) return 2;
  return 3;
}

/** Who drifts in and out of the chat over time. */
function driftPresence(current: string[]): string[] {
  let next = [...current];
  if (next.length > 3 && Math.random() < 0.5) next = next.filter(n => n !== next[rnd(0, next.length-1)]);
  if (next.length > 4 && Math.random() < 0.3) next = next.filter(n => n !== next[rnd(0, next.length-1)]);
  const away = CLASS_NAMES.filter(n => !next.includes(n));
  const joins = pickN(away, Math.random() < 0.55 ? rnd(1,2) : 0);
  next = [...next, ...joins];
  if (next.length < 3) next = [...next, ...pickN(away.filter(n=>!next.includes(n)), 3 - next.length)];
  return next.slice(0, 12);
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Msg {
  id: number; role: "user" | "contact"; text: string;
  type: "text" | "image" | "audio" | "file"; time: string;
  sender?: string; imageDesc?: string; duration?: string;
  /** Attachment the player sent (data URL) */
  dataUrl?: string; mime?: string; fileName?: string;
}

let _id = 0;
const nid = () => ++_id;
const ts = () => { const d = new Date(); return `${d.getHours()}:${d.getMinutes().toString().padStart(2,"0")}`; };
function nameColor(n = "") {
  const p = ["#c0392b","#16a085","#2980b9","#8e44ad","#e67e22","#27ae60","#d35400","#c0392b"];
  let h = 0; for (const c of n) h = ((h<<5)-h+c.charCodeAt(0))|0;
  return p[Math.abs(h)%p.length];
}

// ── Waveform ──────────────────────────────────────────────────────────────────

function Waveform({ seed }: { seed: number }) {
  const bars = useMemo(() => Array.from({length:20},(_,i)=>{
    const x = Math.sin((i+1)*seed*127.1+311.7)*43758.5;
    return Math.floor(Math.abs(x-Math.floor(x))*18)+3;
  }), [seed]);
  return (
    <div className="flex items-center gap-px">
      {bars.map((h,i)=><div key={i} style={{width:2,height:h,background:"var(--muted-foreground)",borderRadius:0}}/>)}
    </div>
  );
}

// ── Bubble ────────────────────────────────────────────────────────────────────

function pickSwedishVoice(): SpeechSynthesisVoice | null {
  try {
    const voices = window.speechSynthesis.getVoices() || [];
    return (
      voices.find((v) => v.lang?.toLowerCase().replace("_", "-") === "sv-se") ||
      voices.find((v) => v.lang?.toLowerCase().startsWith("sv")) ||
      null
    );
  } catch {
    return null;
  }
}
function RichText({ text }: { text: string }) {
  const parts = text.split(/(@[\p{L}]+)/u);
  return (
    <>
      {parts.map((p, i) =>
        /^@[\p{L}]+$/u.test(p) && CLASS_NAMES.some(n => n.toLowerCase() === p.slice(1).toLowerCase())
          ? <span key={i} className="font-semibold text-primary">{p}</span>
          : <span key={i}>{p}</span>
      )}
    </>
  );
}


function Bubble({ msg, isGroup }: { msg: Msg; isGroup: boolean }) {
  const sent = msg.role === "user";
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // voice list loads async in most browsers
    try { window.speechSynthesis?.getVoices(); } catch { /* ignore */ }
    return () => {
      try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
      audioRef.current?.pause();
    };
  }, []);

  function stop() {
    try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setPlaying(false);
  }

  async function speakViaServer(text: string) {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: msg.sender ? voiceFor(msg.sender) : undefined }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      audioRef.current = audio;
      audio.onended = () => setPlaying(false);
      audio.onerror = () => setPlaying(false);
      await audio.play();
    } catch {
      setPlaying(false);
    }
  }

  function toggleAudio() {
    if (typeof window === "undefined") return;
    if (playing) { stop(); return; }
    setPlaying(true);

    // Real recorded / uploaded audio → play the actual file
    if (msg.dataUrl) {
      const audio = new Audio(msg.dataUrl);
      audioRef.current = audio;
      audio.onended = () => setPlaying(false);
      audio.onerror = () => setPlaying(false);
      void audio.play().catch(() => setPlaying(false));
      return;
    }

    const text = msg.text || "Hej!";

    const voice = "speechSynthesis" in window && !msg.sender ? pickSwedishVoice() : null;
    if (voice) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice;
      u.lang = voice.lang || "sv-SE";
      u.rate = 0.95;
      u.onend = () => setPlaying(false);
      u.onerror = () => setPlaying(false);
      window.speechSynthesis.speak(u);
      return;
    }
    // No Swedish system voice → use the Swedish cloud voice instead of an English one
    void speakViaServer(text);
  }

  return (
    <div className={`flex ${sent?"justify-end":"justify-start"} mb-2`}>
      {isGroup && !sent && (
        <div className="w-6 h-6 border-2 border-border flex items-center justify-center font-pixel text-[8px] text-white mr-1 mt-auto shrink-0"
          style={{background: nameColor(msg.sender)}}>{msg.sender?.[0]}</div>
      )}
      <div style={{maxWidth:"76%"}}>
        {isGroup && !sent && (
          <p className="font-pixel text-[8px] px-1 mb-0.5" style={{color: nameColor(msg.sender)}}>{msg.sender}</p>
        )}
        <div className="border-2 border-border shadow-pixel-sm" style={{
          background: sent ? "var(--accent)" : "var(--card)",
          padding: msg.type==="image" ? 2 : "6px 10px 4px",
        }}>
          {msg.type==="image" && (
            <img src={msg.dataUrl || `https://picsum.photos/seed/${(msg.sender||"u")+msg.id}/200/140`}
              alt={msg.imageDesc||"photo"} style={{width:200,maxHeight:200,objectFit:"cover",display:"block"}}/>
          )}
          {msg.type==="file" && (
            <a href={msg.dataUrl} download={msg.fileName}
              className="flex items-center gap-2 px-1 py-1" style={{minWidth:160}}>
              <span className="w-7 h-7 border-2 border-border flex items-center justify-center bg-accent text-[12px] shrink-0">📄</span>
              <span className="text-sm truncate">{msg.fileName || "fil"}</span>
            </a>
          )}
          {msg.type==="audio" && (
            <div className="flex items-center gap-2 px-2 py-1" style={{minWidth:180}}>
              <button type="button" onClick={toggleAudio} aria-label={playing?"Stoppa röstmeddelande":"Spela röstmeddelande"}
                className="w-7 h-7 border-2 border-border flex items-center justify-center font-pixel text-[8px] bg-accent text-accent-foreground shrink-0 active:translate-y-0.5">
                {playing ? "■" : "▶"}
              </button>
              <Waveform seed={msg.id}/>
              <span className="font-pixel text-[7px] text-muted-foreground">{msg.duration||"0:08"}</span>
            </div>
          )}
          {msg.type==="text" && <p className="text-sm leading-snug"><RichText text={msg.text}/></p>}
          {(msg.type==="image"||msg.type==="file") && msg.text && <p className="text-sm px-1 pt-1"><RichText text={msg.text}/></p>}
          <div className="flex items-center justify-end gap-1 mt-0.5">
            <span className="font-pixel text-[7px] text-muted-foreground">{msg.time}</span>
            {sent && <span className="font-pixel text-[7px] text-primary">✓✓</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function WhatsAppMode({ onExit }: { onExit: () => void }) {
  const key = loadKey();
  const [active, setActive] = useState<CID|null>(null);
  const [calling, setCalling] = useState<CID|null>(null);
  const saved = useRef<{convos?:Record<CID,Msg[]>; presence?:string[]; left?:number} | null>(null);
  if (saved.current === null) {
    try { saved.current = JSON.parse(localStorage.getItem(STORE) || "null") ?? {}; } catch { saved.current = {}; }
    const all = Object.values(saved.current?.convos ?? {}).flat() as Msg[];
    _id = all.reduce((m, x) => Math.max(m, x.id || 0), 0);
  }
  const [convos, setConvos] = useState<Record<CID,Msg[]>>(
    saved.current?.convos ?? {johnny:[],jacob:[],sam:[],class:[]}
  );
  const [presence, setPresence] = useState<string[]>(
    saved.current?.presence?.length ? saved.current.presence : pickN(CLASS_NAMES, rnd(4,7))
  );
  const [input, setInput] = useState("");
  const [att, setAtt] = useState<{dataUrl:string; mime:string; name:string; kind:"image"|"audio"|"file"}|null>(null);
  const [recording, setRecording] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<MediaRecorder|null>(null);
  const [typing, setTyping] = useState(false);
  const [err, setErr] = useState("");
  const [unread, setUnread] = useState<Record<CID,number>>({johnny:2,jacob:1,sam:0,class:5});
  const bottomRef = useRef<HTMLDivElement>(null);
  const callContact = CONTACTS.find(c=>c.id===calling);

  const mentionQuery = useMemo(()=>{
    const m = /@([\p{L}]*)$/u.exec(input);
    return m ? m[1] : null;
  },[input]);
  const mentionOpts = useMemo(()=>{
    if (mentionQuery === null) return [] as string[];
    return CLASS_NAMES.filter(n=>n.toLowerCase().startsWith(mentionQuery.toLowerCase())).slice(0,6);
  },[mentionQuery]);
  function applyMention(name: string) {
    setInput(v=>v.replace(/@[\p{L}]*$/u, `@${name} `));
  }



  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[convos,active,typing]);

  function add(cid: CID, msg: Omit<Msg,"id"|"time">) {
    setConvos(c=>({...c,[cid]:[...c[cid],{...msg,id:nid(),time:ts()}]}));
  }

  function clearAll() {
    setConvos({johnny:[],jacob:[],sam:[],class:[]});
    setUnread({johnny:0,jacob:0,sam:0,class:0});
    setPresence(pickN(CLASS_NAMES, rnd(4,7)));
    try { localStorage.removeItem(STORE); } catch { /* ignore */ }
    setActive(null);
  }

  // ── Living chat: presence drift, background chatter and offline catch-up ────

  const stateRef = useRef({ convos, presence, active, calling, typing });
  stateRef.current = { convos, presence, active, calling, typing };
  const busyRef = useRef(false);

  useEffect(() => {
    try { localStorage.setItem(STORE, JSON.stringify({ convos, presence, left: Date.now() })); } catch { /* ignore */ }
  }, [convos, presence]);

  function pushGroup(arr: {name:string;text:string;type?:string;imageDesc?:string;duration?:string}[]) {
    if (!arr.length) return;
    setConvos(c => ({
      ...c,
      class: [...c.class, ...arr.map(m => ({
        id: nid(), time: ts(), role: "contact" as const, sender: m.name,
        text: m.text || m.imageDesc || "", type: (m.type as Msg["type"]) || "text",
        imageDesc: m.imageDesc, duration: m.duration,
      }))],
    }));
    if (stateRef.current.active !== "class") setUnread(u => ({ ...u, class: u.class + arr.length }));
  }

  async function groupChatter(count: number, note: string) {
    if (!key || count <= 0 || busyRef.current) return;
    busyRef.current = true;
    try {
      const online = stateRef.current.presence;
      const recent = stateRef.current.convos.class.slice(-8).map(m => `${m.sender || "Du"}: ${m.text}`).join("\n");
      const raw = await gemini(key, [{
        role: "user",
        text: `Swedish WhatsApp class group chat (Klass 8B, 15-year-olds). Characters: ${CLASS_CHARS}. ONLY these people are online right now and may write: ${online.join(", ")}. Recent messages:\n${recent || "(tom chatt)"}\n${note}\nGenerate exactly ${count} messages between them (the player is NOT writing). Keep an actual thread going — they answer each other, not the player. Very short (3-12 words), Swedish with teen English slang, no emoji spam. Occasionally an image or a voice note; for "audio" the "text" MUST be the spoken Swedish words. Return ONLY a JSON array: [{"name":"Maja","text":"var e alla","type":"text"}]`,
      }], undefined, 120 + count * 45);
      pushGroup(parseArr<{name:string;text:string;type?:string;imageDesc?:string;duration?:string}>(raw).slice(0, count));
    } catch { /* silent background failure */ }
    busyRef.current = false;
  }

  async function soloChatter(cid: CID, count: number) {
    if (!key || count <= 0 || cid === "class") return;
    try {
      const history = stateRef.current.convos[cid].slice(-8).map(m => `${m.role === "user" ? "Du" : CONTACTS.find(c=>c.id===cid)?.name}: ${m.text}`).join("\n");
      const raw = await gemini(key, [{
        role: "user",
        text: `Recent chat:\n${history || "(tom chatt)"}\nWrite exactly ${count} short new messages you send on your own while the player is away (double-texting). Swedish, very short. Return ONLY a JSON array of strings: ["hallå?","svara typ"]`,
      }], PERSONAS[cid], 100);
      const arr = parseArr<string>(raw).slice(0, count).filter(t => typeof t === "string" && t.trim());
      if (!arr.length) return;
      setConvos(c => ({ ...c, [cid]: [...c[cid], ...arr.map(t => ({ id: nid(), time: ts(), role: "contact" as const, text: t.trim(), type: "text" as const }))] }));
      if (stateRef.current.active !== cid) setUnread(u => ({ ...u, [cid]: u[cid] + arr.length }));
    } catch { /* silent */ }
  }

  // Catch up on everything that happened while the player was in another mode.
  useEffect(() => {
    const left = saved.current?.left;
    if (!key || !left) return;
    const mins = (Date.now() - left) / 60000;
    if (mins < 1) return;
    setPresence(p => driftPresence(p));
    const n = Math.min(MAX_OFFLINE_GROUP, Math.max(1, Math.round(mins / 2)));
    void groupChatter(n, `The player has been offline for about ${Math.round(mins)} minutes — this is everything they missed.`);
    for (const cid of pickN(["johnny","jacob","sam"] as CID[], Math.random() < 0.5 ? rnd(1,2) : 0)) {
      void soloChatter(cid, rnd(1, MAX_OFFLINE_SOLO));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While the app is open the class keeps chatting on its own.
  useEffect(() => {
    if (!key) return;
    const i = setInterval(() => {
      if (stateRef.current.calling || stateRef.current.typing || busyRef.current) return;
      setPresence(p => (Math.random() < 0.5 ? driftPresence(p) : p));
      if (stateRef.current.convos.class.length && Math.random() < 0.55) {
        void groupChatter(rnd(1, 3), "Continue the conversation naturally right now.");
      } else if (Math.random() < 0.15) {
        void soloChatter(pickN(["johnny","jacob","sam"] as CID[], 1)[0], 1);
      }
    }, 45000);
    return () => clearInterval(i);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);


  async function openChat(id: CID) {
    setActive(id); setErr("");
    setUnread(u=>({...u,[id]:0}));
    if (convos[id].length > 0) return;
    setTyping(true);
    try {
      if (id === "class") {
        const raw = await gemini(key, [{
          role: "user",
          text: `Simulate a Swedish WhatsApp class group chat (Klass 8B, 15-year-olds, 22 members). Generate 5-7 messages the user missed while offline. Characters: ${CLASS_CHARS}. Rules: very short messages (3-12 words each), no emoji spam, mix Swedish/English, realistic teen topics, stay true to each personality. Viggo only appears if there is drama, and when he does he is always mean and mocking toward the user. Occasionally one is an image or voice note. For "audio" messages, "text" MUST contain the spoken Swedish words of the voice note (it is played aloud, never shown). Return ONLY a JSON array, no other text: [{"name":"Maja","text":"omg guys","type":"text"},{"name":"Hugo","text":"","type":"image","imageDesc":"training today"},{"name":"Emma","text":"hej alla, glöm inte provet imorgon","type":"audio","duration":"0:11"}]`
        }], undefined, 500);
        const arr = parseArr<{name:string;text:string;type:string;imageDesc?:string;duration?:string}>(raw);
        arr.forEach(m => add("class",{role:"contact",sender:m.name,text:m.text||m.imageDesc||"",type:(m.type as Msg["type"])||"text",imageDesc:m.imageDesc,duration:m.duration}));
      } else {
        const reply = await gemini(key,
          [{role:"user", text:"Send me one casual opening text like you just randomly texted out of nowhere. One short sentence only. No quotation marks."}],
          PERSONAS[id], 60
        );
        add(id, {role:"contact", text:reply.trim(), type:"text"});
      }
    } catch(e) { setErr(e instanceof Error ? e.message : "Fel"); }
    setTyping(false);
  }

  function kindOf(mime: string): "image"|"audio"|"file" {
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("audio/")) return "audio";
    return "file";
  }

  function toDataUrl(blob: Blob): Promise<string> {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = () => rej(new Error("Kunde inte läsa filen"));
      r.readAsDataURL(blob);
    });
  }

  async function pickFile(f: File | undefined | null) {
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { setErr("Filen är för stor (max 8 MB)"); return; }
    try {
      const dataUrl = await toDataUrl(f);
      setAtt({ dataUrl, mime: f.type || "application/octet-stream", name: f.name, kind: kindOf(f.type || "") });
      setErr("");
    } catch (e) { setErr(e instanceof Error ? e.message : "Fel"); }
  }

  async function toggleRecord() {
    if (recording) { recRef.current?.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setRecording(false);
        const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
        const dataUrl = await toDataUrl(blob);
        setAtt({ dataUrl, mime: blob.type, name: "röstmeddelande", kind: "audio" });
      };
      recRef.current = mr;
      mr.start();
      setRecording(true);
    } catch { setErr("Mikrofonen blockerad — tillåt mikrofon i webbläsaren."); }
  }

  async function send() {
    const text = input.trim();
    if ((!text && !att) || typing || !active) return;
    const attachment = att;
    setInput(""); setAtt(null); setErr("");
    add(active, attachment
      ? {role:"user", text, type:attachment.kind, dataUrl:attachment.dataUrl, mime:attachment.mime, fileName:attachment.name}
      : {role:"user", text, type:"text"});
    setTyping(true);
    const files: InlineFile[] = attachment
      ? [{ mime: attachment.mime.split(";")[0], data: attachment.dataUrl.split(",")[1] ?? "", name: attachment.name }]
      : [];
    const attNote = attachment
      ? `\nThe user also attached ${attachment.kind === "image" ? "an image" : attachment.kind === "audio" ? "a voice note (listen to it)" : `a file (${attachment.name})`} — actually look at/listen to it and react specifically to its real content.`
      : "";
    try {
      if (active === "class") {
        const recent = convos.class.slice(-8).map(m=>`${m.sender||"Du"}: ${m.text}`).join("\n");
        const mentioned = CLASS_NAMES.filter(n=>new RegExp(`@${n}\\b`,"i").test(text));
        // People who were actually talking with you, from those currently online.
        const talkers = [...new Set(convos.class.slice(-12).map(m=>m.sender).filter((n): n is string => !!n))];
        const online = [...new Set([...presence, ...mentioned])];
        const pool = [...new Set([...mentioned, ...talkers.filter(n=>online.includes(n)), ...online])];
        const n = mentioned.length ? Math.min(pool.length, mentioned.length + (Math.random()<0.4?1:0)) : Math.min(pool.length, replyCount());
        if (n === 0) { setTyping(false); return; }
        const speakers = [...mentioned, ...pool.filter(p=>!mentioned.includes(p)).slice(0, Math.max(0, n - mentioned.length))].slice(0, n);
        const mentionRule = mentioned.length
          ? ` The user directly called out ${mentioned.join(", ")} with @mentions — those people reply first, in that order, each staying fully in character (Viggo replies mean and mocking toward the user).`
          : "";
        const raw = await gemini(key, [{
          role: "user",
          files,
          text: `Swedish class WhatsApp group. Online right now: ${online.join(", ")}. Recent messages:\n${recent}\nUser just sent: "${text}"${attNote}\nGenerate exactly ${n} short replies, only from these people and in this order: ${speakers.join(", ")}. Characters: ${CLASS_CHARS}.${mentionRule} Rules: very short (3-12 words), no emoji spam, mix Swedish/English, can react to user or sidetrack, occasionally image or audio. For "audio", "text" MUST be the spoken Swedish words of the voice note. Return ONLY JSON array: [{"name":"Ella","text":"omg fr","type":"text"}]`
        }], undefined, 300);
        const arr = parseArr<{name:string;text:string;type:string;imageDesc?:string;duration?:string}>(raw).slice(0, n);
        for (const m of arr) {
          await new Promise(r=>setTimeout(r,400+Math.random()*900));
          add("class",{role:"contact",sender:m.name,text:m.text||m.imageDesc||"",type:(m.type as Msg["type"])||"text",imageDesc:m.imageDesc,duration:m.duration});
        }
      } else {
        const history: GeminiTurn[] = convos[active].slice(-10).map(m=>({
          role: m.role==="user" ? "user" : "model" as "user"|"model",
          text: m.text,
        }));
        history.push({role:"user", text: text + attNote, files});
        const reply = await gemini(key, history, PERSONAS[active], 100);
        add(active, {role:"contact", text:reply.trim(), type:"text"});
      }
    } catch(e) { setErr(e instanceof Error ? e.message : "Fel"); }
    setTyping(false);
  }

  const contact = CONTACTS.find(c=>c.id===active);

  const callMemory = calling
    ? convos[calling].slice(-14)
        .map(m => `${m.role === "user" ? "Du" : (m.sender || callContact?.name || "")}: ${m.type === "image" ? `[bild: ${m.imageDesc || ""}]` : m.text}`)
        .join("\n")
    : "";

  function endCall(transcript: { name: string; text: string }[]) {
    const cid = calling;
    setCalling(null);
    if (!cid || !transcript.length) return;
    // Fold what was said on the call into the chat history, so later chats
    // (and the next call's `memory`) actually remember it.
    setConvos(c => ({
      ...c,
      [cid]: [
        ...c[cid],
        ...transcript.map(l => ({
          id: nid(),
          time: ts(),
          type: "text" as const,
          role: (l.name === "Du" ? "user" : "contact") as Msg["role"],
          sender: l.name === "Du" ? undefined : l.name,
          text: `📞 ${l.text}`,
        })),
      ],
    }));
  }

  const overlay = calling && callContact ? (
    <CallOverlay
      contact={{name:callContact.name, initials:callContact.initials, color:callContact.color}}
      persona={PERSONAS[calling] ?? ""}
      apiKey={key}
      memory={callMemory}
      group={calling === "class" ? { chars: CLASS_CHARS, names: CLASS_NAMES } : undefined}
      onEnd={endCall}
    />
  ) : null;


  // ── List ────────────────────────────────────────────────────────────────────

  if (!active) return (
    <div className="flex flex-col gap-4">
      {overlay}

      <div className="pixel-panel flex items-center justify-between rounded-sm bg-card p-4">
        <div>
          <p className="font-pixel text-[11px] text-primary">WHATSAPP</p>
          <p className="text-sm text-muted-foreground">Johnny · Jacob · Sam · Klass 8B</p>
        </div>
        <div className="flex gap-2">
          <button onClick={clearAll} className="rounded-sm border-2 border-border bg-destructive/10 px-3 py-1.5 font-pixel text-[8px] text-destructive shadow-pixel-sm active:translate-y-0.5 active:shadow-none">RENSA</button>
          <button onClick={onExit} className="rounded-sm border-2 border-border bg-card px-3 py-1.5 font-pixel text-[9px] shadow-pixel-sm active:translate-y-0.5 active:shadow-none">KARTAN</button>
        </div>
      </div>
      {!key && <p className="font-pixel text-[9px] text-destructive px-1">Ange Gemini API-nyckel i Klassrumsläget först.</p>}
      <div className="pixel-panel rounded-sm bg-card overflow-hidden">
        {CONTACTS.map((c,i)=>{
          const last = convos[c.id as CID].at(-1);
          const preview = last ? (last.type==="image"?"📷 Bild":last.type==="audio"?"🎤 Röstmeddelande":last.text) : null;
          return (
            <div key={c.id}
              className={`w-full flex items-center gap-1 ${i<CONTACTS.length-1?"border-b-2 border-border":""} ${!key?"opacity-50":""}`}>
              <button type="button" onClick={()=>key&&openChat(c.id as CID)}
                className={`flex-1 min-w-0 flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/30 active:bg-secondary/50 transition-colors ${!key?"cursor-not-allowed":""}`}>
                <div className="w-11 h-11 border-2 border-border flex items-center justify-center font-pixel text-[9px] text-white shrink-0"
                  style={{background:c.color}}>{c.initials}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-pixel text-[10px]">{c.name}</span>
                    <span className="font-pixel text-[7px] text-muted-foreground">{ts()}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground truncate">{preview ?? c.sub}</p>
                    {unread[c.id as CID]>0 && (
                      <span className="font-pixel text-[7px] text-white bg-primary w-4 h-4 flex items-center justify-center shrink-0">{unread[c.id as CID]}</span>
                    )}
                  </div>
                </div>
              </button>
              <button type="button" aria-label={`Ring ${c.name}`} disabled={!key}
                onClick={()=>key&&setCalling(c.id as CID)}
                className="mr-3 h-9 w-9 shrink-0 border-2 border-border bg-accent font-pixel text-[10px] shadow-pixel-sm active:translate-y-0.5 active:shadow-none disabled:opacity-40">
                {(c as {isGroup?:boolean}).isGroup ? "👥" : "📞"}
              </button>

            </div>
          );

        })}
      </div>
    </div>
  );

  // ── Chat ────────────────────────────────────────────────────────────────────

  const isGroup = !!(contact as {isGroup?:boolean}).isGroup;

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      {overlay}
      <div className="pixel-panel flex items-center gap-3 rounded-sm bg-card p-3 mb-3 shrink-0">
        <button onClick={()=>setActive(null)} className="font-pixel text-[9px] text-muted-foreground mr-1">← BACK</button>
        <div className="w-9 h-9 border-2 border-border flex items-center justify-center font-pixel text-[8px] text-white shrink-0"
          style={{background:contact!.color}}>{contact!.initials}</div>
        <div className="flex-1 min-w-0">
          <p className="font-pixel text-[10px]">{contact!.name}</p>
          <p className="font-pixel text-[7px] text-muted-foreground">
            {typing ? "skriver..." : contact!.sub}
          </p>
        </div>
        <button type="button" aria-label={`Ring ${contact!.name}`} disabled={!key}
          onClick={()=>setCalling(active)}
          className="h-9 w-9 shrink-0 border-2 border-border bg-accent font-pixel text-[10px] shadow-pixel-sm active:translate-y-0.5 active:shadow-none disabled:opacity-40">
          {isGroup ? "👥" : "📞"}
        </button>

      </div>


      {err && <p className="font-pixel text-[8px] text-destructive mb-2 px-1">✗ {err}</p>}

      <div className="flex-1 overflow-y-auto px-2 py-2 border-2 border-border bg-secondary/20 mb-3">
        {convos[active!].length===0 && !typing && (
          <p className="font-pixel text-[8px] text-muted-foreground text-center py-4">Laddar konversation…</p>
        )}
        {convos[active!].map(msg=><Bubble key={msg.id} msg={msg} isGroup={isGroup}/>)}
        {typing && (
          <div className="flex justify-start mb-2">
            {isGroup && <div className="w-6 h-6 border-2 border-border bg-secondary mr-1 shrink-0"/>}
            <div className="border-2 border-border bg-card px-3 py-2 flex gap-1 items-center">
              {[0,150,300].map(d=><div key={d} className="w-1.5 h-1.5 bg-muted-foreground animate-bounce" style={{animationDelay:`${d}ms`}}/>)}
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      <div className="shrink-0">
        {isGroup && mentionOpts.length>0 && (
          <div className="mb-2 flex flex-wrap gap-1 border-2 border-border bg-card p-2">
            {mentionOpts.map(n=>(
              <button key={n} type="button" onClick={()=>applyMention(n)}
                className="border-2 border-border bg-secondary/40 px-2 py-1 font-pixel text-[8px] active:translate-y-0.5">@{n}</button>
            ))}
          </div>
        )}
        {att && (
          <div className="mb-2 flex items-center gap-2 border-2 border-border bg-card p-2">
            {att.kind==="image"
              ? <img src={att.dataUrl} alt="bifogad bild" className="h-10 w-10 border-2 border-border object-cover"/>
              : <span className="flex h-10 w-10 items-center justify-center border-2 border-border bg-accent text-[14px]">{att.kind==="audio"?"🎤":"📄"}</span>}
            <span className="flex-1 truncate text-sm">{att.name}</span>
            <button type="button" onClick={()=>setAtt(null)}
              className="border-2 border-border bg-destructive/10 px-2 py-1 font-pixel text-[8px] text-destructive">✗</button>
          </div>
        )}
        <div className="flex gap-2">
          <input ref={fileRef} type="file" hidden
            accept="image/*,audio/*,.pdf,.txt,.doc,.docx"
            onChange={e=>{ void pickFile(e.target.files?.[0]); e.target.value=""; }}/>
          <button type="button" aria-label="Bifoga fil" disabled={typing} onClick={()=>fileRef.current?.click()}
            className="rounded-sm border-2 border-border bg-card px-3 py-2 font-pixel text-[10px] shadow-pixel-sm active:translate-y-0.5 active:shadow-none disabled:opacity-40">📎</button>
          <button type="button" aria-label={recording?"Stoppa inspelning":"Spela in röstmeddelande"} disabled={typing}
            onClick={()=>void toggleRecord()}
            className={`rounded-sm border-2 border-border px-3 py-2 font-pixel text-[10px] shadow-pixel-sm active:translate-y-0.5 active:shadow-none disabled:opacity-40 ${recording?"bg-destructive text-white":"bg-card"}`}>
            {recording?"■":"🎤"}</button>
          <input value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ if(mentionOpts.length>0){ e.preventDefault(); applyMention(mentionOpts[0]); } else send(); } }}
            placeholder={isGroup?"Skriv… (@namn för att kalla ut någon)":"Skriv ett meddelande…"} spellCheck={false}
            className="flex-1 rounded-sm border-2 border-border bg-card px-3 py-2 text-sm outline-none focus:border-ring"/>
          <button onClick={send} disabled={(!input.trim()&&!att)||typing}
            className="rounded-sm border-2 border-border bg-accent px-4 py-2 font-pixel text-[9px] text-accent-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none disabled:opacity-40">
            SKICKA
          </button>
        </div>
      </div>
    </div>
  );
}
