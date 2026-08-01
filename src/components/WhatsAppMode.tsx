import { useState, useRef, useEffect, useMemo } from "react";

// ── Gemini ────────────────────────────────────────────────────────────────────

const MODEL = "gemini-3.1-flash-lite";
const API  = "https://generativelanguage.googleapis.com/v1beta/models";
const KEY_STORE = "svenska-quest-classroom-gemini-key";
const loadKey = () => { try { return localStorage.getItem(KEY_STORE)??""; } catch { return ""; } };

type GPart = { text?: string; inlineData?: { mimeType: string; data: string } };
type GTurn = { role:"user"|"model"; parts: GPart[] };
async function gemini(key:string, turns:GTurn[], system?:string, max=200) {
  const body:Record<string,unknown> = {
    contents: turns.map(t=>({role:t.role,parts:t.parts})),
    generationConfig:{temperature:0.85,maxOutputTokens:max},
  };
  if(system) body.system_instruction={parts:[{text:system}]};
  const r = await fetch(`${API}/${MODEL}:generateContent?key=${key}`,{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),
  });
  if(!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  const t = d.candidates?.[0]?.content?.parts?.[0]?.text;
  if(!t) throw new Error("No response");
  return t as string;
}
function parseArr<T>(raw:string):T[] {
  const s=raw.indexOf("["),e=raw.lastIndexOf("]");
  if(s<0) return [];
  try{ return JSON.parse(raw.slice(s,e+1)); }catch{ return []; }
}

// ── Image Generation ──────────────────────────────────────────────────────────

// Generate a relevant image from a text description using pollinations.ai
function generateImageUrl(prompt: string, seed: number = 42): string {
  const encoded = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encoded}?seed=${seed}&width=400&height=280&nologo=true`;
}

// ── Contacts ──────────────────────────────────────────────────────────────────

type CID = "johnny"|"jacob"|"sam"|"class";

const CONTACTS = [
  {id:"johnny" as CID, name:"Johnny",      init:"JO", color:"#c0392b", sub:"online",                isGroup:false},
  {id:"jacob"  as CID, name:"Jacob",       init:"JA", color:"#16a085", sub:"sedd idag 14:32",        isGroup:false},
  {id:"sam"    as CID, name:"Sam",         init:"SA", color:"#2980b9", sub:"online",                isGroup:false},
  {id:"class"  as CID, name:"Klass 8B 🎒", init:"8B", color:"#8e44ad", sub:"22 members",             isGroup:true},
];

const PERSONA:Record<string,string> = {
  johnny:`Du är Johnny, 15 år, tror du är skolans coolaste. Stort ego. Använd förkortningar: ngl, fr, lowkey, no cap, tbh, bruh, lol. Max 1-2 korta meningar. Visa aldrig svaghet. Prata svenska med lite engelska slang inblandat.`,
  jacob:`Du är Jacob, 15 år, snäll och omtänksam men lite känslig. Varma korta svar 1-2 meningar. Prata svenska med enstaka engelska ord.`,
  sam:`Du är Sam, 15 år, HELT besatt av fotboll. Ta in fotboll i VARJE svar oavsett ämne. 1-2 meningar. Prata svenska med engelska fotbollstermer.`,
};

const CALL_PERSONA:Record<string,string> = {
  johnny:`Du är Johnny, 15 år, i ett telefonsamtal. Cool och avslappnad. SUPER korta svar, max 1 mening. Svenska med lite slang. Prata som om du faktiskt ringer.`,
  jacob:`Du är Jacob, 15 år, i ett telefonsamtal. Varm och omtänksam. Korta svar max 1 mening. Lite nervös att ringa. Svenska.`,
  sam:`Du är Sam, 15 år, i ett telefonsamtal. Besatt av fotboll — nämn det. Max 1 mening. Svenska.`,
  class:`Du är en slumpmässig klasskamrat (välj: Wilma, Ella, Liam, Hugo, Ida) i ett gruppsamtal. Kort 1 mening. Svenska.`,
};

const CLASS_CHARS = `Wilma: dramatisk; Ella: har alltid skvallret; Liam: försöker vara rolig; Hugo: fotbollsbesatt; Ida: ansvarsfull nämner läxor; Oscar: klassens clown; Sofia: vänlig positiv; Klara: söt ställer frågor; Erik: sportig avslappnad; Noah: lurkar svarar sällan`;

// ── Types ─────────────────────────────────────────────────────────────────────

interface Msg {
  id:number; role:"user"|"contact"; text:string;
  type:"text"|"image"|"audio"; time:string;
  sender?:string;
  imageSrc?:string;
  audioSrc?:string;
  voiceText?:string;
  imageDesc?:string;
  duration?:string;
}

type View = {screen:"list"}|{screen:"chat";cid:CID}|{screen:"call";cid:CID;status:"ringing"|"connected";callerId:string};

let _id=0; const nid=()=>++_id;
const ts=()=>{const d=new Date();return`${d.getHours()}:${d.getMinutes().toString().padStart(2,"0")}`;};
function nameColor(n=""){
  const p=["#c0392b","#16a085","#2980b9","#8e44ad","#e67e22","#27ae60","#d35400","#2c3e50"];
  let h=0; for(const c of n) h=((h<<5)-h+c.charCodeAt(0))|0;
  return p[Math.abs(h)%p.length];
}
function speak(text:string, onEnd?:()=>void){
  window.speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text);
  u.lang="sv-SE"; u.rate=1.0;
  const voices=window.speechSynthesis.getVoices();
  const sv=voices.find(v=>v.lang.startsWith("sv"));
  if(sv) u.voice=sv;
  if(onEnd) u.onend=onEnd;
  window.speechSynthesis.speak(u);
}

// ── Waveform ──────────────────────────────────────────────────────────────────

function Waveform({seed}:{seed:number}){
  const bars=useMemo(()=>Array.from({length:20},(_,i)=>{
    const x=Math.sin((i+1)*seed*127.1+311.7)*43758.5;
    return Math.floor(Math.abs(x-Math.floor(x))*18)+3;
  }),[seed]);
  return <div className="flex items-center gap-px">{bars.map((h,i)=><div key={i} style={{width:2,height:h,background:"var(--muted-foreground)"}}/>)}</div>;
}

// ── Bubble ────────────────────────────────────────────────────────────────────

function Bubble({msg,isGroup}:{msg:Msg;isGroup:boolean}){
  const sent=msg.role==="user";
  const [playing,setPlaying]=useState(false);

  function playAudio(){
    if(!msg.voiceText)return;
    if(playing){window.speechSynthesis.cancel();setPlaying(false);return;}
    setPlaying(true);
    speak(msg.voiceText,()=>setPlaying(false));
  }

  return(
    <div className={`flex ${sent?"justify-end":"justify-start"} mb-2`}>
      {isGroup&&!sent&&(
        <div className="w-6 h-6 border-2 border-border flex items-center justify-center font-pixel text-[8px] text-white mr-1 mt-auto shrink-0"
          style={{background:nameColor(msg.sender)}}>{msg.sender?.[0]}</div>
      )}
      <div style={{maxWidth:"76%"}}>
        {isGroup&&!sent&&<p className="font-pixel text-[8px] px-1 mb-0.5" style={{color:nameColor(msg.sender)}}>{msg.sender}</p>}
        <div className="border-2 border-border shadow-pixel-sm"
          style={{background:sent?"var(--accent)":"var(--card)",padding:msg.type==="image"?2:"6px 10px 4px"}}>
          {msg.type==="image"&&(
            <img src={msg.imageSrc} alt={msg.imageDesc||"photo"} style={{width:200,height:140,objectFit:"cover",display:"block"}}/>
          )}
          {msg.type==="audio"&&msg.audioSrc&&(
            <audio controls src={msg.audioSrc} style={{width:200,height:32}}/>
          )}
          {msg.type==="audio"&&!msg.audioSrc&&(
            <div className="flex items-center gap-2 px-2 py-1" style={{minWidth:180}}>
              <button onClick={playAudio}
                className={`w-7 h-7 border-2 border-border flex items-center justify-center font-pixel text-[8px] shrink-0 ${playing?"bg-primary text-primary-foreground":"bg-accent text-accent-foreground"}`}>
                {playing?"■":"▶"}
              </button>
              <Waveform seed={msg.id}/>
              <span className="font-pixel text-[7px] text-muted-foreground">{msg.duration||"0:08"}</span>
            </div>
          )}
          {msg.type==="text"&&<p className="text-sm leading-snug">{msg.text}</p>}
          <div className="flex items-center justify-end gap-1 mt-0.5">
            <span className="font-pixel text-[7px] text-muted-foreground">{msg.time}</span>
            {sent&&<span className="font-pixel text-[7px] text-primary">✓✓</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function WhatsAppMode({onExit}:{onExit:()=>void}){
  const key=loadKey();
  const [view,setView]=useState<View>({screen:"list"});
  const [convos,setConvos]=useState<Record<CID,Msg[]>>({johnny:[],jacob:[],sam:[],class:[]});
  const [input,setInput]=useState("");
  const [callInput,setCallInput]=useState("");
  const [typing,setTyping]=useState(false);
  const [callTyping,setCallTyping]=useState(false);
  const [callLog,setCallLog]=useState<{role:"user"|"contact";text:string;speaker?:string}[]>([]);
  const [callTimer,setCallTimer]=useState(0);
  const [err,setErr]=useState("");
  const [recording,setRecording]=useState(false);
  const [unread,setUnread]=useState<Record<CID,number>>({johnny:2,jacob:1,sam:0,class:5});
  const bottomRef=useRef<HTMLDivElement>(null);
  const fileRef=useRef<HTMLInputElement>(null);
  const mrRef=useRef<MediaRecorder|null>(null);
  const chunksRef=useRef<Blob[]>([]);
  const timerRef=useRef<ReturnType<typeof setInterval>|null>(null);

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[view,typing]);

  useEffect(()=>{
    if(view.screen==="call"&&view.status==="connected"){
      timerRef.current=setInterval(()=>setCallTimer(t=>t+1),1000);
    }
    return()=>{
      if(timerRef.current){
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  },[view]);

  function add(cid:CID,msg:Omit<Msg,"id"|"time">){
    setConvos(c=>({...c,[cid]:[...c[cid],{...msg,id:nid(),time:ts()}]}));
  }

  function clearAll(){setConvos({johnny:[],jacob:[],sam:[],class:[]});setUnread({johnny:0,jacob:0,sam:0,class:0});setView({screen:"list"});}

  // Helper to get a consistent seed for image generation per character
  function msgIdForSeed(name: string): number {
    let h = 0;
    for (const c of name) h = ((h << 5) - h + c.charCodeAt(0)) | 0;
    return Math.abs(h);
  }

  // ── Open chat ────────────────────────────────────────────────────────────────

  async function openChat(cid:CID){
    setErr("");
    setView({screen:"chat",cid});
    setUnread(u=>({...u,[cid]:0}));
    if(convos[cid].length>0) return;
    setTyping(true);
    try{
      if(cid==="class"){
        const raw=await gemini(key,[{role:"user",parts:[{text:
          `Simulera en svensk WhatsApp-klasschatt (Klass 8B, 15 år). Generera 5-6 meddelanden som användaren missade offline. Karaktärer: ${CLASS_CHARS}. Regler: väldigt korta (3-12 ord), ingen emoji-spam, SVENSKA (aldrig engelska), realistiska ämnen. Ibland bild eller röstmeddelande. För röstmeddelanden: voiceText MÅSTE vara på svenska. Returnera BARA JSON: [{"name":"Wilma","text":"omg har ni gjort matten","type":"text"},{"name":"Hugo","text":"","type":"image","imageDesc":"träning idag"},{"name":"Liam","text":"","type":"audio","duration":"0:09","voiceText":"haha typ det värsta jag sett på länge"}]`
        }]}],undefined,500);
        const arr = parseArr<{name:string;text:string;type:string;imageDesc?:string;duration?:string;voiceText?:string}>(raw);
        for (const m of arr) {
          const imageSrc = m.type === "image" && m.imageDesc 
            ? generateImageUrl(m.imageDesc, msgIdForSeed(m.name)) 
            : undefined;
          add("class",{
            role:"contact",
            sender:m.name,
            text:m.text||m.imageDesc||"",
            type:(m.type as Msg["type"])||"text",
            imageDesc:m.imageDesc,
            imageSrc,
            duration:m.duration,
            voiceText:m.voiceText
          });
        }
      } else {
        const reply=await gemini(key,[{role:"user",parts:[{text:"Skicka ett kort öppningsmeddelande som om du bara textar spontant. Max 1 kort mening. Inga citattecken."}]}],PERSONA[cid],60);
        add(cid,{role:"contact",text:reply.trim(),type:"text"});
      }
    }catch(e){setErr(e instanceof Error?e.message:"Fel");}
    finally{setTyping(false);}
  }

  // ── Send text ────────────────────────────────────────────────────────────────

  async function send(){
    if(view.screen!=="chat") return;
    const {cid}=view;
    const text=input.trim();
    if(!text||typing) return;
    setInput(""); setErr("");
    add(cid,{role:"user",text,type:"text"});
    setTyping(true);
    try{
      if(cid==="class"){
        const recent=convos.class.slice(-4).map(m=>`${m.sender||"Du"}: ${m.text}`).join("\n");
        const raw=await gemini(key,[{role:"user",parts:[{text:
          `Klasschatt. Senaste:\n${recent}\nAnvändaren skickade: "${text}"\nGenerera 1-3 korta svar från klasskamrater. Karaktärer: ${CLASS_CHARS}. Korta (3-10 ord). Ingen emoji-spam. SVENSKA (aldrig engelska). Ibland bild/ljud. För röstmeddelanden: voiceText MÅSTE vara på svenska. BARA JSON: [{"name":"Ella","text":"omg fr","type":"text"}]`
        }]}],undefined,250);
        const arr=parseArr<{name:string;text:string;type:string;imageDesc?:string;duration?:string;voiceText?:string}>(raw);
        for(const m of arr){
          await new Promise(r=>setTimeout(r,500+Math.random()*800));
          const imageSrc = m.type === "image" && m.imageDesc 
            ? generateImageUrl(m.imageDesc, msgIdForSeed(m.name) + Date.now()) 
            : undefined;
          add("class",{
            role:"contact",
            sender:m.name,
            text:m.text||m.imageDesc||"",
            type:(m.type as Msg["type"])||"text",
            imageDesc:m.imageDesc,
            imageSrc,
            duration:m.duration,
            voiceText:m.voiceText
          });
        }
      } else {
        const history:GTurn[]=convos[cid].slice(-10).map(m=>({
          role:m.role==="user"?"user":"model" as "user"|"model",
          parts:[{text:m.text}]
        }));
        history.push({role:"user",parts:[{text}]});
        const reply=await gemini(key,history,PERSONA[cid],100);
        add(cid,{role:"contact",text:reply.trim(),type:"text"});
      }
    }catch(e){setErr(e instanceof Error?e.message:"Fel");}
    finally{setTyping(false);}
  }

  // ── Send photo ───────────────────────────────────────────────────────────────

  async function onFileChange(e:React.ChangeEvent<HTMLInputElement>){
    if(view.screen!=="chat") return;
    const cid=view.cid;
    const file=e.target.files?.[0]; if(!file) return;
    
    const reader=new FileReader();
    reader.onload=async()=>{
      const imageSrc = reader.result as string;
      const base64Data = imageSrc.split(',')[1]; // Remove data:image/...;base64, prefix
      
      // Add user's image to chat
      add(cid,{role:"user",text:"[Bild]",type:"image",imageSrc});
      setTyping(true);
      
      try{
        if(cid==="class"){
          // For class chat, describe what the user sent and have classmates react
          const raw=await gemini(key,[{role:"user",parts:[
            {text:`Klasschatt. Användaren skickade en bild. Beskriv kort vad bilden visar (1-2 ord) och generera 1-2 reaktioner från klasskamrater. Karaktärer: ${CLASS_CHARS}. Korta (3-10 ord). Svenska. BARA JSON: [{"name":"Ella","text":"omg vad fint","type":"text"}]`},
            {inlineData:{mimeType:file.type,data:base64Data}}
          ]}],undefined,250);
          const arr=parseArr<{name:string;text:string;type:string;imageDesc?:string;duration?:string;voiceText?:string}>(raw);
          for(const m of arr){
            await new Promise(r=>setTimeout(r,500+Math.random()*800));
            add("class",{role:"contact",sender:m.name,text:m.text||"",type:(m.type as Msg["type"])||"text",imageDesc:m.imageDesc,duration:m.duration,voiceText:m.voiceText});
          }
        } else {
          // For 1-on-1 chats, the AI sees the image and responds to it
          const history:GTurn[]=convos[cid].slice(-6).map(m=>({
            role:m.role==="user"?"user":"model" as "user"|"model",
            parts:[{text:m.type==="image"?"[Användaren skickade en bild]":m.text}]
          }));
          history.push({role:"user",parts:[
            {text:"[Användaren skickade en bild. Reagera på den. Max 1-2 meningar.]"},
            {inlineData:{mimeType:file.type,data:base64Data}}
          ]});
          const reply=await gemini(key,history,PERSONA[cid],120);
          add(cid,{role:"contact",text:reply.trim(),type:"text"});
        }
      }catch(e){setErr(e instanceof Error?e.message:"Fel");}
      finally{setTyping(false);}
    };
    reader.readAsDataURL(file);
    e.target.value="";
  }

  // ── Record audio ─────────────────────────────────────────────────────────────

  async function toggleRecord(){
    if(view.screen!=="chat") return;
    const {cid}=view;
    if(recording){
      mrRef.current?.stop(); 
      mrRef.current = null;
      setRecording(false);
    } else {
      try{
        const stream=await navigator.mediaDevices.getUserMedia({audio:true});
        const mr=new MediaRecorder(stream);
        chunksRef.current=[];
        mr.ondataavailable=e=>{if(e.data.size>0)chunksRef.current.push(e.data);};
        mr.onstop=async()=>{
          stream.getTracks().forEach(t=>t.stop());
          const blob=new Blob(chunksRef.current,{type:"audio/webm"});
          const audioSrc = URL.createObjectURL(blob);
          
          // Convert blob to base64 for Gemini
          const arrayBuffer = await blob.arrayBuffer();
          const base64Audio = btoa(
            new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
          );
          
          add(cid,{role:"user",text:"[Röstmeddelande]",type:"audio",audioSrc});
          // Trigger AI response with the actual audio bytes
          handleAudioSent(cid, base64Audio);
        };
        mr.start(); mrRef.current=mr; setRecording(true);
      }catch{ setErr("Mikrofonåtkomst nekad"); }
    }
  }

  async function handleAudioSent(cid: CID, base64Audio: string) {
    setTyping(true);
    try{
      if(cid==="class"){
        // For class chat, send audio to Gemini to understand + get reactions
        const raw=await gemini(key,[{role:"user",parts:[
          {text:`Klasschatt. Användaren skickade ett röstmeddelande. Transkribera vad som sägs och generera 1-2 korta reaktioner från klasskamrater baserat på innehållet. Karaktärer: ${CLASS_CHARS}. Korta (3-10 ord). Svenska. BARA JSON: [{"name":"Ella","text":"haha lol","type":"text"}]`},
          {inlineData:{mimeType:"audio/webm",data:base64Audio}}
        ]}],undefined,300);
        const arr=parseArr<{name:string;text:string;type:string;imageDesc?:string;duration?:string;voiceText?:string}>(raw);
        for(const m of arr){
          await new Promise(r=>setTimeout(r,500+Math.random()*800));
          add("class",{role:"contact",sender:m.name,text:m.text||"",type:(m.type as Msg["type"])||"text",imageDesc:m.imageDesc,duration:m.duration,voiceText:m.voiceText});
        }
      } else {
        // For 1-on-1, send audio to Gemini so the AI actually hears what was said
        const history:GTurn[]=convos[cid].slice(-6).map(m=>({
          role:m.role==="user"?"user":"model" as "user"|"model",
          parts:[{text:m.type==="audio"?"[Röstmeddelande]":m.text}]
        }));
        history.push({role:"user",parts:[
          {text:"[Användaren skickade ett röstmeddelande. Lyssna och svara på det som sägs. Max 1-2 meningar.]"},
          {inlineData:{mimeType:"audio/webm",data:base64Audio}}
        ]});
        const reply=await gemini(key,history,PERSONA[cid],120);
        add(cid,{role:"contact",text:reply.trim(),type:"text"});
      }
    }catch(e){setErr(e instanceof Error?e.message:"Fel");}
    finally{setTyping(false);}
  }

  // ── Call ─────────────────────────────────────────────────────────────────────

  async function startCall(cid:CID){
    window.speechSynthesis.cancel();
    setCallLog([]); setCallTimer(0); setCallInput("");
    const callerNames:Record<CID,string>={johnny:"Johnny",jacob:"Jacob",sam:"Sam",class:"Wilma"};
    setView({screen:"call",cid,status:"ringing",callerId:callerNames[cid]});
    await new Promise(r=>setTimeout(r,2000));
    setView({screen:"call",cid,status:"connected",callerId:callerNames[cid]});
    try{
      const greeting=await gemini(key,[{role:"user",parts:[{text:"Hälsa kort, du svarade precis i telefon. 1 mycket kort mening."}]}],CALL_PERSONA[cid]||CALL_PERSONA.class,50);
      const g=greeting.trim();
      setCallLog(l=>[...l,{role:"contact",text:g,speaker:callerNames[cid]}]);
      speak(g);
    }catch{ /* ignore */ }
  }

  async function sendCallMsg(){
    if(view.screen!=="call"||view.status!=="connected") return;
    const text=callInput.trim(); if(!text||callTyping) return;
    setCallInput("");
    setCallLog(l=>[...l,{role:"user",text}]);
    setCallTyping(true);
    try{
      const history:GTurn[]=callLog.slice(-6).map(m=>({role:m.role==="user"?"user":"model" as "user"|"model",parts:[{text:m.text}]}));
      history.push({role:"user",parts:[{text}]});
      const reply=await gemini(key,history,CALL_PERSONA[view.cid]||CALL_PERSONA.class,50);
      const r=reply.trim();
      setCallLog(l=>[...l,{role:"contact",text:r,speaker:view.callerId}]);
      speak(r);
    }catch{ /* ignore */ }
    finally{setCallTyping(false);}
  }

  function hangUp(){
    window.speechSynthesis.cancel();
    if(timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const cid=view.screen==="call"?view.cid:"johnny";
    setView({screen:"chat",cid});
  }

  const fmtTimer=(s:number)=>`${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;

  // ── Call screen ───────────────────────────────────────────────────────────────

  if(view.screen==="call"){
    const ct=CONTACTS.find(c=>c.id===view.cid)!;
    return(
      <div className="flex flex-col h-[calc(100vh-6rem)] border-2 border-border bg-card">
        <div className="flex flex-col items-center gap-2 py-8 border-b-2 border-border" style={{background:"#111"}}>
          <div className="w-20 h-20 border-4 border-border flex items-center justify-center font-pixel text-2xl text-white"
            style={{background:ct.color}}>{ct.init}</div>
          <p className="font-pixel text-[12px] text-white">{ct.name}</p>
          <p className="font-pixel text-[9px] text-green-400">
            {view.status==="ringing"?"Ringer...":fmtTimer(callTimer)}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3 bg-secondary/10">
          {callLog.map((m,i)=>(
            <div key={i} className={`flex ${m.role==="user"?"justify-end":"justify-start"} mb-2`}>
              <div className="border-2 border-border px-3 py-1.5 max-w-[80%]"
                style={{background:m.role==="user"?"var(--accent)":"var(--card)"}}>
                {m.speaker&&<p className="font-pixel text-[7px] text-muted-foreground mb-0.5">{m.speaker}</p>}
                <p className="text-sm">{m.text}</p>
              </div>
            </div>
          ))}
          {callTyping&&(
            <div className="flex justify-start mb-2">
              <div className="border-2 border-border bg-card px-3 py-2 flex gap-1 items-center">
                {[0,150,300].map(d=><div key={d} className="w-1.5 h-1.5 bg-muted-foreground animate-bounce" style={{animationDelay:`${d}ms`}}/>)}
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>
        <div className="flex gap-2 p-3 border-t-2 border-border">
          <input value={callInput} onChange={e=>setCallInput(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&sendCallMsg()}
            placeholder="Skriv vad du säger…" disabled={view.status==="ringing"}
            className="flex-1 rounded-sm border-2 border-border bg-card px-3 py-2 text-sm outline-none focus:border-ring disabled:opacity-40"/>
          <button onClick={sendCallMsg}
            className="rounded-sm border-2 border-border bg-accent px-4 py-2 font-pixel text-[9px] text-accent-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none">
            ➤
          </button>
          <button onClick={hangUp}
            className="rounded-sm border-2 border-border bg-red-500 px-4 py-2 font-pixel text-[9px] text-white shadow-pixel-sm active:translate-y-0.5 active:shadow-none">
            LÄGG PÅ
          </button>
        </div>
      </div>
    );
  }

  // ── Chat screen ───────────────────────────────────────────────────────────────

  if(view.screen==="chat"){
    const {cid}=view;
    const ct=CONTACTS.find(c=>c.id===cid)!;
    const msgs=convos[cid];
    return(
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        <div className="pixel-panel flex items-center gap-3 rounded-sm bg-card p-3 mb-3 shrink-0">
          <button onClick={()=>setView({screen:"list"})} className="font-pixel text-[9px] text-muted-foreground mr-1">←</button>
          <div className="w-9 h-9 border-2 border-border flex items-center justify-center font-pixel text-[8px] text-white shrink-0"
            style={{background:ct.color}}>{ct.init}</div>
          <div className="flex-1 min-w-0">
            <p className="font-pixel text-[10px]">{ct.name}</p>
            <p className="font-pixel text-[7px] text-muted-foreground">{typing?"skriver...":ct.sub}</p>
          </div>
          <button onClick={()=>startCall(cid)}
            className="rounded-sm border-2 border-border bg-green-600 px-3 py-1.5 font-pixel text-[8px] text-white shadow-pixel-sm active:translate-y-0.5 active:shadow-none">
            📞 RING
          </button>
        </div>
        {err&&<p className="font-pixel text-[8px] text-destructive mb-2 px-1">✗ {err}</p>}
        <div className="flex-1 overflow-y-auto px-2 py-2 border-2 border-border bg-secondary/20 mb-3">
          {msgs.length===0&&!typing&&<p className="font-pixel text-[8px] text-muted-foreground text-center py-4">Laddar…</p>}
          {msgs.map(m=><Bubble key={m.id} msg={m} isGroup={ct.isGroup}/>)}
          {typing&&(
            <div className="flex justify-start mb-2">
              {ct.isGroup&&<div className="w-6 h-6 border-2 border-border bg-secondary mr-1 shrink-0"/>}
              <div className="border-2 border-border bg-card px-3 py-2 flex gap-1 items-center">
                {[0,150,300].map(d=><div key={d} className="w-1.5 h-1.5 bg-muted-foreground animate-bounce" style={{animationDelay:`${d}ms`}}/>)}
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>
        <div className="flex gap-2 shrink-0">
          <input type="file" accept="image/*" ref={fileRef} onChange={onFileChange} className="hidden"/>
          <button onClick={()=>fileRef.current?.click()}
            className="rounded-sm border-2 border-border bg-card px-3 py-2 font-pixel text-[10px] shadow-pixel-sm active:translate-y-0.5 active:shadow-none">📷</button>
          <button onClick={toggleRecord}
            className={`rounded-sm border-2 border-border px-3 py-2 font-pixel text-[10px] shadow-pixel-sm active:translate-y-0.5 active:shadow-none ${recording?"bg-red-500 text-white":"bg-card"}`}>
            {recording?"⏹":"🎤"}
          </button>
          <input value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()}
            placeholder="Skriv ett meddelande…" spellCheck={false}
            className="flex-1 rounded-sm border-2 border-border bg-card px-3 py-2 text-sm outline-none focus:border-ring"/>
          <button onClick={send} disabled={!input.trim()||typing}
            className="rounded-sm border-2 border-border bg-accent px-3 py-2 font-pixel text-[9px] text-accent-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none disabled:opacity-40">
            ➤
          </button>
        </div>
      </div>
    );
  }

  // ── List ─────────────────────────────────────────────────────────────────────

  return(
    <div className="flex flex-col gap-4">
      <div className="pixel-panel flex items-center justify-between rounded-sm bg-card p-4">
        <div>
          <p className="font-pixel text-[11px] text-primary">WHATSAPP</p>
          <p className="text-sm text-muted-foreground">Johnny · Jacob · Sam · Klass 8B</p>
        </div>
        <div className="flex gap-2">
          <button onClick={clearAll} className="rounded-sm border-2 border-border bg-destructive/10 px-3 py-1.5 font-pixel text-[8px] text-destructive shadow-pixel-sm">RENSA</button>
          <button onClick={onExit} className="rounded-sm border-2 border-border bg-card px-3 py-1.5 font-pixel text-[9px] shadow-pixel-sm">KARTAN</button>
        </div>
      </div>
      {!key&&<p className="font-pixel text-[8px] text-destructive px-1">Ange Gemini-nyckel i Klassrumsläget.</p>}
      <div className="pixel-panel rounded-sm bg-card overflow-hidden">
        {CONTACTS.map((c,i)=>{
          const last=convos[c.id].at(-1);
          const preview=last?(last.type==="image"?"📷 Bild":last.type==="audio"?"🎤 Röstmeddelande":last.text):c.sub;
          return(
            <button key={c.id} onClick={()=>openChat(c.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/30 active:bg-secondary/50 transition-colors ${i<CONTACTS.length-1?"border-b-2 border-border":""}`}>
              <div className="w-11 h-11 border-2 border-border flex items-center justify-center font-pixel text-[9px] text-white shrink-0"
                style={{background:c.color}}>{c.init}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-pixel text-[10px]">{c.name}</span>
                  <span className="font-pixel text-[7px] text-muted-foreground">{ts()}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground truncate">{preview}</p>
                  {unread[c.id]>0&&<span className="font-pixel text-[7px] text-white bg-primary w-4 h-4 flex items-center justify-center shrink-0">{unread[c.id]}</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
