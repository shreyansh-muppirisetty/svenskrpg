import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { DictionaryPanel } from "@/components/DictionaryPanel";
import { detectAndSaveEnEtt } from "@/lib/enellerett";
import { year7AssessmentPrompt } from "@/lib/classroom-assessment";
import { punctuationAssignmentPrompt, punctuationGuidance } from "@/lib/classroom-punctuation";
import { playerIdentityPrompt } from "@/lib/player-profile";

const KEY_STORE = "svenska-quest-classroom-gemini-key";
const PROG_STORE = "svenska-quest-classroom-progress-v3";
const MODEL = "gemini-3.1-flash-lite";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const TERM_LENGTH = 20;

// ── Core types ────────────────────────────────────────────────────────────────

const ALL_TYPES = [
  "circle_verb","correct_mistakes","reading_comprehension","write_story",
  "kallkritik","fill_blank","translate_sentences","word_class","reorder_sentences",
  "conjugate_verbs","en_ett","write_letter","argumentative_text","find_synonyms",
  "correct_punctuation","summarize","write_dialogue","plural_forms","past_tense","write_poem",
] as const;
type AT = (typeof ALL_TYPES)[number];
type LG = "A"|"B"|"C"|"D"|"E"|"F";
type CK = "F1"|"F2"|"F3"|"F4"|"F5";

const COMPS: Record<CK,string> = {
  F1:"Formulera sig i tal och skrift",
  F2:"Läsa och analysera texter",
  F3:"Anpassa språket efter syfte",
  F4:"Urskilja språkliga strukturer",
  F5:"Söka och värdera information",
};

const CMAP: Record<AT,CK[]> = {
  circle_verb:["F4"], correct_mistakes:["F4"], reading_comprehension:["F2"],
  write_story:["F1","F3"], kallkritik:["F5"], fill_blank:["F4"],
  translate_sentences:["F3"], word_class:["F4"], reorder_sentences:["F4"],
  conjugate_verbs:["F4"], en_ett:["F4"], write_letter:["F1","F3"],
  argumentative_text:["F1","F3"], find_synonyms:["F4"], correct_punctuation:["F4"],
  summarize:["F2"], write_dialogue:["F1","F3"], plural_forms:["F4"],
  past_tense:["F4"], write_poem:["F1"],
};

type GradeEntry = { id:string; type:AT; title:string; grade:LG; comps:CK[]; term:number; ts:number };
type Progress = { grades:GradeEntry[]; currentTerm:number };
type Assign = {
  type:AT; title:string; instructions:string; answer_key:string;
  text?:string; text_with_blanks?:string; words?:string[]; word_bank?:string[];
  sentences?:string[]; questions?:string[]; verbs?:string[]; prompt?:string;
};
type Msg = { role:"user"|"model"; text:string };

// ── Grade math ────────────────────────────────────────────────────────────────

const GV:Record<LG,number>={A:5,B:4,C:3,D:2,E:1,F:0};
function gFromVal(v:number):LG{
  if(v>=4.5)return"A";if(v>=3.5)return"B";if(v>=2.5)return"C";
  if(v>=1.5)return"D";if(v>=0.5)return"E";return"F";
}
function compGrade(gs:GradeEntry[],c:CK,term:number):LG|null{
  const r=gs.filter(g=>g.term===term&&g.comps.includes(c));
  if(!r.length)return null;
  return gFromVal(r.reduce((s,g)=>s+GV[g.grade],0)/r.length);
}
function termGrade(gs:GradeEntry[],term:number):LG|null{
  if(gs.filter(g=>g.term===term).length<TERM_LENGTH)return null;
  const cg=(Object.keys(COMPS)as CK[]).map(c=>compGrade(gs,c,term)).filter((g):g is LG=>g!==null);
  if(!cg.length)return null;
  if(cg.some(g=>g==="F"))return"F";
  return gFromVal(cg.reduce((s,g)=>s+GV[g],0)/cg.length);
}

// ── Storage ───────────────────────────────────────────────────────────────────

function loadKey():string{try{return localStorage.getItem(KEY_STORE)??""}catch{return""}}
function saveKey(k:string){try{localStorage.setItem(KEY_STORE,k)}catch{/**/}}
function loadProg():Progress{try{const r=localStorage.getItem(PROG_STORE);return r?JSON.parse(r):{grades:[],currentTerm:1}}catch{return{grades:[],currentTerm:1}}}
function saveProg(p:Progress){try{localStorage.setItem(PROG_STORE,JSON.stringify(p))}catch{/**/}}

// ── Assignment prompts (årskurs 7 — realistic level, open tasks give freedom) ──

const LEVEL=`Level: Swedish grundskola årskurs 7 (13-year-olds). Use everyday topics a 13-year-old knows (school, friends, sport, games, family, hobbies, social media, nature). Solid årskurs 7 difficulty: a real but fair challenge for a pupil who has been taught the standard årskurs 7 content — not trivial, not åk 9 level, no tricks or rare grammar.`;

const TMETA:Record<AT,{label:string;gen:string}>={
  circle_verb:{label:"Hitta verben",gen:`${LEVEL} Write a short Swedish paragraph (6–8 sentences) with 10–12 verbs, including a few modal verbs + infinitive (kan/måste/ska/vill) and a few perfect forms (har/hade + supinum). Return ONLY valid JSON:
{"type":"circle_verb","title":"Hitta verben","instructions":"Klicka på alla verb i texten. Det finns [N] verb totalt.","text":"PARAGRAPH","answer_key":"All verbs listed"}`},

  correct_mistakes:{label:"Rätta felen",gen:`${LEVEL} Write a Swedish paragraph (6–8 sentences) and put in about 8 typical pupil mistakes: wrong verb form, adjective agreement, word order after a time word or in a bisats, en/ett, wrong preposition, a compound word written apart. Count only the errors you really put in and use that same number in the instructions. Return ONLY valid JSON:
{"type":"correct_mistakes","title":"Rätta felen","instructions":"Texten innehåller [N] fel. Skriv en rättad version av texten.","text":"PARAGRAPH WITH ERRORS","answer_key":"CORRECTED TEXT + short list of each error"}`},

  reading_comprehension:{label:"Läsförståelse",gen:`${LEVEL} Write a Swedish text of about 200 words on an interesting topic for 13-year-olds. Add 5 questions: 2 where the answer is in the text, 2 asking why/what the text means, 1 asking for the pupil's own opinion. Return ONLY valid JSON:
{"type":"reading_comprehension","title":"Läsförståelse","instructions":"Läs texten och svara på frågorna med egna ord.","text":"TEXT","questions":["Q1","Q2","Q3","Q4","Q5"],"answer_key":"Short model answers; other reasonable answers are fine"}`},

  write_story:{label:"Skriv en berättelse",gen:`${LEVEL} Give the pupil a free creative writing task. Only ask for a length of at least 250 words. The prompt is just an open starting point (an opening sentence or a short situation) — the pupil decides what happens. Return ONLY valid JSON:
{"type":"write_story","title":"Skriv en berättelse","instructions":"Skriv en berättelse på minst 250 ord. Du bestämmer själv hur den utvecklas. Försök ha med lite dialog och beskriv miljön.","prompt":"Open starting sentence or short situation","answer_key":"Free task. Grade on idea, structure, language and how the story hangs together. Any reasonable story is fine."}`},

  kallkritik:{label:"Källkritik",gen:`${LEVEL} Write a short Swedish social-media post or news item (about 120 words) that is somewhat one-sided or exaggerated (for example a miracle product, a clickbait claim or a rumour). Add 4 questions. Return ONLY valid JSON:
{"type":"kallkritik","title":"Källkritik","instructions":"Läs texten och svara på frågorna.","text":"THE POST OR ARTICLE","questions":["Vem tror du har skrivit texten, och kan man lita på avsändaren?","Vad vill texten att läsaren ska tycka eller göra?","Finns det något i texten som verkar överdrivet eller saknas?","Hur skulle du kontrollera om det stämmer?"],"answer_key":"Short model answers; other reasonable answers are fine"}`},

  fill_blank:{label:"Fyll i luckorna",gen:`${LEVEL} Write 8 Swedish sentences, each with one blank (___). Blanks test common things: conjunctions/subjunctions (och, men, att, eftersom, när), common prepositions, adjective agreement, sig/mig/dig. Word bank: the 8 correct words + 3 plausible wrong ones. Return ONLY valid JSON:
{"type":"fill_blank","title":"Fyll i luckorna","instructions":"Välj rätt ord från ordbanken. Varje ord används en gång.","text_with_blanks":"S1 with ___.\nS2 with ___.","word_bank":["w1","w2","w3","w4","w5","w6","w7","w8","d1","d2","d3"],"answer_key":"1. word\n2. word\n..."}`},

  translate_sentences:{label:"Översätt meningarna",gen:`${LEVEL} Write 6 English sentences to translate into Swedish: everyday sentences of normal length, a couple of them with because/but/that. Return ONLY valid JSON:
{"type":"translate_sentences","title":"Översätt till svenska","instructions":"Översätt meningarna till svenska.","sentences":["S1","S2","S3","S4","S5","S6"],"answer_key":"1. one possible Swedish translation\n... (other correct translations should also be accepted)"}`},

  word_class:{label:"Ordklasser",gen:`${LEVEL} Write a short Swedish text of 3–4 sentences, then list 12 words from it from different word classes (substantiv, verb, adjektiv, adverb, pronomen, preposition, konjunktion, räkneord). Only use classes pupils in årskurs 7 have learned. Return ONLY valid JSON:
{"type":"word_class","title":"Ordklasser","instructions":"Vilken ordklass tillhör varje ord i texten? Skriv t.ex. substantiv, verb, adjektiv, adverb, pronomen, preposition, konjunktion eller räkneord.","text":"THE SHORT TEXT","words":["w1","w2","...12 words"],"answer_key":"1. word = klass\n..."}`},

  reorder_sentences:{label:"Ordna meningarna",gen:`${LEVEL} Write 6 short Swedish sentences that make up a small story or a set of everyday instructions with a clear order (use words like först, sedan, efter det, till sist). List them in the correct order. Return ONLY valid JSON:
{"type":"reorder_sentences","title":"Ordna meningarna","instructions":"Meningarna är blandade. Skriv numren i rätt ordning, t.ex. 3,1,2,6,5,4.","sentences":["S1","S2","S3","S4","S5","S6"],"answer_key":"Write the six sentences in the correct order, full text, one per line, each with a short clue why it goes there"}`},

  conjugate_verbs:{label:"Böj verben",gen:`${LEVEL} Choose 6 common verbs: two from group 1, one each from groups 2, 3 and 4 (irregular), and one s-verb (t.ex. hoppas/finnas). Return ONLY valid JSON:
{"type":"conjugate_verbs","title":"Böj verben","instructions":"Fyll i presens, preteritum, perfekt och pluskvamperfekt för varje verb.","verbs":["att skriva","att leka","att köpa","att tro","att springa","att hoppas"],"answer_key":"att skriva: skriver / skrev / har skrivit / hade skrivit\n..."}`},

  en_ett:{label:"En eller ett?",gen:`Year 7 Swedish en/ett: 12 common nouns, a good mix of en and ett words, a few slightly tricky ones. Shuffle them so en-words and ett-words are mixed. Return ONLY valid JSON:
{"type":"en_ett","title":"En eller ett?","instructions":"Välj rätt artikel (en eller ett) för varje substantiv.","words":["hus","bil","barn","skola","bord","lampa","träd","dator","klass","lärare","fönster","bok"],"answer_key":"ett hus, en bil, ett barn, en skola, ett bord, en lampa, ett träd, en dator, en klass, en lärare, ett fönster, en bok"}`},

  write_letter:{label:"Skriv ett brev",gen:`${LEVEL} Give the pupil a realistic letter or e-mail task, either formal or informal (for example asking the school for something, applying for a holiday job or a club, a letter to a relative, or a short letter to the editor). Only ask for a length of at least 150 words. Keep the requirements light. Return ONLY valid JSON:
{"type":"write_letter","title":"Skriv ett brev","instructions":"Skriv ett brev eller ett mejl på minst 150 ord. Tänk på vem du skriver till och hur du ska låta. Du bestämmer själv vad du vill ta upp.","prompt":"Short realistic situation (who to write to and why)","answer_key":"Free task. Grade on whether the purpose and receiver are clear, a suitable tone, structure and language. Do not require a rigid letter layout."}`},

  argumentative_text:{label:"Argumenterande text",gen:`${LEVEL} Give the pupil a debate question that 13-year-olds have opinions about (for example school phones, homework, screen time, pocket money, school lunches). Only ask for at least 200 words and that the pupil gives their opinion with reasons. Return ONLY valid JSON:
{"type":"argumentative_text","title":"Vad tycker du?","instructions":"Skriv en text på minst 200 ord där du säger din åsikt och förklarar varför. Använd gärna exempel. Du väljer själv hur du bygger upp texten.","prompt":"Debate question","answer_key":"Free task. Grade on a clear opinion, reasons with examples, structure and language. A counter-argument is a bonus, not a requirement."}`},

  find_synonyms:{label:"Synonymer",gen:`${LEVEL} Choose 8 common Swedish adjectives or verbs. Pupils write one synonym (word with similar meaning) and one antonym (opposite) for each. Return ONLY valid JSON:
{"type":"find_synonyms","title":"Synonymer och motsatser","instructions":"Skriv ett synonym och ett motsatsord till varje ord. Du får gärna förklara om orden skiljer sig lite i betydelse.","words":["glad","snabb","stor","gammal","varm","lång","tyst","lätt"],"answer_key":"glad: syn=lycklig/nöjd, ant=ledsen; ... (accept all reasonable synonyms and antonyms)"}`},

  correct_punctuation:{label:"Rätta skiljetecknen",gen:punctuationAssignmentPrompt()},

  summarize:{label:"Sammanfatta & analysera",gen:`${LEVEL} Write a Swedish opinion or information text of about 200 words. Add 4 tasks. Return ONLY valid JSON:
{"type":"summarize","title":"Sammanfatta och svara","instructions":"Läs texten och gör uppgifterna.","text":"THE TEXT","questions":["1. Sammanfatta texten med egna ord (ca 50 ord).","2. Vad är textens syfte — vill den informera, övertyga eller underhålla?","3. Hur tycker du att texten låter (t.ex. seriös, rolig, arg)? Ge ett exempel.","4. Vad tycker du själv om det texten säger?"],"answer_key":"Short model answers; other reasonable answers are fine"}`},

  write_dialogue:{label:"Skriv en dialog",gen:`${LEVEL} Give the pupil a free dialogue task. Only ask for at least 16 repliker and a few light extras. The prompt is a simple everyday situation or two characters and a setting — the pupil decides everything else, including how it ends. Do NOT require surprises, subtext, special character voices, or other specific techniques. Return ONLY valid JSON:
{"type":"write_dialogue","title":"Skriv en dialog","instructions":"Skriv en dialog med minst 16 repliker. Du bestämmer själv vilka personerna är och hur det slutar. Använd tankstreck (–) för repliker, och gärna några scenanvisningar.","prompt":"Simple everyday situation or two characters in a place","answer_key":"Free task. Grade on at least 16 repliker, a dialogue that works and is easy to follow, dialogue punctuation, and language. Any reasonable idea is fine."}`},

  plural_forms:{label:"Pluralformer",gen:`${LEVEL} Choose 10 common Swedish nouns: a mix of the declensions, plus a couple of irregular ones (man/män, fot/fötter) and one word that is the same in singular and plural (t.ex. ett barn — barn). Pupils write all four forms. Return ONLY valid JSON:
{"type":"plural_forms","title":"Böj substantiven","instructions":"Skriv obestämd singular, bestämd singular, obestämd plural och bestämd plural för varje ord.","sentences":["en bil","ett hus","en flicka","ett barn","en man","en lärare","ett öga","en hand","ett problem","en dag"],"answer_key":"en bil / bilen / bilar / bilarna\n..."}`},

  past_tense:{label:"Dåtid",gen:`${LEVEL} Write 6 present-tense Swedish sentences with common verbs (include a couple of irregular verbs). Pupils rewrite each in preteritum and in pluskvamperfekt. Return ONLY valid JSON:
{"type":"past_tense","title":"Skriv i dåtid","instructions":"Skriv om varje mening i preteritum och i pluskvamperfekt.","sentences":["S1","S2","S3","S4","S5","S6"],"answer_key":"1. Pret: ... / Pluskv: ...\n..."}`},

  write_poem:{label:"Skriv en dikt",gen:`${LEVEL} Give the pupil a free poem task. Any form is fine (rhyming or not). Only ask for at least 8 rader. The prompt is just an open theme. Return ONLY valid JSON:
{"type":"write_poem","title":"Skriv en dikt","instructions":"Skriv en dikt på minst 8 rader. Den får rimma eller inte — du väljer själv form och stil.","prompt":"Open theme (for example hösten, vänskap, natten, ett minne)","answer_key":"Free task. Grade on how the poem expresses the theme, imagery and word choice, and effort. Any reasonable poem is fine."}`,
  },
};

// ── API helpers ───────────────────────────────────────────────────────────────

function extractJson(raw:string):string{
  const m=raw.match(/\{[\s\S]*\}/);return m?m[0]:raw;
}

async function geminiRaw(key:string,prompt:string,maxTok=1500):Promise<string>{
  const res=await fetch(`${API_BASE}/${MODEL}:generateContent?key=${key}`,{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({systemInstruction:{parts:[{text:playerIdentityPrompt()}]},contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{temperature:0.95,maxOutputTokens:maxTok}}),
  });
  if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error((e as {error?:{message?:string}})?.error?.message??`HTTP ${res.status}`);}
  const d=await res.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text??"";
}

async function geminiChat(key:string,sys:string,history:Msg[],text:string):Promise<string>{
  const contents=[...history.map(m=>({role:m.role,parts:[{text:m.text}]})),{role:"user",parts:[{text}]}];
  const res=await fetch(`${API_BASE}/${MODEL}:generateContent?key=${key}`,{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({systemInstruction:{parts:[{text:`${sys}\n${playerIdentityPrompt()}`}]},contents,generationConfig:{temperature:0.7,maxOutputTokens:700}}),
  });
  if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error((e as {error?:{message?:string}})?.error?.message??`HTTP ${res.status}`);}
  const d=await res.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text??"(inget svar)";
}

async function generateAssignment(key:string):Promise<Assign>{
  const type=ALL_TYPES[Math.floor(Math.random()*ALL_TYPES.length)];
  const raw=await geminiRaw(key,TMETA[type].gen,1600);
  const json=JSON.parse(extractJson(raw));
  const a={...json,type}as Assign;
  if(a.words)a.words=[...a.words].sort(()=>Math.random()-0.5);
  if(a.type==="reorder_sentences"&&a.sentences)a.sentences=[...a.sentences].sort(()=>Math.random()-0.5);
  return a;
}

// ── No-autocorrect props ──────────────────────────────────────────────────────

const noCorr={spellCheck:false,autoCorrect:"off",autoCapitalize:"off",autoComplete:"off"} as const;



// ── Interactive sub-views ─────────────────────────────────────────────────────

function CircleVerbView({text,onChange}:{text:string;onChange:(s:string)=>void}){
  const [sel,setSel]=useState<Set<number>>(new Set());
  const tokens=text.split(/\s+/).filter(Boolean);
  function toggle(i:number){
    const n=new Set(sel);n.has(i)?n.delete(i):n.add(i);setSel(n);
    onChange([...n].sort((a,b)=>a-b).map(idx=>tokens[idx].replace(/[.,!?;:]+$/,"")).join(", "));
  }
  return(
    <div className="flex flex-wrap gap-1 leading-loose">
      {tokens.map((tok,i)=>{const w=tok.replace(/[.,!?;:]+$/,"");const p=tok.slice(w.length);return(
        <span key={i}><button onClick={()=>toggle(i)} className={`rounded px-1 py-0.5 text-xl transition-colors ${sel.has(i)?"bg-accent text-accent-foreground font-bold ring-2 ring-accent":"hover:bg-secondary/60"}`}>{w}</button>{p&&<span className="text-xl">{p}</span>}</span>
      );})}
    </div>
  );
}

function EnEttView({words,onChange}:{words:string[];onChange:(s:string)=>void}){
  const [ans,setAns]=useState<Record<number,"en"|"ett">>({});
  function pick(i:number,v:"en"|"ett"){
    const n={...ans,[i]:v};setAns(n);
    onChange(words.map((w,idx)=>`${n[idx]??"?"} ${w}`).join(", "));
  }
  return(
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {words.map((w,i)=>(
        <div key={i} className="flex items-center gap-2">
          <span className="w-28 text-lg">{w}</span>
          {(["en","ett"]as const).map(v=>(
            <button key={v} onClick={()=>pick(i,v)} className={`rounded-sm border-2 border-border px-3 py-1 font-pixel text-[9px] transition-colors ${ans[i]===v?"bg-primary text-primary-foreground":"bg-card hover:bg-secondary/60"}`}>{v.toUpperCase()}</button>
          ))}
        </div>
      ))}
    </div>
  );
}

function FillBlankView({textWithBlanks,wordBank,onChange}:{textWithBlanks:string;wordBank:string[];onChange:(s:string)=>void}){
  const lines=textWithBlanks.split("\n").filter(Boolean);
  const total=(textWithBlanks.match(/___/g)??[]).length;
  const [fills,setFills]=useState<string[]>(Array(total).fill(""));
  let bc=0;
  function upd(i:number,v:string){const n=[...fills];n[i]=v;setFills(n);onChange(n.map((x,idx)=>`${idx+1}. ${x||"?"}`).join(", "));}
  return(
    <div className="flex flex-col gap-3">
      {lines.map((line,li)=>{
        const parts=line.split("___");
        return(<p key={li} className="text-xl leading-relaxed">{parts.map((p,pi)=>{const idx=bc;if(pi<parts.length-1)bc++;return(<span key={pi}>{p}{pi<parts.length-1&&(<select value={fills[idx]} onChange={e=>upd(idx,e.target.value)} className="mx-1 rounded-sm border-2 border-border bg-secondary/50 px-1 py-0.5 font-pixel text-[9px] outline-none focus:border-ring"><option value="">___</option>{wordBank.map(w=><option key={w} value={w}>{w}</option>)}</select>)}</span>);})}</p>);
      })}
      <div className="flex flex-wrap items-center gap-1 rounded-sm bg-secondary/30 p-2">
        <span className="font-pixel text-[8px] text-muted-foreground mr-1">ORDBANK:</span>
        {wordBank.map(w=><span key={w} className="rounded-sm bg-secondary px-2 py-0.5 font-pixel text-[8px]">{w}</span>)}
      </div>
    </div>
  );
}

function QuestionsView({text,questions,onChange}:{text?:string;questions:string[];onChange:(s:string)=>void}){
  const [ans,setAns]=useState<string[]>(Array(questions.length).fill(""));
  function upd(i:number,v:string){const n=[...ans];n[i]=v;setAns(n);onChange(n.map((a,idx)=>`${idx+1}. ${a}`).join("\n"));}
  return(
    <div className="flex flex-col gap-4">
      {text&&<div className="rounded-sm bg-secondary/40 p-4 text-lg leading-relaxed whitespace-pre-wrap">{text}</div>}
      {questions.map((q,i)=>(
        <div key={i} className="flex flex-col gap-1">
          <span className="font-pixel text-[9px] text-muted-foreground">{q}</span>
          <textarea value={ans[i]} onChange={e=>upd(i,e.target.value)} rows={3} placeholder="Ditt svar…" {...noCorr}
            className="rounded-sm border-2 border-border bg-secondary/50 px-3 py-2 text-base outline-none focus:border-ring resize-none"/>
        </div>
      ))}
    </div>
  );
}

function ConjugateView({verbs,onChange}:{verbs:string[];onChange:(s:string)=>void}){
  const forms=["Presens","Preteritum","Perfekt","Pluskvamperfekt"];
  const [cells,setCells]=useState<string[][]>(verbs.map(()=>["","","",""]));
  function upd(vi:number,fi:number,v:string){const n=cells.map(r=>[...r]);n[vi][fi]=v;setCells(n);onChange(n.map((r,i)=>`${verbs[i]}: ${r.join(" / ")}`).join("\n"));}
  return(
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead><tr className="border-b-2 border-border">
          <th className="py-1 pr-2 text-left font-pixel text-[7px] text-muted-foreground">INFINITIV</th>
          {forms.map(f=><th key={f} className="py-1 px-1 text-left font-pixel text-[7px] text-muted-foreground">{f.toUpperCase()}</th>)}
        </tr></thead>
        <tbody>{verbs.map((v,vi)=>(
          <tr key={vi} className="border-b border-border/50">
            <td className="py-1 pr-2 text-base font-bold whitespace-nowrap">{v}</td>
            {forms.map((_,fi)=>(
              <td key={fi} className="py-1 px-1"><input value={cells[vi][fi]} onChange={e=>upd(vi,fi,e.target.value)} placeholder="…" {...noCorr}
                className="w-full min-w-[72px] rounded-sm border border-border bg-secondary/50 px-2 py-1 text-base outline-none focus:border-ring"/></td>
            ))}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

// ── Grade matrix ──────────────────────────────────────────────────────────────

const GRADE_COLORS:Record<LG,string>={A:"bg-success text-success-foreground",B:"bg-success/70 text-success-foreground",C:"bg-primary text-primary-foreground",D:"bg-warn text-warn-foreground",E:"bg-accent text-accent-foreground",F:"bg-destructive text-destructive-foreground"};

function GradeMatrix({prog}:{prog:Progress}){
  const {grades,currentTerm}=prog;
  const termGs=grades.filter(g=>g.term===currentTerm);
  const graded=termGs.length;
  const tg=termGrade(grades,currentTerm);

  return(
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="font-pixel text-[10px]">TERMIN {currentTerm}</span>
        <span className="font-pixel text-[8px] text-muted-foreground">{graded}/{TERM_LENGTH} BEDÖMDA</span>
      </div>
      <div className="h-2 rounded-sm bg-secondary overflow-hidden">
        <div className="h-2 bg-primary transition-all duration-500" style={{width:`${Math.min(100,(graded/TERM_LENGTH)*100)}%`}}/>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-border">
              <th className="py-1 pr-2 text-left font-pixel text-[7px] text-muted-foreground w-4/6">FÖRMÅGA</th>
              {(["F","E","C","A"]as LG[]).map(g=><th key={g} className="w-7 py-1 text-center font-pixel text-[9px]">{g}</th>)}
              <th className="py-1 pl-2 text-left font-pixel text-[7px] text-muted-foreground">NU</th>
            </tr>
          </thead>
          <tbody>
            {(Object.entries(COMPS)as[CK,string][]).map(([key,name])=>{
              const g=compGrade(grades,key,currentTerm);
              const val=g?GV[g]:-1;
              const count=termGs.filter(e=>e.comps.includes(key)).length;
              return(
                <tr key={key} className="border-b border-border/50">
                  <td className="py-2 pr-2">
                    <span className="font-pixel text-[7px] text-muted-foreground mr-1">{key}</span>
                    <span className="text-xs text-foreground">{name}</span>
                    {count>0&&<span className="ml-1 font-pixel text-[6px] text-muted-foreground">({count})</span>}
                  </td>
                  {(["F","E","C","A"]as LG[]).map(lg=>{
                    const lgv=GV[lg];
                    const lit=g&&g!=="F"&&val>=lgv;
                    const isFail=g==="F"&&lg==="F";
                    return(
                      <td key={lg} className="py-1 text-center">
                        <div className={`mx-auto h-5 w-5 rounded-sm border border-border transition-colors ${lit||isFail?(isFail?"bg-destructive":"bg-success"):"bg-secondary/20"}`}/>
                      </td>
                    );
                  })}
                  <td className="py-1 pl-2">
                    {g?<span className={`inline-block rounded-sm px-1.5 py-0.5 font-pixel text-[9px] ${GRADE_COLORS[g]}`}>{g}</span>
                      :<span className="font-pixel text-[9px] text-muted-foreground">–</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {tg&&(
        <div className="rounded-sm border-2 border-border bg-card p-4 flex flex-col gap-2">
          <span className="font-pixel text-[9px] text-muted-foreground">ÖVNINGSSNITT — PERIOD {currentTerm}</span>
          <div className="flex items-center gap-4">
            <span className={`inline-block rounded-sm px-4 py-2 font-pixel text-[24px] shadow-pixel ${GRADE_COLORS[tg]}`}>{tg}</span>
            <div className="flex flex-col gap-1">
              {(Object.keys(COMPS)as CK[]).map(c=>{const cg=compGrade(grades,c,currentTerm);return cg&&(
                <div key={c} className="flex items-center gap-2">
                  <span className="font-pixel text-[7px] text-muted-foreground w-4">{c}</span>
                  <span className={`inline-block rounded-sm px-1 font-pixel text-[8px] ${GRADE_COLORS[cg]}`}>{cg}</span>
                  <span className="text-xs text-muted-foreground">{COMPS[c]}</span>
                </div>
              );})}
            </div>
          </div>
          {tg==="F"&&<p className="font-pixel text-[8px] text-destructive">⚠ Övningsresultaten visar att du behöver träna mer inom ett eller flera områden.</p>}
        </div>
      )}
    </div>
  );
}

// ── Assignment renderer ───────────────────────────────────────────────────────

function AssignmentView({a,onAnswer}:{a:Assign;onAnswer:(s:string)=>void}){
  const interactive=["circle_verb","en_ett","fill_blank","reading_comprehension","kallkritik","conjugate_verbs","summarize"].includes(a.type);
  return(
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="rounded-sm bg-primary px-2 py-0.5 font-pixel text-[8px] text-primary-foreground">{TMETA[a.type].label.toUpperCase()}</span>
        <span className="rounded-sm bg-secondary px-2 py-0.5 font-pixel text-[7px] text-muted-foreground">{(CMAP[a.type]).join(" · ")}</span>
      </div>
      <h2 className="font-pixel text-[11px] leading-relaxed">{a.title}</h2>
      <p className="text-lg text-muted-foreground whitespace-pre-wrap">{a.instructions}</p>

      {["correct_mistakes","correct_punctuation","word_class"].includes(a.type)&&a.text&&(
        <div className="rounded-sm bg-chalk p-4 text-chalk-foreground text-lg leading-relaxed whitespace-pre-wrap">{a.text}</div>
      )}
      {["translate_sentences","reorder_sentences","plural_forms","past_tense"].includes(a.type)&&a.sentences&&(
        <ol className="flex flex-col gap-2 pl-4">{a.sentences.map((s,i)=><li key={i} className="text-lg list-decimal">{s}</li>)}</ol>
      )}
      {["word_class","find_synonyms"].includes(a.type)&&a.words&&(
        <ul className="flex flex-wrap gap-2">{a.words.map((w,i)=><li key={i} className="rounded-sm border-2 border-border bg-secondary/40 px-3 py-1 text-lg">{w}</li>)}</ul>
      )}
      {a.prompt&&(
        <div className="rounded-sm border-l-4 border-accent bg-secondary/40 px-4 py-3 text-lg italic">{a.prompt}</div>
      )}

      {a.type==="circle_verb"&&a.text&&<CircleVerbView text={a.text} onChange={onAnswer}/>}
      {a.type==="en_ett"&&a.words&&<EnEttView words={a.words} onChange={onAnswer}/>}
      {a.type==="fill_blank"&&a.text_with_blanks&&a.word_bank&&<FillBlankView textWithBlanks={a.text_with_blanks} wordBank={a.word_bank} onChange={onAnswer}/>}
      {(a.type==="reading_comprehension"||a.type==="kallkritik"||a.type==="summarize")&&a.questions&&<QuestionsView text={a.text} questions={a.questions} onChange={onAnswer}/>}
      {a.type==="conjugate_verbs"&&a.verbs&&<ConjugateView verbs={a.verbs} onChange={onAnswer}/>}

      {!interactive&&(
        <textarea onChange={e=>onAnswer(e.target.value)} placeholder="Skriv ditt svar här…" rows={8} {...noCorr}
          className="rounded-sm border-2 border-border bg-secondary/50 px-3 py-2 text-base outline-none focus:border-ring resize-none"/>
      )}
    </div>
  );
}



// ── Main component ────────────────────────────────────────────────────────────────250025002500250025002500250025002500250025002500250025002500250025002500250025002500250025002500250025002500250025002500250025002500250025002500250025002500

export function ClassroomMode({onExit}:{onExit:()=>void}){
  const [key,setKey]=useState("");
  const [keyIn,setKeyIn]=useState("");
  const [keyStatus,setKeyStatus]=useState<"idle"|"testing"|"ok"|"fail">("idle");
  const [keyErr,setKeyErr]=useState("");

  const [assignment,setAssignment]=useState<Assign|null>(null);
  const [genLoad,setGenLoad]=useState(false);
  const [genErr,setGenErr]=useState("");
  const [answer,setAnswer]=useState("");

  const [msgs,setMsgs]=useState<Msg[]>([]);
  const [chatIn,setChatIn]=useState("");
  const [chatLoad,setChatLoad]=useState(false);
  const [prog,setProg]=useState<Progress>({grades:[],currentTerm:1});
  const [showMatrix,setShowMatrix]=useState(false);
  const [showDict,setShowDict]=useState(false);

  const bottomRef=useRef<HTMLDivElement>(null);
  const chatRef=useRef<HTMLInputElement>(null);

  useEffect(()=>{
    const k=loadKey();if(k){setKey(k);setKeyIn(k);setKeyStatus("ok");}
    setProg(loadProg());
  },[]);

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);

  async function testKey(){
    const k=keyIn.trim();if(!k)return;
    setKeyStatus("testing");setKeyErr("");
    try{await geminiRaw(k,"Reply: OK",5);setKey(k);saveKey(k);setKeyStatus("ok");}
    catch(e){setKeyStatus("fail");setKeyErr(e instanceof Error?e.message:"Fel");}
  }

  async function newAssignment(){
    if(!key)return;
    setGenLoad(true);setGenErr("");setAnswer("");setMsgs([]);
    try{setAssignment(await generateAssignment(key));}
    catch(e){setGenErr(e instanceof Error?e.message:"Kunde inte skapa uppgift");}
    finally{setGenLoad(false);}
  }

  function teacherSys(){
    if(!assignment)return"";
    return`You are Läraren, a firm but fair Swedish teacher for årskurs 7 (13-year-olds). You grade exactly the way Skolverket instructs: a holistic judgement against the betygskriterier, giving the grade that best matches the pupil's knowledge — neither generous nor harsh.

${year7AssessmentPrompt()}
${assignment.type === "correct_punctuation" ? punctuationGuidance() : ""}

ASSIGNMENT:
Type: ${TMETA[assignment.type].label}
Title: ${assignment.title}
Instructions: ${assignment.instructions}
${assignment.text?`Text: ${assignment.text}`:""}
${assignment.sentences?`Sentences: ${assignment.sentences.map((x,i)=>`${i+1}. ${x}`).join(" | ")}`:""}
${assignment.words?`Words: ${assignment.words.join(", ")}`:""}
${assignment.verbs?`Verbs: ${assignment.verbs.join(", ")}`:""}
${assignment.word_bank?`Word bank: ${assignment.word_bank.join(", ")}`:""}
${assignment.text_with_blanks?`Text with blanks: ${assignment.text_with_blanks}`:""}
${assignment.questions?`Questions: ${assignment.questions.join(" | ")}`:""}
${assignment.prompt?`Prompt: ${assignment.prompt}`:""}
ANSWER KEY (secret — only use for grading): ${assignment.answer_key}

STUDENT'S WORK:
${answer||(msgs.length?"(se tidigare svar)":"(inget svar ännu)")}

RULES:
- Speak Swedish. Use English only if student writes in English.
- Give hints without revealing answers.
- When grading (betyg/grade requested): follow the ASSESSMENT CONTEXT above over any conflicting answer-key rubric or task requirements. Give an honest A–F practice grade with feedback on criteria relevant to this task. Only when there is sufficient submitted work, end response with EXACTLY this on its own line: [BETYG: X]
- When correcting (rätta): show what was wrong, why, and the correct version.
- Grade using HOW SKOLVERKET SAYS TO GRADE and the YEAR 7 CALIBRATION above, and explain the grade with the value words from the criteria. Do not add requirements the task never asked for (the pupil had freedom), but judge the quality by the criteria. If the work is clearly too short or off-task, say what is missing and what to do next.
- Keep responses focused (max 8 sentences unless grading).`;
  }

  async function sendChat(text:string){
    if(!text.trim()||chatLoad||!key)return;
    setChatIn("");
    const next:Msg[]=[...msgs,{role:"user",text:text.trim()}];
    setMsgs(next);setChatLoad(true);
    try{
      const reply=await geminiChat(key,teacherSys(),msgs,text.trim());
      setMsgs([...next,{role:"model",text:reply}]);
      // Extract grade if present
      const gm=reply.match(/\[BETYG:\s*([ABCDEF])\]/);
      if(gm&&assignment){
        detectAndSaveEnEtt(key, text.trim()); // fire-and-forget
        const grade=gm[1] as LG;
        const entry:GradeEntry={
          id:Date.now().toString(),type:assignment.type,title:assignment.title,
          grade,comps:CMAP[assignment.type],term:prog.currentTerm,ts:Date.now(),
        };
        const newProg={...prog,grades:[...prog.grades,entry]};
        // Advance term if complete
        if(newProg.grades.filter(g=>g.term===prog.currentTerm).length>=TERM_LENGTH){
          newProg.currentTerm=prog.currentTerm+1;
        }
        setProg(newProg);saveProg(newProg);setShowMatrix(true);
      }
    }catch(e){setMsgs([...next,{role:"model",text:`⚠️ ${e instanceof Error?e.message:"Fel"}`}]);}
    finally{setChatLoad(false);setTimeout(()=>chatRef.current?.focus(),50);}
  }

  const hasKey=!!key&&keyStatus!=="fail";
  const termGs=prog.grades.filter(g=>g.term===prog.currentTerm);

  return(
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="pixel-panel flex items-center justify-between gap-2 rounded-sm bg-card p-3">
        <div className="flex items-center gap-2">
          <span className="font-pixel text-[11px] text-primary">KLASSRUMSLÄGE</span>
          <span className="rounded-sm bg-accent px-2 py-0.5 font-pixel text-[8px] text-accent-foreground">BETA</span>
        </div>
        <div className="flex items-center gap-2">
          {hasKey&&<button onClick={()=>setShowDict(s=>!s)} className={`rounded-sm border-2 border-border px-2 py-1.5 font-pixel text-[8px] shadow-pixel-sm active:translate-y-0.5 active:shadow-none ${showDict?"bg-accent text-accent-foreground":"bg-card"}`}>ORDBOK</button>}
          {hasKey&&<button onClick={()=>setShowMatrix(s=>!s)} className="rounded-sm border-2 border-border bg-card px-2 py-1.5 font-pixel text-[8px] shadow-pixel-sm active:translate-y-0.5 active:shadow-none">
            BETYGSMATRIS {termGs.length}/{TERM_LENGTH}
          </button>}
          <button onClick={onExit} className="rounded-sm border-2 border-border bg-card px-3 py-1.5 font-pixel text-[9px] shadow-pixel-sm active:translate-y-0.5 active:shadow-none">KARTAN</button>
        </div>
      </div>

      {/* Key setup */}
      {!hasKey?(
        <div className="pixel-panel flex flex-col gap-3 rounded-sm bg-card p-4">
          <span className="font-pixel text-[9px] text-muted-foreground">GEMINI API-NYCKEL</span>
          <div className="flex flex-wrap gap-2">
            <input type="password" value={keyIn} onChange={e=>{setKeyIn(e.target.value);setKeyStatus("idle");}}
              onKeyDown={e=>e.key==="Enter"&&testKey()} placeholder="AIzaSy..." {...noCorr}
              className="flex-1 rounded-sm border-2 border-border bg-secondary/50 px-3 py-2 text-sm outline-none focus:border-ring"/>
            <button onClick={testKey} disabled={keyStatus==="testing"}
              className="rounded-sm border-2 border-border bg-primary px-4 py-2 font-pixel text-[9px] text-primary-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none disabled:opacity-50">
              {keyStatus==="testing"?"TESTAR…":"TESTA NYCKEL"}
            </button>
          </div>
          {keyStatus==="fail"&&<span className="font-pixel text-[9px] text-destructive">✗ {keyErr}</span>}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="font-pixel text-[8px] text-muted-foreground underline underline-offset-4">Hämta gratis nyckel →</a>
        </div>
      ):(
        <div className="flex items-center justify-between px-1">
          <span className="font-pixel text-[8px] text-success">✓ NYCKEL AKTIV — INGEN STAVNINGSKONTROLL</span>
          <button onClick={()=>{setKey("");setKeyStatus("idle");}} className="font-pixel text-[8px] text-muted-foreground underline underline-offset-4">byt nyckel</button>
        </div>
      )}

      {/* Grade matrix */}
      {hasKey&&showMatrix&&(
        <div className="pixel-panel rounded-sm bg-card p-4">
          <GradeMatrix prog={prog}/>
        </div>
      )}

      {/* Dictionary */}
      {hasKey&&showDict&&(
        <div className="pixel-panel rounded-sm bg-card p-4 flex flex-col gap-3">
          <span className="font-pixel text-[9px] text-muted-foreground">ORDBOK</span>
          <DictionaryPanel apiKey={key}/>
        </div>
      )}

      {/* Assignment */}
      {hasKey&&(
        <div className="pixel-panel flex flex-col gap-4 rounded-sm bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-pixel text-[9px] text-muted-foreground">UPPGIFT</span>
            <button onClick={newAssignment} disabled={genLoad}
              className="rounded-sm border-2 border-border bg-accent px-3 py-1.5 font-pixel text-[9px] text-accent-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none disabled:opacity-50">
              {genLoad?"GENERERAR…":assignment?"NY UPPGIFT":"STARTA LEKTION"}
            </button>
          </div>
          {!assignment&&!genLoad&&<p className="text-muted-foreground">Tryck "Starta lektion" för att få en uppgift. Varje uppgift är unik och genereras på Y7/8-nivå.</p>}
          {genLoad&&<p className="animate-pulse font-pixel text-[9px] text-muted-foreground">Läraren förbereder uppgiften…</p>}
          {genErr&&<p className="font-pixel text-[9px] text-destructive">✗ {genErr}</p>}
          {assignment&&!genLoad&&<AssignmentView a={assignment} onAnswer={setAnswer}/>}
        </div>
      )}

      {/* Chat */}
      {hasKey&&assignment&&(
        <div className="pixel-panel flex flex-col gap-3 rounded-sm bg-card p-4">
          <span className="font-pixel text-[9px] text-muted-foreground">FRÅGA LÄRAREN</span>
          <div className="flex h-64 flex-col gap-3 overflow-y-auto pr-1">
            {msgs.length===0&&<p className="text-muted-foreground italic">Ställ en fråga, be om ledtråd, eller be läraren rätta och betygsätta ditt svar. Betyget (A–F) sparas automatiskt i matrisen.</p>}
            {msgs.map((m,i)=>(
              <div key={i} className={`max-w-[88%] rounded-sm px-3 py-2 text-base ${m.role==="user"?"ml-auto bg-primary text-primary-foreground":"bg-secondary text-foreground"}`}>
                {m.role==="user"
                  ? m.text.replace(/\[BETYG:\s*[ABCDEF]\]/g,"").trim()
                  : <div className="prose prose-sm max-w-none"><ReactMarkdown>{m.text.replace(/\[BETYG:\s*[ABCDEF]\]/g,"").trim()}</ReactMarkdown></div>
                }
              </div>
            ))}
            {chatLoad&&<div className="max-w-[88%] animate-pulse rounded-sm bg-secondary px-3 py-2 font-pixel text-[9px] text-muted-foreground">Läraren skriver…</div>}
            <div ref={bottomRef}/>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["Ge en ledtråd 💡","Rätta mitt svar ✏️","Sätt ett betyg 🎓","Förklara uppgiften 📖"].map(q=>(
              <button key={q} onClick={()=>sendChat(q)} disabled={chatLoad}
                className="rounded-sm border border-border bg-secondary/60 px-2 py-1 font-pixel text-[8px] text-muted-foreground hover:bg-secondary active:translate-y-0.5 disabled:opacity-40">{q}</button>
            ))}
          </div>
          <div className="flex gap-2 border-t border-border pt-3">
            <input ref={chatRef} value={chatIn} onChange={e=>setChatIn(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&sendChat(chatIn)} placeholder="Skriv till läraren…" disabled={chatLoad} {...noCorr}
              className="flex-1 rounded-sm border-2 border-border bg-secondary/50 px-3 py-2 text-base outline-none focus:border-ring disabled:opacity-50"/>
            <button onClick={()=>sendChat(chatIn)} disabled={chatLoad||!chatIn.trim()}
              className="rounded-sm border-2 border-border bg-primary px-4 py-2 font-pixel text-[9px] text-primary-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none disabled:opacity-50">SKICKA</button>
          </div>
        </div>
      )}
    </div>
  );
}
