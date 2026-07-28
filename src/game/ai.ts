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

const GROQ_MODEL = "llama-3.3-70b-versatile";

function getApiKey(): string | null {
  try {
    return import.meta.env.VITE_GROQ_API_KEY || null;
  } catch {
    return null;
  }
}

async function callGroqJson<T>(messages: ChatMessage[]): Promise<T | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 600,
      }),
    });

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
    return null;
  }
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
    ...history.slice(-6).map((h) => ({
      role: h.role === "npc" ? ("assistant" as const) : ("user" as const),
      content: h.text,
    })),
  ];

  return callGroqJson<NpcTurn>(contextMessages);
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

  return callGroqJson<EvaluationResult>(messages);
}
