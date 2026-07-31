import { useState, useRef, useEffect, useMemo } from "react";

// ── Config ────────────────────────────────────────────────────────────────────

const CONTACTS = [
  { id: "johnny", name: "Johnny",      initials: "JO", color: "#c0392b", online: true,  tagline: "ngl bro ur kinda cooked fr" },
  { id: "jacob",  name: "Jacob",       initials: "JA", color: "#16a085", online: false, tagline: "hey!! how are you doing :)" },
  { id: "sam",    name: "Sam",         initials: "SA", color: "#2980b9", online: true,  tagline: "bro did u watch the game last night" },
  { id: "class",  name: "Klass 8B 🎒", initials: "8B", color: "#8e44ad", online: null,  tagline: "Wilma: omg did anyone do the homework" },
] as const;

type CID = "johnny" | "jacob" | "sam" | "class";

const PERSONAS: Record<string, string> = {
  johnny: `You are Johnny, 15yo, thinks he's the coolest kid in school. Huge ego. Use tons of abbrevs: ngl, fr, lowkey, no cap, tbh, rn, imo, bruh, obv, srs, istg, lol, smh. Max 1-2 short sentences. Never show weakness or vulnerability. Act unbothered about everything. Mix English and Swedish casually. No full stops. Never write more than 2 short sentences.`,
  jacob:  `You are Jacob, 15yo. You're genuinely kind and sweet but a little sensitive — you can get your feelings hurt easily. Warm and caring. Short messages 1-2 sentences max. Sometimes you overthink what people mean. Friendly. Mix English/Swedish casually.`,
  sam:    `You are Sam, 15yo. You are COMPLETELY obsessed with football (soccer). You bring football into absolutely EVERY reply no matter how unrelated the topic is. If someone talks about school — football. Food — football. Literally anything — football. 1-2 sentences. Enthusiastic. Mix English/Swedish.`,
};

const CLASS_CHARS: Record<string, string> = {
  Wilma: "dramatic, exaggerates everything",
  Ella:  "always has the gossip first",
  Liam:  "tries to be funny, sometimes fails",
  Hugo:  "obsessed with football",
  Ida:   "responsible, mentions homework/school",
  Oscar: "class clown",
  Sofia: "friendly and positive",
  Klara: "sweet, asks questions",
  Erik:  "sporty, very casual",
  Noah:  "lurker, rarely texts",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface Msg {
  id: number;
  role: "user" | "contact";
  text: string;
  type: "text" | "image" | "audio";
  time: string;
  sender?: string;
  imageDesc?: string;
  duration?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

let _id = 0;
const nextId = () => ++_id;
const timeStr = () => { const d = new Date(); return `${d.getHours()}:${d.getMinutes().toString().padStart(2,"0")}`; };

function nameColor(name = "") {
  const p = ["#c0392b","#16a085","#2980b9","#8e44ad","#e67e22","#27ae60","#2c3e50","#d35400"];
  let h = 0; for (const c of name) h = ((h << 5) - h + c.charCodeAt(0)) | 0;
  return p[Math.abs(h) % p.length];
}

async function ai(system: string | null, messages: {role:string;content:string}[], max = 150) {
  const body: Record<string, unknown> = { model: "claude-sonnet-4-6", max_tokens: max, messages };
  if (system) body.system = system;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const d = await r.json();
  return (d.content as {type:string;text:string}[]).filter(b=>b.type==="text").map(b=>b.text).join("");
}

// ── Waveform ──────────────────────────────────────────────────────────────────

function Waveform({ seed }: { seed: number }) {
  const bars = useMemo(() => Array.from({length:20},(_,i)=>{
    const x = Math.sin((i+1)*seed*127.1+311.7)*43758.5;
    return Math.floor(Math.abs(x-Math.floor(x))*18)+3;
  }), [seed]);
  return (
    <div className="flex items-center gap-px">
      {bars.map((h,i)=><div key={i} style={{width:2,height:h,backgroundColor:"var(--muted-foreground)",borderRadius:0}}/>)}
    </div>
  );
}

// ── Bubble ────────────────────────────────────────────────────────────────────

function Bubble({ msg, isGroup }: { msg: Msg; isGroup: boolean }) {
  const sent = msg.role === "user";
  return (
    <div className={`flex ${sent?"justify-end":"justify-start"} mb-2`}>
      {isGroup && !sent && (
        <div className="w-6 h-6 flex items-center justify-center text-white font-pixel text-[8px] mr-1 mt-auto shrink-0 border-2 border-border"
          style={{backgroundColor: nameColor(msg.sender)}}>
          {msg.sender?.[0]}
        </div>
      )}
      <div style={{maxWidth:"76%"}}>
        {isGroup && !sent && (
          <p className="font-pixel text-[8px] px-1 mb-0.5" style={{color: nameColor(msg.sender)}}>{msg.sender}</p>
        )}
        <div className="border-2 border-border shadow-pixel-sm"
          style={{
            backgroundColor: sent ? "var(--accent)" : "var(--card)",
            padding: msg.type==="image" ? 2 : "6px 10px 4px",
          }}>
          {msg.type === "image" && (
            <img src={`https://picsum.photos/seed/${(msg.sender||"u")+msg.id}/200/140`}
              alt={msg.imageDesc||"photo"} style={{width:200,height:140,objectFit:"cover",display:"block"}} />
          )}
          {msg.type === "audio" && (
            <div className="flex items-center gap-2 px-2 py-1" style={{minWidth:180}}>
              <div className="w-7 h-7 border-2 border-border flex items-center justify-center font-pixel text-[8px] bg-accent text-accent-foreground shrink-0">▶</div>
              <Waveform seed={msg.id}/>
              <span className="font-pixel text-[8px] text-muted-foreground shrink-0">{msg.duration||"0:08"}</span>
            </div>
          )}
          {msg.type === "text" && (
            <p className="text-sm leading-snug">{msg.text}</p>
          )}
          {msg.type === "image" && msg.text && (
            <p className="text-sm px-1 pt-1">{msg.text}</p>
          )}
          <div className={`flex items-center gap-1 mt-0.5 ${sent?"justify-end":"justify-end"}`}>
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
  const [active, setActive] = useState<CID|null>(null);
  const [convos, setConvos] = useState<Record<CID,Msg[]>>({johnny:[],jacob:[],sam:[],class:[]});
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [unread, setUnread] = useState<Record<CID,number>>({johnny:2,jacob:1,sam:0,class:5});
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[convos,active,typing]);

  function addMsg(cid: CID, msg: Omit<Msg,"id"|"time">) {
    setConvos(c=>({...c,[cid]:[...c[cid],{...msg,id:nextId(),time:timeStr()}]}));
  }

  function clearAll() {
    setConvos({johnny:[],jacob:[],sam:[],class:[]});
    setUnread({johnny:0,jacob:0,sam:0,class:0});
    setActive(null);
  }

  async function openChat(id: CID) {
    setActive(id);
    setUnread(u=>({...u,[id]:0}));
    if (convos[id].length > 0) return;
    setTyping(true);
    try {
      if (id === "class") {
        const chars = Object.entries(CLASS_CHARS).map(([k,v])=>`${k}: ${v}`).join("; ");
        const raw = await ai(null,[{role:"user",content:
          `Simulate a Swedish WhatsApp class group chat (Klass 8B, 15-year-olds). Generate 5-7 messages the user missed while offline. Characters: ${chars}. Rules: very short (3-12 words), no emoji spam, mix Swedish/English, realistic teen topics (school drama, weekend, homework, football, random stuff). Sometimes one is an image or voice note. Return ONLY JSON: [{"name":"Wilma","text":"omg guys","type":"text"},{"name":"Hugo","text":"","type":"image","imageDesc":"training was insane today"},{"name":"Liam","text":"","type":"audio","duration":"0:11"}]`
        }], 500);
        const arr = JSON.parse(raw.slice(raw.indexOf("["),raw.lastIndexOf("]")+1)) as Array<{name:string;text:string;type:string;imageDesc?:string;duration?:string}>;
        arr.forEach(m => addMsg("class",{role:"contact",sender:m.name,text:m.text||m.imageDesc||"",type:(m.type as Msg["type"])||"text",imageDesc:m.imageDesc,duration:m.duration}));
      } else {
        const reply = await ai(PERSONAS[id],[{role:"user",content:"Send one casual opening text like you just randomly texted me. Max 1 short sentence."}], 60);
        addMsg(id,{role:"contact",text:reply.trim(),type:"text"});
      }
    } catch {}
    setTyping(false);
  }

  async function send() {
    const text = input.trim();
    if (!text || typing || !active) return;
    setInput("");
    addMsg(active,{role:"user",text,type:"text"});
    setTyping(true);
    try {
      if (active === "class") {
        const recent = convos.class.slice(-5).map(m=>`${m.sender||"You"}: ${m.text}`).join("\n");
        const chars = Object.entries(CLASS_CHARS).map(([k,v])=>`${k}: ${v}`).join("; ");
        const raw = await ai(null,[{role:"user",content:
          `Swedish class WhatsApp. Recent:\n${recent}\nUser just sent: "${text}"\nGenerate 2-4 realistic replies. Characters: ${chars}. Short (3-12 words). No emoji spam. Can react to user or sidetrack. Mix Swedish/English. Occasionally image/audio. Return ONLY JSON: [{"name":"Ella","text":"omg fr","type":"text"}]`
        }], 300);
        const arr = JSON.parse(raw.slice(raw.indexOf("["),raw.lastIndexOf("]")+1)) as Array<{name:string;text:string;type:string;imageDesc?:string;duration?:string}>;
        for (const m of arr) {
          await new Promise(r=>setTimeout(r,400+Math.random()*800));
          addMsg("class",{role:"contact",sender:m.name,text:m.text||m.imageDesc||"",type:(m.type as Msg["type"])||"text",imageDesc:m.imageDesc,duration:m.duration});
        }
      } else {
        const history = convos[active].slice(-10).map(m=>({
          role: (m.role==="user"?"user":"assistant") as "user"|"assistant",
          content: m.text,
        }));
        history.push({role:"user",content:text});
        const reply = await ai(PERSONAS[active], history, 100);
        addMsg(active,{role:"contact",text:reply.trim(),type:"text"});
      }
    } catch {}
    setTyping(false);
  }

  const contact = CONTACTS.find(c=>c.id===active);
  const msgs = active ? convos[active] : [];

  // ── List ─────────────────────────────────────────────────────────────────────

  if (!active) return (
    <div className="flex flex-col gap-4">
      <div className="pixel-panel flex items-center justify-between rounded-sm bg-card p-4">
        <div>
          <p className="font-pixel text-[11px] text-primary">WHATSAPP</p>
          <p className="text-sm text-muted-foreground">Johnny · Jacob · Sam · Klass 8B</p>
        </div>
        <div className="flex gap-2">
          <button onClick={clearAll}
            className="rounded-sm border-2 border-border bg-destructive/10 px-3 py-1.5 font-pixel text-[8px] text-destructive shadow-pixel-sm active:translate-y-0.5 active:shadow-none">
            RENSA
          </button>
          <button onClick={onExit}
            className="rounded-sm border-2 border-border bg-card px-3 py-1.5 font-pixel text-[9px] shadow-pixel-sm active:translate-y-0.5 active:shadow-none">
            KARTAN
          </button>
        </div>
      </div>

      <div className="pixel-panel rounded-sm bg-card overflow-hidden">
        {CONTACTS.map((c,i) => {
          const lastMsg = convos[c.id as CID].at(-1);
          const preview = lastMsg
            ? (lastMsg.type==="image" ? "📷 Bild" : lastMsg.type==="audio" ? "🎤 Röstmeddelande" : lastMsg.text)
            : c.tagline;
          return (
            <button key={c.id} onClick={()=>openChat(c.id as CID)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/30 active:bg-secondary/50 transition-colors ${i<CONTACTS.length-1?"border-b-2 border-border":""}`}>
              <div className="w-11 h-11 border-2 border-border flex items-center justify-center font-pixel text-[9px] text-white shrink-0"
                style={{backgroundColor: c.color}}>
                {c.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-pixel text-[10px]">{c.name}</span>
                  <span className="font-pixel text-[7px] text-muted-foreground">{timeStr()}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground truncate">{preview}</p>
                  {unread[c.id as CID] > 0 && (
                    <span className="font-pixel text-[7px] text-white bg-primary w-4 h-4 flex items-center justify-center shrink-0">
                      {unread[c.id as CID]}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  // ── Chat ──────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="pixel-panel flex items-center gap-3 rounded-sm bg-card p-3 mb-3 shrink-0">
        <button onClick={()=>setActive(null)} className="font-pixel text-[9px] text-muted-foreground mr-1">← BACK</button>
        <div className="w-9 h-9 border-2 border-border flex items-center justify-center font-pixel text-[8px] text-white shrink-0"
          style={{backgroundColor: contact!.color}}>
          {contact!.initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-pixel text-[10px]">{contact!.name}</p>
          <p className="font-pixel text-[7px] text-muted-foreground">
            {typing ? "schrijver..." : (contact as {online?:boolean|null}).online===true ? "online" : (contact as {isGroup?:boolean}).isGroup ? "22 members" : `last seen ${(contact as {lastSeen?:string}).lastSeen||"recently"}`}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-1 py-2 border-2 border-border bg-secondary/20 mb-3">
        {msgs.map(msg=><Bubble key={msg.id} msg={msg} isGroup={!!(contact as {isGroup?:boolean}).isGroup}/>)}
        {typing && (
          <div className="flex justify-start mb-2">
            {(contact as {isGroup?:boolean}).isGroup && <div className="w-6 h-6 border-2 border-border bg-secondary mr-1"/>}
            <div className="border-2 border-border bg-card px-3 py-2 flex gap-1 items-center">
              {[0,150,300].map(d=>(
                <div key={d} className="w-1.5 h-1.5 bg-muted-foreground animate-bounce" style={{animationDelay:`${d}ms`}}/>
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div className="flex gap-2 shrink-0">
        <input value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()}
          placeholder="Skriv ett meddelande…"
          spellCheck={false}
          className="flex-1 rounded-sm border-2 border-border bg-card px-3 py-2 text-sm outline-none focus:border-ring"/>
        <button onClick={send} disabled={!input.trim()||typing}
          className="rounded-sm border-2 border-border bg-accent px-4 py-2 font-pixel text-[9px] text-accent-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none disabled:opacity-40">
          SKICKA
        </button>
      </div>
    </div>
  );
}
