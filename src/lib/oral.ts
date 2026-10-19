/** Helpers for oral (muntliga) assignments. Browser-safe, no React. */

export const ORAL_TYPES = ["oral_presentation", "oral_speech", "oral_story"] as const;
export type OralType = (typeof ORAL_TYPES)[number];

export function isOralType(t: string): t is OralType {
  return (ORAL_TYPES as readonly string[]).includes(t);
}

/** Slides are required for a presentation, optional for a speech and not used for storytelling. */
export function oralNeedsSlides(t: string): "required" | "optional" | "none" {
  if (t === "oral_presentation") return "required";
  if (t === "oral_speech") return "optional";
  return "none";
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export function speakingStats(transcript: string, seconds: number) {
  const words = countWords(transcript);
  const wpm = seconds >= 5 ? Math.round((words / seconds) * 60) : 0;
  return { words, wpm, seconds: Math.max(0, Math.round(seconds)) };
}

export function paceLabel(wpm: number): string {
  if (wpm <= 0) return "går inte att mäta";
  if (wpm < 80) return "mycket långsamt";
  if (wpm < 110) return "lugnt";
  if (wpm <= 170) return "lagom";
  if (wpm <= 200) return "snabbt";
  return "mycket snabbt";
}

/** Within 70–130 % of the target time counts as fitting. */
export function lengthVerdict(seconds: number, target: number): "för kort" | "lagom" | "för lång" {
  if (target <= 0) return "lagom";
  if (seconds < target * 0.7) return "för kort";
  if (seconds > target * 1.3) return "för lång";
  return "lagom";
}

export function buildOralWork(args: {
  title: string;
  targetSeconds: number;
  seconds: number;
  transcript: string;
  typedInstead: boolean;
  presentationText?: string;
  planNotes?: string;
}): string {
  const { words, wpm, seconds } = speakingStats(args.transcript, args.seconds);
  const lines = [
    "MUNTLIG UPPGIFT — underlag för bedömning",
    `Uppgift: ${args.title}`,
    `Mål: ca ${args.targetSeconds} sekunder · Faktisk tid: ${formatClock(seconds)} (${lengthVerdict(seconds, args.targetSeconds)})`,
    `Antal ord: ${words} · Tempo: ${wpm > 0 ? `${wpm} ord/min (${paceLabel(wpm)})` : paceLabel(wpm)}`,
    args.presentationText ? `Hjälpmedel: bilder\n${args.presentationText}` : "Hjälpmedel: inga bilder",
    args.planNotes?.trim() ? `Elevens stödord: ${args.planNotes.trim()}` : "",
    args.typedInstead
      ? "Texten nedan är elevens egen nedskrivning av vad hen sa (mikrofonen fångade ingenting)."
      : "Texten nedan är automatisk tal-till-text och kan innehålla felhörningar.",
    `TRANSKRIPTION:\n"""\n${args.transcript.trim()}\n"""`,
  ];
  return lines.filter(Boolean).join("\n");
}
