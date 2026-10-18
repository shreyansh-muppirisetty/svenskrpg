/** Browser-safe rivalry rules shared by chat selection, response processing and tests. */
export const RIVAL_NAME = "Mahmet";
export const RIVAL_REPLY = "håll käften";
export const RIVAL_COOLDOWN_MS = 10 * 60 * 1000;
export const RIVAL_PARTICIPATION_CHANCE = 0.12;

export const rivalryGuidance = `Mahmet only occasionally joins; he is rude to the player when he does. Every other classmate sides with the player against Mahmet's rudeness, including Elias and Leo: call out Mahmet specifically, never support him, never blame the player, never tell both sides to stop fighting. If Mahmet insults the player, classmates present push back against him. After anyone flames or calls him out, Mahmet replies ONLY "håll käften" and goes offline immediately, with no further messages in this exchange. Mark classmates' pushback with "againstMahmet":true in group JSON. Do not revive old drama after he has left.`;

export function renameRival(text: string): string {
  return text.replace(/\bviggo\b/gi, RIVAL_NAME);
}

export function rivalMaySpeak(until: number, now: number, mentioned = false, random = Math.random()): boolean {
  return now >= until && (mentioned || random < RIVAL_PARTICIPATION_CHANCE);
}

export function isPushback(text: string): boolean {
  return /håll\s+(?:käften|käft)|(?:håll|h[aå]ll)\s+tyst|shut up|lägg av|sluta|ingen frågade|vem frågade|pinsamm|tönt|idiot|käften|du är (?:jobbig|patetisk|dum)|skärp dig|lämna|dra härifrån/i.test(text);
}

export interface RivalLine {
  name: string; text: string; type?: string; imageDesc?: string; duration?: string; againstMahmet?: boolean;
}

/** Complete a confrontation once, then drop all further rival messages. */
export function resolveRivalExchange(lines: RivalLine[], defenders: string[], allowRival: boolean, playerPushback = false): { lines: RivalLine[]; left: boolean } {
  const clean = lines.filter(l => l && typeof l.name === "string" && typeof l.text === "string")
    .map(l => ({ ...l, name: renameRival(l.name), text: renameRival(l.text) }));
  if (!allowRival) return { lines: clean.filter(l => l.name !== RIVAL_NAME), left: false };
  if (playerPushback) return { lines: [...clean.filter(l => l.name !== RIVAL_NAME), { name: RIVAL_NAME, text: RIVAL_REPLY, type: "text" }], left: true };
  const first = clean.findIndex(l => l.name === RIVAL_NAME);
  if (first < 0) return { lines: clean, left: false };
  const before = clean.slice(0, first).filter(l => !l.againstMahmet);
  const insult = clean[first];
  const generated = clean.slice(first + 1).filter(l => l.name !== RIVAL_NAME && l.againstMahmet);
  const responses = defenders.filter(n => n !== RIVAL_NAME && n !== "Du").map((name, i) =>
    generated.find(l => l.name === name) ?? { name, text: ["lägg av Mahmet, ingen frågade dig", "Mahmet du gör bara bort dig", "sluta vara taskig Mahmet, det är pinsamt"][i % 3], type: "text", againstMahmet: true });
  return { lines: [...before, insult, ...responses, { name: RIVAL_NAME, text: RIVAL_REPLY, type: "text" }], left: true };
}

export function migrateRivalState<T extends { sender?: string; text: string }>(saved: { convos?: Record<string, T[]>; presence?: string[]; added?: string[]; left?: number; rivalAwayUntil?: number }) {
  const convos: Record<string, T[]> = {};
  for (const [id, messages] of Object.entries(saved.convos ?? {})) {
    const nextId = id === "viggo" ? "mahmet" : id;
    convos[nextId] = [...(convos[nextId] ?? []), ...messages.map(m => ({ ...m, sender: m.sender ? renameRival(m.sender) : undefined, text: renameRival(m.text) }))];
  }
  return { ...saved, convos: saved.convos ? convos : undefined, presence: saved.presence?.map(renameRival), added: saved.added ? [...new Set(saved.added.map(renameRival))] : undefined };
}