import { useState, useRef, useEffect, useMemo } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────

const WA_GREEN = "#008069";
const WA_SENT = "#D9FDD3";
const WA_BG = "#ECE5DD";
const WA_TICK = "#53BDEB";
const WA_MUTED = "#667781";

const CONTACTS = [
  { id: "johnny", name: "Johnny", initials: "JO", color: "#FF6B6B", online: true },
  { id: "jacob",  name: "Jacob",  initials: "JA", color: "#4ECDC4", online: false, lastSeen: "today at 14:32" },
  { id: "sam",    name: "Sam",    initials: "SA", color: "#45B7D1", online: true },
  { id: "class",  name: "Klass 8B 🎒", initials: "8B", color: "#96CEB4", isGroup: true },
] as const;

type ContactId = "johnny" | "jacob" | "sam" | "class";

const PERSONAS: Record<string, string> = {
  johnny: `You're Johnny, 15, thinks he's the coolest kid in school. Big ego. Tons of abbrevs: ngl, fr, lowkey, no cap, tbh, rn, imo, bruh, obv, srs, istg, lol, omg. Max 1-2 short sentences. Never show weakness. Act unbothered. Casual English/Swedish mix. Don't use full stops. Don't write essays.`,
  jacob: `You're Jacob, 15, genuinely kind but a little sensitive — gets feelings hurt easily. Warm, caring, short messages 1-2 sentences. Sometimes overthinks what people mean. English/Swedish mix.`,
  sam: `You're Sam, 15, COMPLETELY obsessed with football. You bring football into EVERY reply no matter how unrelated. 1-2 sentences. Enthusiastic. English/Swedish mix.`,
};

const CLASS_CHARS: Record<string, string> = {
  Wilma: "dramatic, exaggerates everything",
  Ella: "always has the gossip",
  Liam: "tries to be funny, sometimes misses",
  Hugo: "football obsessed",
  Ida: "responsible one, mentions homework",
  Oscar: "class clown",
  Sofia: "friendly and positive",
  Klara: "sweet, asks questions",
  Erik: "sporty, very casual",
  Noah: "quiet, rarely texts",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeStr() {
  const d = new Date();
  return `${d.getHours()}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function nameColor(name = "") {
  const palette = ["#FF6B6B","#4ECDC4","#45B7D1","#96CEB4","#FFEAA7","#DDA0DD","#F39C12","#BB8FCE","#82E0AA","#F1948A"];
  let h = 0;
  for (const c of name) h = ((h << 5) - h + c.charCodeAt(0)) | 0;
  return palette[Math.abs(h) % palette.length];
}

async function callClaude(system: string | null, messages: {role:string;content:string}[], maxTokens = 150) {
  const body: Record<string, unknown> = {
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
    messages,
  };
  if (system) body.system = system;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return (data.content as {type:string;text:string}[]).filter(b => b.type === "text").map(b => b.text).join("");
}

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

// ── Sub-components ────────────────────────────────────────────────────────────

function Waveform({ seed }: { seed: number }) {
  const bars = useMemo(() => (
    Array.from({ length: 24 }, (_, i) => {
      const x = Math.sin((i + 1) * seed * 127.1 + 311.7) * 43758.5;
      return Math.floor(Math.abs(x - Math.floor(x)) * 22) + 3;
    })
  ), [seed]);
  return (
    <div className="flex items-center gap-px">
      {bars.map((h, i) => (
        <div key={i} style={{ width: 2, height: h, backgroundColor: WA_MUTED, borderRadius: 1 }} />
      ))}
    </div>
  );
}

function Bubble({ msg, isGroup }: { msg: Msg; isGroup: boolean }) {
  const sent = msg.role === "user";
  return (
    <div className={`flex ${sent ? "justify-end" : "justify-start"} mb-1`}>
      {isGroup && !sent && (
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold mr-1 mt-auto shrink-0"
          style={{ backgroundColor: nameColor(msg.sender) }}>
          {msg.sender?.[0]}
        </div>
      )}
      <div className="max-w-[78%]">
        {isGroup && !sent && (
          <p className="text-xs font-semibold px-1 mb-0.5" style={{ color: nameColor(msg.sender) }}>{msg.sender}</p>
        )}
        <div className="shadow-sm overflow-hidden"
          style={{
            backgroundColor: sent ? WA_SENT : "#fff",
            borderRadius: sent ? "8px 0px 8px 8px" : "0px 8px 8px 8px",
            padding: msg.type === "image" ? 3 : "6px 10px 4px",
          }}>
          {msg.type === "image" && (
            <img
              src={`https://picsum.photos/seed/${(msg.sender || "u") + msg.id}/220/160`}
              alt={msg.imageDesc || "photo"}
              className="rounded block"
              style={{ width: 220, height: 160, objectFit: "cover" }}
            />
          )}
          {msg.type === "audio" && (
            <div className="flex items-center gap-2 px-1 py-1" style={{ minWidth: 200 }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs shrink-0"
                style={{ backgroundColor: WA_GREEN }}>▶</div>
              <Waveform seed={msg.id} />
              <span className="text-xs shrink-0" style={{ color: WA_MUTED }}>{msg.duration || "0:08"}</span>
            </div>
          )}
          {msg.type === "text" && (
            <p className="text-sm leading-snug" style={{ color: "#111" }}>{msg.text}</p>
          )}
          {/* caption for image */}
          {msg.type === "image" && msg.text && (
            <p className="text-sm px-1 pt-1 pb-0.5" style={{ color: "#111" }}>{msg.text}</p>
          )}
          <div className="flex items-center justify-end gap-1 mt-0.5">
            <span className="text-[10px]" style={{ color: WA_MUTED }}>{msg.time}</span>
            {sent && <span className="text-[10px]" style={{ color: WA_TICK }}>✓✓</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex justify-start mb-1">
      <div className="shadow-sm rounded-tr-lg rounded-b-lg px-3 py-2 bg-white flex gap-1 items-center h-8">
        {[0, 150, 300].map(d => (
          <div key={d} className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function WhatsAppMode({ onExit }: { onExit: () => void }) {
  const [active, setActive] = useState<ContactId | null>(null);
  const [convos, setConvos] = useState<Record<ContactId, Msg[]>>({ johnny: [], jacob: [], sam: [], class: [] });
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [unread, setUnread] = useState<Record<ContactId, number>>({ johnny: 2, jacob: 1, sam: 0, class: 5 });
  const bottomRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  const nextId = () => ++idRef.current;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [convos, active, typing]);

  function addMsg(chatId: ContactId, msg: Omit<Msg, "id" | "time">) {
    setConvos(c => ({ ...c, [chatId]: [...c[chatId], { ...msg, id: nextId(), time: timeStr() }] }));
  }

  async function openChat(id: ContactId) {
    setActive(id);
    setUnread(u => ({ ...u, [id]: 0 }));

    // First open: generate offline messages
    if (convos[id].length === 0) {
      setTyping(true);
      try {
        if (id === "class") {
          await generateGroupOffline();
        } else {
          // 1-on-1: one opening message from the contact
          const opener = await callClaude(
            PERSONAS[id],
            [{ role: "user", content: "Send me a casual opening message like you just texted out of nowhere. One short sentence max." }],
            60
          );
          addMsg(id, { role: "contact", text: opener.trim(), type: "text" });
        }
      } catch { /* silent */ }
      setTyping(false);
    }
  }

  async function generateGroupOffline() {
    const charList = Object.entries(CLASS_CHARS).map(([k, v]) => `${k}: ${v}`).join("; ");
    const raw = await callClaude(null, [{
      role: "user",
      content: `Simulate a Swedish WhatsApp class group chat (Klass 8B, 15-year-olds). Generate 5-8 messages that happened while the user was offline — feels like a real ongoing chat. Characters: ${charList}. 
Rules: very short (3-12 words each), no emoji spam, mix Swedish/English, realistic teen topics (school, weekend, drama, football, memes). Occasionally one message can be an image or voice note.
Return ONLY JSON array: [{"name":"Wilma","text":"omg did anyone do the homework","type":"text"},{"name":"Hugo","text":"","type":"image","imageDesc":"training today was insane"},{"name":"Liam","text":"","type":"audio","duration":"0:14"}]`
    }], 500);
    const arr = JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1)) as Array<{name:string;text:string;type:string;imageDesc?:string;duration?:string}>;
    for (const m of arr) {
      addMsg("class", {
        role: "contact",
        sender: m.name,
        text: m.text || m.imageDesc || "",
        type: (m.type as Msg["type"]) || "text",
        imageDesc: m.imageDesc,
        duration: m.duration,
      });
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || typing || !active) return;
    setInput("");
    addMsg(active, { role: "user", text, type: "text" });
    setTyping(true);
    try {
      if (active === "class") {
        const recent = convos.class.slice(-5).map(m => `${m.sender || "You"}: ${m.text}`).join("\n");
        const charList = Object.entries(CLASS_CHARS).map(([k, v]) => `${k}: ${v}`).join("; ");
        const raw = await callClaude(null, [{
          role: "user",
          content: `Swedish class WhatsApp group. Recent:\n${recent}\nUser sent: "${text}"\nGenerate 2-4 replies from classmates. Characters: ${charList}. Short (3-12 words). No emoji spam. Can react to user or sidetrack. Occasionally image/audio.
Return ONLY JSON: [{"name":"Ella","text":"omg fr","type":"text"}]`
        }], 300);
        const arr = JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1)) as Array<{name:string;text:string;type:string;imageDesc?:string;duration?:string}>;
        for (const m of arr) {
          await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
          addMsg("class", {
            role: "contact",
            sender: m.name,
            text: m.text || m.imageDesc || "",
            type: (m.type as Msg["type"]) || "text",
            imageDesc: m.imageDesc,
            duration: m.duration,
          });
        }
      } else {
        const history = convos[active].slice(-10).map(m => ({
          role: m.role === "user" ? "user" : "assistant" as const,
          content: m.text,
        }));
        history.push({ role: "user", content: text });
        const reply = await callClaude(PERSONAS[active], history, 120);
        addMsg(active, { role: "contact", text: reply.trim(), type: "text" });
      }
    } catch { /* silent */ }
    setTyping(false);
  }

  const contact = CONTACTS.find(c => c.id === active);
  const msgs = active ? convos[active] : [];
  const lastMsg: Record<ContactId, string> = {
    johnny: convos.johnny.at(-1)?.text || "Hey",
    jacob: convos.jacob.at(-1)?.text || "Hey, how are you?",
    sam: convos.sam.at(-1)?.text || "bro did you watch the game",
    class: convos.class.at(-1)?.text || "anyone up",
  };

  // ── Chat list ──────────────────────────────────────────────────────────────

  if (!active) return (
    <div className="flex flex-col h-full bg-white" style={{ fontFamily: "system-ui, -apple-system, sans-serif", maxWidth: 480, margin: "0 auto" }}>
      <div className="flex items-center justify-between px-4 py-3 text-white" style={{ backgroundColor: WA_GREEN }}>
        <button onClick={onExit} className="text-white opacity-80 mr-2 text-lg">←</button>
        <span className="font-bold text-base flex-1">WhatsApp</span>
        <span className="text-white opacity-70 text-sm">Svenska Quest</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {CONTACTS.map(c => (
          <button key={c.id} onClick={() => openChat(c.id as ContactId)}
            className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-100 text-left transition-colors hover:bg-gray-50 active:bg-gray-100">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
              style={{ backgroundColor: c.color }}>
              {c.initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="font-medium text-sm text-gray-900">{c.name}</span>
                <span className="text-xs" style={{ color: WA_MUTED }}>{timeStr()}</span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm truncate" style={{ color: WA_MUTED, maxWidth: "80%" }}>
                  {lastMsg[c.id as ContactId]}
                </p>
                {unread[c.id as ContactId] > 0 && (
                  <span className="text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0"
                    style={{ backgroundColor: WA_GREEN }}>
                    {unread[c.id as ContactId]}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  // ── Chat view ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: "system-ui, -apple-system, sans-serif", maxWidth: 480, margin: "0 auto" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2 text-white shrink-0" style={{ backgroundColor: WA_GREEN }}>
        <button onClick={() => setActive(null)} className="text-white text-xl mr-1 shrink-0">←</button>
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
          style={{ backgroundColor: contact!.color }}>
          {contact!.initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-none truncate">{contact!.name}</p>
          <p className="text-xs opacity-80 mt-0.5">
            {typing
              ? "typing..."
              : (contact as {isGroup?:boolean}).isGroup
                ? "22 members"
                : (contact as {online?:boolean}).online
                  ? "online"
                  : `last seen ${(contact as {lastSeen?:string}).lastSeen || "recently"}`
            }
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3" style={{ backgroundColor: WA_BG }}>
        {msgs.length === 0 && !typing && (
          <div className="text-center py-8">
            <div className="inline-block bg-amber-50 text-amber-800 text-xs px-3 py-1 rounded-full border border-amber-200">
              Idag
            </div>
          </div>
        )}
        {msgs.map(msg => <Bubble key={msg.id} msg={msg} isGroup={!!(contact as {isGroup?:boolean}).isGroup} />)}
        {typing && <TypingDots />}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="flex items-center gap-2 px-3 py-2 shrink-0" style={{ backgroundColor: WA_BG }}>
        <div className="flex-1 flex items-center rounded-3xl px-4 py-2 bg-white shadow-sm">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Message"
            className="flex-1 outline-none text-sm bg-transparent text-gray-900"
          />
        </div>
        <button onClick={send} disabled={!input.trim() || typing}
          className="w-11 h-11 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm transition-opacity disabled:opacity-40"
          style={{ backgroundColor: WA_GREEN }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
