import { useState, useRef, useEffect, useMemo } from "react";
import { CallOverlay } from "./CallOverlay";


// ── Gemini (same as rest of app) ──────────────────────────────────────────────

const MODEL = "gemini-3.1-flash-lite";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const KEY_STORE = "svenska-quest-classroom-gemini-key";

function loadKey() { try { return localStorage.getItem(KEY_STORE) ?? ""; } catch { return ""; } }

interface GeminiTurn { role: "user" | "model"; text: string }

async function gemini(key: string, turns: GeminiTurn[], system?: string, maxTokens = 200): Promise<string> {
  const body: Record<string, unknown> = {
    contents: turns.map(t => ({ role: t.role, parts: [{ text: t.text }] })),
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

const CONTACTS = [
  { id: "johnny", name: "Johnny",      initials: "JO", color: "#c0392b", online: true,  sub: "online" },
  { id: "jacob",  name: "Jacob",       initials: "JA", color: "#16a085", online: false, sub: "last seen today at 14:32" },
  { id: "sam",    name: "Sam",         initials: "SA", color: "#2980b9", online: true,  sub: "online" },
  { id: "class",  name: "Klass 8B 🎒", initials: "8B", color: "#8e44ad", online: null,  sub: "22 members", isGroup: true },
] as const;

type CID = "johnny" | "jacob" | "sam" | "class";

const PERSONAS: Record<string, string> = {
  johnny: `You are Johnny, 15yo Swedish student. You think you're the coolest kid in school. Huge ego. Use lots of abbrevs mixed into Swedish: ngl, fr, lowkey, no cap, tbh, bruh, lol. Max 1-2 very short sentences. Never show weakness. Act unbothered. No full stops at end. Speak Swedish — full sentences in Swedish with English slang words mixed in naturally like Swedish teens do.`,
  jacob:  `You are Jacob, 15yo Swedish student. Kind and sweet but a little sensitive — gets feelings hurt easily. Warm, caring. Short messages 1-2 sentences. Sometimes overthinks. Speak Swedish. You can mix in the odd English word naturally like Swedish teens do but full sentences are Swedish.`,
  sam:    `You are Sam, 15yo Swedish student. COMPLETELY obsessed with football (soccer). Bring football into every single reply no matter how unrelated. 1-2 sentences. Enthusiastic. Speak Swedish. Mix in occasional English football terms naturally.`,
};

const CLASS_CHARS = `Alex: quiet, rarely texts, strict parents, soft-hearted; Hugo: football obsessed, best friends with Sam; Viggo: the user's rival/enemy, rarely joins unless there is drama or he is directly involved, but whenever he does write he is ALWAYS mean, mocking and hostile toward the user specifically (never nice, throws sarcastic insults and put-downs at the user, still friendly-ish to others); Sam: totally obsessed with football, enthusiastic; Jacob: kind and sweet but sensitive, overthinks; Johnny: popular, huge ego, cool, uses slang like ngl/fr/lowkey/no cap, never shows weakness; Emma: class representative, responsible, reminds about homework; Ella: always has the latest gossip; Noah: lurker, mostly short reactions; Lucas: funny and sarcastic, teases everyone; William: tech nerd into games, PCs and AI; Oscar: class clown, memes and jokes; Leo: relaxed, does not care about drama; Filip: competitive, tries to win every discussion; Elias: friendly, tries to stop arguments; Isak: dry humor, very short replies; Nils: loves cars and motorcycles; Maja: loud, energetic, starts conversations; Olivia: popular but kind, voice of reason; Sofia: friendly and supportive; Klara: curious, asks lots of questions`;

// ── Types ─────────────────────────────────────────────────────────────────────

interface Msg {
  id: number; role: "user" | "contact"; text: string;
  type: "text" | "image" | "audio"; time: string;
  sender?: string; imageDesc?: string; duration?: string;
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
        body: JSON.stringify({ text }),
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
    const text = msg.text || "Hej!";
    setPlaying(true);

    const voice = "speechSynthesis" in window ? pickSwedishVoice() : null;
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
            <img src={`https://picsum.photos/seed/${(msg.sender||"u")+msg.id}/200/140`}
              alt={msg.imageDesc||"photo"} style={{width:200,height:140,objectFit:"cover",display:"block"}}/>
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
          {msg.type==="text" && <p className="text-sm leading-snug">{msg.text}</p>}
          {msg.type==="image" && msg.text && <p className="text-sm px-1 pt-1">{msg.text}</p>}
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
  const [convos, setConvos] = useState<Record<CID,Msg[]>>({johnny:[],jacob:[],sam:[],class:[]});
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [err, setErr] = useState("");
  const [unread, setUnread] = useState<Record<CID,number>>({johnny:2,jacob:1,sam:0,class:5});
  const bottomRef = useRef<HTMLDivElement>(null);
  const callContact = CONTACTS.find(c=>c.id===calling);


  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[convos,active,typing]);

  function add(cid: CID, msg: Omit<Msg,"id"|"time">) {
    setConvos(c=>({...c,[cid]:[...c[cid],{...msg,id:nid(),time:ts()}]}));
  }

  function clearAll() {
    setConvos({johnny:[],jacob:[],sam:[],class:[]});
    setUnread({johnny:0,jacob:0,sam:0,class:0});
    setActive(null);
  }

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

  async function send() {
    const text = input.trim();
    if (!text || typing || !active) return;
    setInput(""); setErr("");
    add(active, {role:"user", text, type:"text"});
    setTyping(true);
    try {
      if (active === "class") {
        const recent = convos.class.slice(-5).map(m=>`${m.sender||"Du"}: ${m.text}`).join("\n");
        const raw = await gemini(key, [{
          role: "user",
          text: `Swedish class WhatsApp group. Recent messages:\n${recent}\nUser just sent: "${text}"\nGenerate 2-4 realistic short replies from classmates. Characters: ${CLASS_CHARS}. Rules: very short (3-12 words), no emoji spam, mix Swedish/English, can react to user or sidetrack, occasionally image or audio. For "audio", "text" MUST be the spoken Swedish words of the voice note. Return ONLY JSON array: [{"name":"Ella","text":"omg fr","type":"text"}]`
        }], undefined, 300);
        const arr = parseArr<{name:string;text:string;type:string;imageDesc?:string;duration?:string}>(raw);
        for (const m of arr) {
          await new Promise(r=>setTimeout(r,400+Math.random()*900));
          add("class",{role:"contact",sender:m.name,text:m.text||m.imageDesc||"",type:(m.type as Msg["type"])||"text",imageDesc:m.imageDesc,duration:m.duration});
        }
      } else {
        const history: GeminiTurn[] = convos[active].slice(-10).map(m=>({
          role: m.role==="user" ? "user" : "model" as "user"|"model",
          text: m.text,
        }));
        history.push({role:"user", text});
        const reply = await gemini(key, history, PERSONAS[active], 100);
        add(active, {role:"contact", text:reply.trim(), type:"text"});
      }
    } catch(e) { setErr(e instanceof Error ? e.message : "Fel"); }
    setTyping(false);
  }

  const contact = CONTACTS.find(c=>c.id===active);

  const overlay = calling && callContact ? (
    <CallOverlay
      contact={{name:callContact.name, initials:callContact.initials, color:callContact.color}}
      persona={PERSONAS[calling]}
      apiKey={key}
      onEnd={()=>setCalling(null)}
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
              {!(c as {isGroup?:boolean}).isGroup && (
                <button type="button" aria-label={`Ring ${c.name}`} disabled={!key}
                  onClick={()=>key&&setCalling(c.id as CID)}
                  className="mr-3 h-9 w-9 shrink-0 border-2 border-border bg-accent font-pixel text-[10px] shadow-pixel-sm active:translate-y-0.5 active:shadow-none disabled:opacity-40">
                  📞
                </button>
              )}
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
        {!isGroup && (
          <button type="button" aria-label={`Ring ${contact!.name}`} disabled={!key}
            onClick={()=>setCalling(active)}
            className="h-9 w-9 shrink-0 border-2 border-border bg-accent font-pixel text-[10px] shadow-pixel-sm active:translate-y-0.5 active:shadow-none disabled:opacity-40">
            📞
          </button>
        )}
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
        <div className="flex gap-2">
          <input value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ if(mentionOpts.length>0){ e.preventDefault(); applyMention(mentionOpts[0]); } else send(); } }}
            placeholder={isGroup?"Skriv… (@namn för att kalla ut någon)":"Skriv ett meddelande…"} spellCheck={false}
            className="flex-1 rounded-sm border-2 border-border bg-card px-3 py-2 text-sm outline-none focus:border-ring"/>
          <button onClick={send} disabled={!input.trim()||typing}
            className="rounded-sm border-2 border-border bg-accent px-4 py-2 font-pixel text-[9px] text-accent-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none disabled:opacity-40">
            SKICKA
          </button>
        </div>
      </div>
    </div>
  );
}
