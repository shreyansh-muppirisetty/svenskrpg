import { type Zone, type Challenge } from "./zones";

export type NpcTurn = {
  npc_swedish: string;
  npc_english_hint: string;
  expected_answer: string;
  ordered_tiles: string[];
  distractor_tiles: string[];
  rule: Challenge["rule"];
};

export type EvaluationResult = {
  is_correct: boolean;
  fluency_delta: number;
  grammar_feedback: string;
  improved_answer: string;
  conversation_complete?: boolean;
};

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type Provider = "gemini" | "groq";

export const AI_PROVIDER_KEY = "svenska-quest-ai-provider";
export const GEMINI_KEY_STORAGE = "svenska-quest-gemini-key";

export function getAiProvider(): Provider {
  try {
    return (localStorage.getItem(AI_PROVIDER_KEY) as Provider) || "gemini";
  } catch {
    return "gemini";
  }
}

export function setAiProvider(provider: Provider) {
  try {
    localStorage.setItem(AI_PROVIDER_KEY, provider);
  } catch {
    /* ignore */
  }
}

export function getGeminiApiKey(): string | null {
  try {
    const local = localStorage.getItem(GEMINI_KEY_STORAGE);
    if (local && local.trim()) return local.trim();
    return import.meta.env.VITE_GEMINI_API_KEY || null;
  } catch {
    return null;
  }
}

export function setGeminiApiKey(key: string) {
  try {
    if (key.trim()) localStorage.setItem(GEMINI_KEY_STORAGE, key.trim());
    else localStorage.removeItem(GEMINI_KEY_STORAGE);
  } catch {
    /* ignore */
  }
}

export const GROQ_MODEL_KEY = "svenska-quest-groq-model";
export const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant";

export function getGroqModel(): string {
  try {
    return localStorage.getItem(GROQ_MODEL_KEY) || DEFAULT_GROQ_MODEL;
  } catch {
    return DEFAULT_GROQ_MODEL;
  }
}

export function setGroqModel(model: string) {
  try {
    localStorage.setItem(GROQ_MODEL_KEY, model);
  } catch {
    /* ignore */
  }
}

export const GROQ_KEY_STORAGE = "svenska-quest-groq-key";

export function getGroqApiKey(): string | null {
  try {
    const local = localStorage.getItem(GROQ_KEY_STORAGE);
    if (local && local.trim()) return local.trim();
    return import.meta.env.VITE_GROQ_API_KEY || null;
  } catch {
    return null;
  }
}

export function setGroqApiKey(key: string) {
  try {
    if (key.trim()) localStorage.setItem(GROQ_KEY_STORAGE, key.trim());
    else localStorage.removeItem(GROQ_KEY_STORAGE);
  } catch {
    /* ignore */
  }
}

async function callGeminiJson<T>(messages: ChatMessage[]): Promise<T | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-exp"];

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents,
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.7,
              maxOutputTokens: 400,
            },
          }),
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`Gemini model ${model} failed (${res.status}):`, errText);
        continue;
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) continue;
      return JSON.parse(text) as T;
    } catch (err) {
      console.error(`Error with Gemini model ${model}:`, err);
    }
  }
  return null;
}

async function callGroqJson<T>(messages: ChatMessage[], retries = 3): Promise<T | null> {
  const apiKey = getGroqApiKey();
  if (!apiKey) return null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: getGroqModel(),
          messages,
          response_format: { type: "json_object" },
          temperature: 0.6,
          max_tokens: 250,
        }),
      });

      if (res.status === 429) {
        const backoffMs = Math.pow(2, attempt) * 1500 + Math.random() * 500;
        console.warn(`Groq Rate limit hit (429). Retrying in ${Math.round(backoffMs)}ms... (Attempt ${attempt + 1}/${retries})`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }

      if (!res.ok) {
        console.error("Groq API error:", await res.text());
        return null;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) return null;
      return JSON.parse(content) as T;
    } catch (err) {
      console.error("Failed to call Groq API:", err);
      if (attempt === retries - 1) return null;
    }
  }
  return null;
}

async function callAiJson<T>(messages: ChatMessage[]): Promise<T | null> {
  const provider = getAiProvider();
  if (provider === "gemini") {
    return callGeminiJson<T>(messages);
  }
  return callGroqJson<T>(messages);
}

const ZONE_SYSTEM_PROMPTS: Record<string, string> = {
  klassrummet:
    "You are Fröken Grammatik, a strict but encouraging Swedish grammar teacher in a classroom setting. You drill V2 word order and question structure (Frågeordföljd). Always speak in clear, simple Swedish suited for beginners.",
  matsalen:
    "You are Kökschefen Berit, a impatient cafeteria manager serving lunch to students. You test V2 word order under pressure and food items/modal verbs. Speak energetic Swedish.",
  korridoren:
    "You are Vaktmästaren Olle, a hallway custodian who demands proper en/ett gender usage and definite forms before giving hallway access. Speak friendly, grounded Swedish.",
  affären:
    "You are Kassören Nils, a shop clerk at a grocery store testing polite modal verbs (kan jag få, vill ha) and transaction Swedish.",
  festen:
    "You are Klasskompisen Saga, a friend at a student party testing subordinate clauses (bisatser with eftersom, att, om, när). Speak casual student Swedish.",
};

/**
 * Pass A: Generate the next NPC turn and dynamic challenge target
 */
export async function generateNpcTurn(
  zone: Zone,
  history: { role: "npc" | "player"; text: string }[]
): Promise<NpcTurn | null> {
  const systemPrompt = `${ZONE_SYSTEM_PROMPTS[zone.id] ?? "You are a friendly Swedish NPC in a RPG."}
You are driving a Swedish language learning RPG conversation.
Generate the next conversation turn for the NPC along with expected answer data.

Return ONLY a JSON object matching this exact schema:
{
  "npc_swedish": "NPC's speech in Swedish (1-2 sentences)",
  "npc_english_hint": "Task for the player in English (e.g., 'Say: My name is Alex.')",
  "expected_answer": "Clean Swedish reference answer (lowercase, no punctuation)",
  "ordered_tiles": ["jag", "heter", "Alex"],
  "distractor_tiles": ["du", "vad", "varför"],
  "rule": "questions"
}

Allowed rules: "questions", "v2", "gender", "modal", "bisats".
ordered_tiles must be exact words of expected_answer in order.
distractor_tiles must be 2-4 extra relevant Swedish words that don't belong in the answer.`;

  const contextMessages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history.slice(-3).map((h) => ({
      role: h.role === "npc" ? ("assistant" as const) : ("user" as const),
      content: h.text,
    })),
  ];

  return callAiJson<NpcTurn>(contextMessages);
}

/**
 * Pass B: Evaluate the player's actual response against the NPC turn context
 */
export async function evaluateUserResponse(
  zone: Zone,
  npcTurn: NpcTurn,
  userAnswer: string
): Promise<EvaluationResult | null> {
  const systemPrompt = `You are an expert Swedish language evaluator for an RPG game.
Evaluate the player's Swedish response to the NPC.

NPC said: "${npcTurn.npc_swedish}"
Task was: "${npcTurn.npc_english_hint}"
Expected answer pattern: "${npcTurn.expected_answer}"
Target grammar rule: "${npcTurn.rule}"

Player submitted: "${userAnswer}"

Analyze if the player's response is grammatically correct and fits the conversation.
Return ONLY a JSON object matching this exact schema:
{
  "is_correct": true or false,
  "fluency_delta": 12 for correct, -9 for incorrect,
  "grammar_feedback": "Brief 1-sentence Swedish or English feedback explaining why it's right/wrong or highlighting V2/en/ett rules.",
  "improved_answer": "Natural correct Swedish phrasing",
  "conversation_complete": false
}`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userAnswer },
  ];

  return callAiJson<EvaluationResult>(messages);
}
