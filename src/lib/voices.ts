// Gender-aware TTS voice picking for the class roster.

const FEMALE = new Set([
  "Emma", "Ella", "Maja", "Olivia", "Sofia", "Klara", "Alice", "Astrid", "Wilma", "Alma",
]);

const MALE = new Set([
  "Alex", "Hugo", "Viggo", "Sam", "Jacob", "Johnny", "Noah", "Lucas", "William", "Oscar",
  "Leo", "Filip", "Elias", "Isak", "Nils",
]);

/** OpenAI TTS voices grouped by perceived gender. */
const MALE_VOICES = ["echo", "onyx", "ash", "verse"];
const FEMALE_VOICES = ["nova", "shimmer", "coral", "sage"];

function hash(name: string) {
  let h = 0;
  for (const c of name) h = ((h << 5) - h + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export function genderOf(name: string): "male" | "female" {
  const n = (name || "").trim();
  if (FEMALE.has(n)) return "female";
  if (MALE.has(n)) return "male";
  // Swedish first names ending in -a/-in are usually female.
  return /(a|in|ie)$/i.test(n) ? "female" : "male";
}

/** Deterministic voice for a character, always matching their gender. */
export function voiceFor(name: string): string {
  const pool = genderOf(name) === "female" ? FEMALE_VOICES : MALE_VOICES;
  return pool[hash(name) % pool.length];
}
