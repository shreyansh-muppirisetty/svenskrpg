import { supabase } from "@/integrations/supabase/client";
import { ZONES, type Challenge, type Zone } from "./zones";

export type ZoneRow = {
  id: string;
  slug: string;
  name: string;
  npc: string;
  blurb: string;
  time_limit: number;
  intro: string;
  outro: string;
  challenges: unknown;
  sort_order: number;
  published: boolean;
};

export const DEFAULT_STARTING_FLUENCY = 50;

function coerceChallenges(raw: unknown): Challenge[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c) => ({
      npc: String(c.npc ?? ""),
      task: String(c.task ?? ""),
      rule: (["questions", "v2", "gender", "modal", "bisats"].includes(String(c.rule))
        ? c.rule
        : "v2") as Challenge["rule"],
      mode: (c.mode === "type" ? "type" : "tiles") as Challenge["mode"],
      answer: String(c.answer ?? ""),
      alt: Array.isArray(c.alt) ? c.alt.map(String) : undefined,
      hint: String(c.hint ?? ""),
    }))
    .filter((c) => c.answer.trim().length > 0);
}

export function rowToZone(row: ZoneRow): Zone {
  return {
    id: row.slug,
    name: row.name,
    npc: row.npc,
    blurb: row.blurb,
    timeLimit: row.time_limit,
    intro: row.intro,
    outro: row.outro,
    challenges: coerceChallenges(row.challenges),
  };
}

export type GameContent = { zones: Zone[]; startingFluency: number };

/** Built-in zones first, then admin-authored zones ordered by sort_order. */
export async function fetchGameContent(): Promise<GameContent> {
  const [zonesRes, settingsRes] = await Promise.all([
    supabase
      .from("custom_zones")
      .select("*")
      .eq("published", true)
      .order("sort_order", { ascending: true }),
    supabase.from("game_settings").select("starting_fluency").eq("id", 1).maybeSingle(),
  ]);

  const extra = ((zonesRes.data as ZoneRow[] | null) ?? [])
    .map(rowToZone)
    .filter((z) => z.challenges.length > 0);

  return {
    zones: [...ZONES, ...extra],
    startingFluency: settingsRes.data?.starting_fluency ?? DEFAULT_STARTING_FLUENCY,
  };
}
