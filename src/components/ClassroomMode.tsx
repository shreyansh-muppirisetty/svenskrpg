import { useEffect, useRef, useState } from "react";

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
type DictMode = "sv-sv"|"en-sv"|"sv-en";

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

// ── Assignment prompts (Y7/8, B1+) ───────────────────────────────────────────

const TMETA:Record<AT,{label:string;gen:string}>={
  circle_verb:{label:"Hitta verben",gen:`Y7/8 Swedish B1: paragraph (8–10 sentences) on technology/climate/society with 12–15 verbs: modals (kan/måste/bör/vill/ska), perfect (har/hade + supinum), s-passive, verbs in bisatser. Student must identify ALL including auxiliaries. Return ONLY valid JSON:
{"type":"circle_verb","title":"Hitta ALLA verb","instructions":"Klicka på alla verb — inklusive hjälpverb, s-passiv och verb i bisatser. Det finns [N] verb totalt.","text":"PARAGRAPH","answer_key":"All verbs listed"}`},

  correct_mistakes:{label:"Rätta felen",gen:`Y7/8 Swedish: paragraph (8–10 sentences) with exactly 10 subtle errors: adjective agreement (stark/starkt/starka), V2 violation in main clause, wrong participle form, wrong reflexive pronoun, s-passiv error, wrong preposition, bisats word order error (verb before subject), wrong subjunktion, missing hyphen in compound word, wrong genus. Return ONLY valid JSON:
{"type":"correct_mistakes","title":"Rätta de 10 felen","instructions":"Texten innehåller exakt 10 grammatiska fel. Skriv den korrekta versionen och förklara kortfattat varje ändring.","text":"PARAGRAPH WITH 10 ERRORS","answer_key":"CORRECTED + explanation of each error"}`},

  reading_comprehension:{label:"Läsförståelse",gen:`Y7/8 Swedish B1: 250-word text on nuanced topic (migration, AI ethics, climate justice, mental health) with clear authorial stance. 6 questions: 2 literal, 2 inference (Vad antyder...?), 1 on text structure/purpose, 1 own opinion with textual evidence. Return ONLY valid JSON:
{"type":"reading_comprehension","title":"Läsförståelse och textanalys","instructions":"Läs texten noggrant. Svara i fullständiga meningar och motivera med belägg från texten.","text":"TEXT","questions":["Q1","Q2","Q3","Q4","Q5","Q6"],"answer_key":"Detailed model answers"}`},

  write_story:{label:"Skriv en berättelse",gen:`Y7/8 Swedish creative writing. Vivid, unexpected scenario. Requirements: min 350 ord, miljöbeskrivning med 3 sinnesintryck, inre monolog, 2+ dialoger med korrekt interpunktion, ett tidshopp eller perspektivskifte, varierande meningslängd. Return ONLY valid JSON:
{"type":"write_story","title":"Skriv en berättelse","instructions":"Min 350 ord. Måste innehålla: miljöbeskrivning med minst 3 sinnesintryck, inre monolog, minst 2 dialoger (korrekt interpunktion), ett tidshopp ELLER perspektivskifte, och variation i meningslängd.","prompt":"Specific vivid opening sentence or scenario hook","answer_key":"Rubric: struktur/miljöbeskrivning/dialog/inre monolog/språklig variation (A–F each)"}`},

  kallkritik:{label:"Källkritik",gen:`Y7/8 Swedish: convincing 160-word fake article/post with: unnamed/biased source, cherry-picked stats, emotional manipulation, missing counter-arguments, sensationalist headline. 5 questions applying SVAR (Sändare/Vinkel/Avsikt/Relevans) + identify rhetorical strategies (pathos/ethos/logos). Return ONLY valid JSON:
{"type":"kallkritik","title":"Källkritisk analys — SVAR-modellen","instructions":"Analysera källan med SVAR-modellen och svara på alla fem frågorna.","text":"CONVINCING FAKE ARTICLE","questions":["Vem är sändaren och hur påverkar det trovärdigheten?","Vilken vinkel har texten och vad utelämnas medvetet?","Vad är textens troliga avsikt?","Identifiera ett exempel på pathos, ethos eller logos i texten.","Hur skulle du verifiera påståendena — nämn 2 konkreta metoder."],"answer_key":"Detailed model answers"}`},

  fill_blank:{label:"Fyll i luckorna",gen:`Y7/8 Swedish advanced grammar: 8 sentences with blanks for: subjunktioner (att/eftersom/fast/trots att/för att+infinitiv), prepositioner in fixed phrases, adjective agreement, reflexiva pronomen (sig/mig/dig), particip forms. Word bank: correct + 4 plausible distractors. Return ONLY valid JSON:
{"type":"fill_blank","title":"Avancerade luckor — grammatik","instructions":"Välj rätt ord från ordbanken. Tänk på: adjektivkongruens, prepositioner i fasta fraser, reflexiva pronomen och subjunktioner.","text_with_blanks":"S1 with ___.\nS2 with ___.","word_bank":["w1","w2","w3","w4","w5","w6","w7","w8","d1","d2","d3","d4"],"answer_key":"1. word (grammatical reason)\n..."}`},

  translate_sentences:{label:"Översätt meningarna",gen:`Y7/8 Swedish: 8 complex English→Swedish sentences with: subordinate clauses (since/although/whether), passive voice, V2 rule challenges, idiomatic expressions unique to Swedish. No simple sentences. Return ONLY valid JSON:
{"type":"translate_sentences","title":"Översätt — komplexa meningar","instructions":"Översätt till svenska. Tänk på bisatser, V2-regeln, passiv form och idiomatiska uttryck som inte kan översättas ord för ord.","sentences":["Complex S1","Complex S2","...8 total"],"answer_key":"1. Swedish + note on tricky part\n..."}`},

  word_class:{label:"Ordklasser",gen:`Y7/8 Swedish: 14 words from difficult classes: presensparticip, perfektparticip, konjunktion, subjunktion, interjektion, possessivt pronomen, reflexivt pronomen, partikel, räkneord. Not just basic nouns/verbs. Return ONLY valid JSON:
{"type":"word_class","title":"Ordklasser — avancerade","instructions":"Ange exakt ordklass: substantiv, verb, adjektiv, adverb, pronomen, preposition, konjunktion, subjunktion, interjektion, particip, räkneord, partikel.","words":["w1","w2","...w14"],"answer_key":"1. word = klass (kort motivering)\n..."}`},

  reorder_sentences:{label:"Ordna meningarna",gen:`Y7/8 Swedish: 8 sentences forming a complex narrative with non-obvious order. Include temporal markers (Dessförinnan/Strax därefter/Till slut) and pronoun references that require careful reading. Return ONLY valid JSON:
{"type":"reorder_sentences","title":"Ordna händelseförloppet","instructions":"Sätt de 8 meningarna i rätt ordning. Läs noga — tidmarkörer och pronomenreferenser avslöjar ordningen. Svar som siffror t.ex. 3,7,1,5,2,8,4,6.","sentences":["S1","S2","S3","S4","S5","S6","S7","S8"],"answer_key":"Correct order + explanation of each clue"}`},

  conjugate_verbs:{label:"Böj verben",gen:`Y7/8 Swedish: 8 verbs from groups 1,2a,2b,3,4(irregular) + 2 s-verbs (hoppas/minnas). 5 forms: infinitiv, presens, preteritum, perfekt, pluskvamperfekt. Return ONLY valid JSON:
{"type":"conjugate_verbs","title":"Verbkonjugation — alla fem former","instructions":"Fyll i alla fem former: infinitiv, presens, preteritum, perfekt (har+), pluskvamperfekt (hade+). Tänk på verbgrupp.","verbs":["att skriva","att springa","att köpa","att hoppas","att simma","att be","att veta","att minnas"],"answer_key":"att skriva: skriva/skriver/skrev/har skrivit/hade skrivit\n..."}`},

  en_ett:{label:"En eller ett?",gen:`Year 7 Swedish en/ett: 14 nouns, good mix of en and ett words including some tricky ones. Shuffle them randomly — do NOT group en-words together or ett-words together, they must be interleaved. Return ONLY valid JSON:
{"type":"en_ett","title":"En eller ett?","instructions":"Välj rätt artikel (en eller ett) för varje substantiv.","words":["hus","bil","barn","skola","bord","lampa","träd","dator","klass","lärare","fönster","bok","hjärta","tid"],"answer_key":"ett hus, en bil, ett barn, en skola, ett bord, en lampa, ett träd, en dator, en klass, en lärare, ett fönster, en bok, ett hjärta, en tid"}`},

  write_letter:{label:"Skriv ett brev",gen:`Y7/8 Swedish formal letter. High-stakes realistic scenario: complaint to municipality/school board, formal application, letter to editor, appeal to principal. Min 220 ord. Must follow Swedish formal letter format exactly, professional register (no contractions, correct tilltal), 4+ paragraphs with clear purpose progression. Return ONLY valid JSON:
{"type":"write_letter","title":"Formellt brev","instructions":"Min 220 ord. Följ exakt brevformat: datum, avsändare, mottagare, formell hälsningsfras. Formellt register: inga förkortningar, korrekt tilltal (Ni/du). 4+ stycken med tydlig progression. Formell avslutningsfras.","prompt":"Detailed high-stakes realistic scenario","answer_key":"Rubric: format/register/innehåll-argumentation/grammatik (A–F each)"}`},

  argumentative_text:{label:"Argumenterande text",gen:`Y7/8 Swedish: genuinely controversial debatable topic. Must include: tes (clear thesis in intro), 3 arguments with konkreta belägg (evidence/examples), ett motargument med bemötande (counter-argument + rebuttal), slutsats referencing thesis. Min 300 ord, formal language. Return ONLY valid JSON:
{"type":"argumentative_text","title":"Argumenterande text","instructions":"Min 300 ord, formellt språk. MÅSTE innehålla: tes i inledning, 3 argument med konkreta belägg, ETT motargument med bemötande, och en slutsats som återknyter till tesen. Betygsmaxpoäng kräver att alla delar är genomarbetade.","prompt":"Controversial debate question worth arguing","answer_key":"Rubric: tes/argumentkvalitet+belägg/motargument+bemötande/formalitet/struktur (A–F each)"}`},

  find_synonyms:{label:"Synonymer & nyanser",gen:`Y7/8 Swedish: 8 words. For each: synonym + antonym + explain register/nuance difference (e.g. "arg" vs "upprörd" — more formal, stronger emotion). Include words with deceptive synonyms where meaning subtly shifts. Return ONLY valid JSON:
{"type":"find_synonyms","title":"Synonymer, antonymer och nyansskillnader","instructions":"För varje ord: skriv ett synonym, ett antonym, och förklara kort nyansskillnaden mellan ordet och dess synonym (register, styrka, konnotation, formellt/informellt).","words":["glad","snabb","stor","gammal","varm","lång","tyst","lätt"],"answer_key":"glad: syn=lycklig(mer intensivt/positivt), ant=ledsen; ..."}`},

  correct_punctuation:{label:"Rätta skiljetecknen",gen:`Y7/8 Swedish: paragraph with exactly 12 punctuation errors including: colon misuse, semicolon vs comma, missing comma before att-clause, wrong position around bisatser, missing hyphen in compound word, tankstreck vs bindestreck confusion, missing period, wrong apostrophe, comma in list. Return ONLY valid JSON:
{"type":"correct_punctuation","title":"Rätta 12 skiljeteckenfel","instructions":"Texten har exakt 12 skiljeteckenfel (kolon, semikolon, kommatering vid bisatser, bindestreck, tankstreck, apostrof). Skriv den korrekta versionen OCH förklara varje enskilt fel.","text":"paragraph with 12 errors","answer_key":"CORRECT VERSION\nFel 1: ... (regel)\nFel 2: ..."}`},

  summarize:{label:"Sammanfatta & analysera",gen:`Y7/8 Swedish: 280-word argumentative text with clear authorial perspective/agenda. 5 tasks: 1) summary 60–80 words, 2) identify syfte, 3) tonfall with textual evidence, 4) perspektiv (whose POV, what's excluded), 5) one rhetorical technique identified and explained. Return ONLY valid JSON:
{"type":"summarize","title":"Sammanfatta och analysera text","instructions":"Utför ALLA fem uppgifterna:","text":"COMPLEX ARGUMENTATIVE TEXT WITH CLEAR STANCE","questions":["1. Sammanfatta texten i 60–80 ord med egna ord.","2. Vad är textens syfte?","3. Vilket tonfall har texten? Ge ett konkret belägg.","4. Ur vilket perspektiv är texten skriven — vad utelämnas medvetet?","5. Identifiera en retorisk teknik och förklara hur den används."],"answer_key":"Detailed model answers for all 5"}`},

  write_dialogue:{label:"Skriv en dialog",gen:`Y7/8 Swedish: complex scenario with power imbalance or conflict. Requirements: 16+ repliker, distinct character voices (different registers), subtext (important things NOT said directly), 2+ scenanvisningar in italics, correct Swedish dialogue punctuation (tankstreck —), one unexpected revelation mid-dialogue. Return ONLY valid JSON:
{"type":"write_dialogue","title":"Skriv en realistisk dialog","instructions":"Skriv en dialog: 16+ repliker, tydligt distinkta röster (t.ex. formell vs informell), undertext (viktiga saker sägs inte direkt), minst 2 scenanvisningar i kursiv, korrekt dialogpunktuation (tankstreck, INGA citattecken), och ett oväntat avslöjande.","prompt":"High-stakes scenario with clear power dynamic or unresolved conflict","answer_key":"Rubric: replikantal/karaktärsstemma/undertext/scenanvisningar/interpunktion (A–F each)"}`},

  plural_forms:{label:"Pluralformer",gen:`Y7/8 Swedish: 14 nouns including all 5 declension groups + tricky cases: loanwords (-or/-ar/-er?), compounds, words with identical singular/plural, truly irregular (man/män, mus/möss, fot/fötter). 4 forms each: obestämd sg, bestämd sg, obestämd pl, bestämd pl. Return ONLY valid JSON:
{"type":"plural_forms","title":"Alla fyra böjningsformer","instructions":"Skriv ALLA fyra former: obestämd singular, bestämd singular, obestämd plural, bestämd plural. Sammansatta ord och lånord är extra knepiga!","sentences":["en bil","ett hus","en flicka","ett barn","en man","en mus","en journalist","ett problem","en tid","ett öga","en lärare","ett museum","en hand","en middag"],"answer_key":"en bil / bilen / bilar / bilarna\n..."}`},

  past_tense:{label:"Preteritum & pluskvamperfekt",gen:`Y7/8 Swedish: 8 present-tense sentences. Student rewrites in BOTH preteritum AND pluskvamperfekt, plus brief explanation of when pluskvamperfekt is used. Include group-4 irregular verbs, s-verbs, vowel-change verbs. Return ONLY valid JSON:
{"type":"past_tense","title":"Preteritum och pluskvamperfekt","instructions":"Skriv om i preteritum OCH pluskvamperfekt. Förklara kort när pluskvamperfekt används (handling som avslutats FÖRE en annan dåtidshandling).","sentences":["Pres S1 with irregular verb","Pres S2","...8 total incl irregular + s-verbs"],"answer_key":"S1: Pret: ... / Pluskv: ...\nPlusvamperfekt används när: ..."}`},

  write_poem:{label:"Skriv en dikt",gen:`Y7/8 Swedish advanced poetry. Required form (pick one): sonet (14 rader, ABAB CDCD EFEF GG), villanell (19 rader med refräng), or structured free verse with clear arc. Requirements: 2+ original non-clichéd metaforer, allitteration, enjambment, one paradox or oxymoron, 14+ rader. After poem: 3-sentence poetisk analys explaining 2 conscious compositional choices. Return ONLY valid JSON:
{"type":"write_poem","title":"Avancerad dikt med poetisk analys","instructions":"Skriv en dikt (14+ rader). MÅSTE ha: 2 originella metaforer (inga klichéer), allitteration, enjambment, ett paradox ELLER oxymoron. Välj form: sonet, villanell eller strukturerad fri vers. Bifoga 3 meningars poetisk analys av dina medvetna val.","prompt":"Abstract or challenging theme (identity, time, belonging, loss, transformation, memory)","answer_key":"Rubric: bildspråk-originalitet/formteknik/rytm-enjambment/analys (A–F each)"}`,
  },
};

// ── API helpers ───────────────────────────────────────────────────────────────

function extractJson(raw:string):string{
  const m=raw.match(/\{[\s\S]*\}/);return m?m[0]:raw;
}

async function geminiRaw(key:string,prompt:string,maxTok=1500):Promise<string>{
  const res=await fetch(`${API_BASE}/${MODEL}:generateContent?key=${key}`,{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{temperature:0.95,maxOutputTokens:maxTok}}),
  });
  if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error((e as {error?:{message?:string}})?.error?.message??`HTTP ${res.status}`);}
  const d=await res.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text??"";
}

async function geminiChat(key:string,sys:string,history:Msg[],text:string):Promise<string>{
  const contents=[...history.map(m=>({role:m.role,parts:[{text:m.text}]})),{role:"user",parts:[{text}]}];
  const res=await fetch(`${API_BASE}/${MODEL}:generateContent?key=${key}`,{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({systemInstruction:{parts:[{text:sys}]},contents,generationConfig:{temperature:0.7,maxOutputTokens:700}}),
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

function dictionaryPrompt(word:string,mode:DictMode):string{
  const clean=word.trim();
  if(mode==="sv-sv"){
    return`You are a concise Swedish school dictionary for Year 7/8 students.
Look up the Swedish word or phrase: "${clean}"
Reply in Swedish only. Use this exact format:
Ord: ...
Ordklass: ...
Betydelse: ... (simple Swedish)
Exempel: ... (one natural Swedish sentence)
Liknande ord: ... (2-4 words)
Vanligt misstag: ...`;
  }
  if(mode==="sv-en"){
    return`You are a concise Swedish-to-English school dictionary for Year 7/8 students.
Translate and explain the Swedish word or phrase: "${clean}"
Reply mostly in Swedish, but include the English translation. Use this exact format:
Svenska: ...
English: ...
Ordklass: ...
Betydelse: ... (simple Swedish)
Example: ... (one natural English sentence)
Liknande engelska ord: ... (2-4 English words)
Vanligt misstag: ...`;
  }
  return`You are a concise English-to-Swedish school dictionary for Year 7/8 students.
Translate and explain the English word or phrase: "${clean}"
Reply mostly in Swedish, but include the English source. Use this exact format:
English: ...
Svenska: ...
Ordklass: ...
Betydelse: ... (simple Swedish)
Exempel: ... (one natural Swedish sentence)
Liknande ord: ... (2-4 Swedish words)
Vanligt misstag: ...`;
}

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
          <span className="font-pixel text-[9px] text-muted-foreground">TERMINSBETYG — TERMIN {currentTerm}</span>
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
          {tg==="F"&&<p className="font-pixel text-[8px] text-destructive">⚠ F innebär att du inte nått kunskapskraven i en eller flera förmågor.</p>}
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

// ── Dictionary ────────────────────────────────────────────────────────────────

type DictMode = "sv-sv" | "en-sv";

function DictionaryPanel({apiKey}:{apiKey:string}){
  const [mode,setMode]=useState<DictMode>("sv-sv");
  const [query,setQuery]=useState("");
  const [result,setResult]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const inputRef=useRef<HTMLInputElement>(null);

  async function lookup(){
    const q=query.trim();
    if(!q||loading)return;
    setLoading(true);setResult("");setError("");
    const prompt=mode==="sv-sv"
      ?`Du är en svensk ordbok. Slå upp: "${q}". Ge: ORDKLASS, DEFINITION (på enkel svenska), BÖJNING (viktiga former), EXEMPEL (en mening), SYNONYMER (2-3). Kortfattad.`
      :`Swedish dictionary. Translate English: "${q}". Give: SVENSKA (translation), ORDKLASS, DEFINITION (in simple Swedish), EXEMPEL (both languages), SYNONYMER. Answer in Swedish.`;
    try{
      const res=await fetch(`${API_BASE}/${MODEL}:generateContent?key=${apiKey}`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{temperature:0.2,maxOutputTokens:400}}),
      });
      if(!res.ok)throw new Error(`HTTP ${res.status}`);
      const d=await res.json();
      setResult(d.candidates?.[0]?.content?.parts?.[0]?.text??"(inget svar)");
    }catch(e){setError(e instanceof Error?e.message:"Fel");}
    finally{setLoading(false);}
  }

  return(
    <div className="flex flex-col gap-3">
      <div className="flex gap-1">
        {([["sv-sv","SV → SV"],["en-sv","EN → SV"]] as [DictMode,string][]).map(([m,label])=>(
          <button key={m} onClick={()=>{setMode(m);setResult("");setQuery("");setTimeout(()=>inputRef.current?.focus(),50);}}
            className={`rounded-sm border-2 border-border px-3 py-1.5 font-pixel text-[9px] transition-colors ${mode===m?"bg-primary text-primary-foreground":"bg-card text-muted-foreground hover:bg-secondary/60"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input ref={inputRef} value={query} onChange={e=>setQuery(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&lookup()}
          placeholder={mode==="sv-sv"?"Sök ett svenskt ord…":"Search an English word…"}
          {...noCorr} className="flex-1 rounded-sm border-2 border-border bg-secondary/50 px-3 py-2 text-base outline-none focus:border-ring"/>
        <button onClick={lookup} disabled={loading||!query.trim()}
          className="rounded-sm border-2 border-border bg-accent px-4 py-2 font-pixel text-[9px] text-accent-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none disabled:opacity-50">
          {loading?"…":"SLÅ UPP"}
        </button>
      </div>
      {error&&<p className="font-pixel text-[9px] text-destructive">✗ {error}</p>}
      {result&&(
        <div className="rounded-sm bg-secondary/40 p-4 text-base leading-relaxed whitespace-pre-wrap">
          <div className="mb-2 font-pixel text-[9px] text-muted-foreground">{mode==="sv-sv"?"🇸🇪 SV → SV":"🇬🇧 EN → SV"} — {query}</div>
          {result}
        </div>
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
  const [dictMode,setDictMode]=useState<DictMode>("sv-sv");
  const [dictIn,setDictIn]=useState("");
  const [dictResult,setDictResult]=useState("");
  const [dictLoad,setDictLoad]=useState(false);
  const [dictErr,setDictErr]=useState("");

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
    return`You are Läraren, a firm but encouraging Swedish teacher for Year 7/8 students (B1 level).

ASSIGNMENT:
Type: ${TMETA[assignment.type].label}
Title: ${assignment.title}
Instructions: ${assignment.instructions}
${assignment.text?`Text: ${assignment.text}`:""}
${assignment.sentences?`Sentences: ${assignment.sentences.join(" | ")}`:""}
${assignment.questions?`Questions: ${assignment.questions.join(" | ")}`:""}
${assignment.prompt?`Prompt: ${assignment.prompt}`:""}
ANSWER KEY (secret — only use for grading): ${assignment.answer_key}

STUDENT'S WORK:
${answer||(msgs.length?"(se tidigare svar)":"(inget svar ännu)")}

RULES:
- Speak Swedish. Use English only if student writes in English.
- Give hints without revealing answers. Challenge the student.
- When grading (betyg/grade requested): grade strictly using A–F with specific feedback per criterion. Be honest — do not inflate grades. End response with EXACTLY this on its own line: [BETYG: X]
- When correcting (rätta): show what was wrong, why, and the correct version.
- Hold students to B1 standard. If work is insufficient, say so clearly.
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

  async function searchDictionary(){
    const word=dictIn.trim();
    if(!word||dictLoad||!key)return;
    setDictLoad(true);setDictErr("");setDictResult("");
    try{setDictResult(await geminiRaw(key,dictionaryPrompt(word,dictMode),420));}
    catch(e){setDictErr(e instanceof Error?e.message:"Kunde inte slå upp ordet");}
    finally{setDictLoad(false);}
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

      {/* Dictionary */}
      {hasKey&&(
        <div className="pixel-panel flex flex-col gap-3 rounded-sm bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-pixel text-[9px] text-muted-foreground">DICTIONARY</span>
            <div className="flex gap-1 rounded-sm border-2 border-border bg-secondary/50 p-1">
              {([
                ["sv-sv","SVENSKA → SVENSKA"],
                ["sv-en","SVENSKA → ENGLISH"],
                ["en-sv","ENGLISH → SVENSKA"],
              ] as [DictMode,string][]).map(([mode,label])=>(
                <button key={mode} onClick={()=>setDictMode(mode)}
                  className={`rounded-sm px-2 py-1 font-pixel text-[7px] ${dictMode===mode?"bg-primary text-primary-foreground":"text-muted-foreground hover:bg-secondary"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <input value={dictIn} onChange={e=>setDictIn(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&searchDictionary()}
              placeholder={dictMode==="en-sv"?"Search an English word…":"Slå upp ett svenskt ord…"}
              disabled={dictLoad} {...noCorr}
              className="flex-1 rounded-sm border-2 border-border bg-secondary/50 px-3 py-2 text-base outline-none focus:border-ring disabled:opacity-50"/>
            <button onClick={searchDictionary} disabled={dictLoad||!dictIn.trim()}
              className="rounded-sm border-2 border-border bg-accent px-3 py-2 font-pixel text-[9px] text-accent-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none disabled:opacity-50">
              {dictLoad?"SÖKER…":"SLÅ UPP"}
            </button>
          </div>
          {dictErr&&<p className="font-pixel text-[9px] text-destructive">✗ {dictErr}</p>}
          {dictResult&&(
            <div className="rounded-sm bg-chalk p-3 text-chalk-foreground whitespace-pre-wrap">
              {dictResult}
            </div>
          )}
        </div>
      )}

      {/* Chat */}
      {hasKey&&assignment&&(
        <div className="pixel-panel flex flex-col gap-3 rounded-sm bg-card p-4">
          <span className="font-pixel text-[9px] text-muted-foreground">FRÅGA LÄRAREN</span>
          <div className="flex h-64 flex-col gap-3 overflow-y-auto pr-1">
            {msgs.length===0&&<p className="text-muted-foreground italic">Ställ en fråga, be om ledtråd, eller be läraren rätta och betygsätta ditt svar. Betyget (A–F) sparas automatiskt i matrisen.</p>}
            {msgs.map((m,i)=>(
              <div key={i} className={`max-w-[88%] rounded-sm px-3 py-2 text-base whitespace-pre-wrap ${m.role==="user"?"ml-auto bg-primary text-primary-foreground":"bg-secondary text-foreground"}`}>
                {m.text.replace(/\[BETYG:\s*[ABCDEF]\]/g,"").trim()}
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
