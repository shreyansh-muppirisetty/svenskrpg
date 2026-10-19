import { isOralType } from "./oral";

/** Each oral type counts as this share of a normal exercise when the next one is drawn. */
export const ORAL_WEIGHT = 0.35;
/** No oral exercise is drawn if one of this many latest assignments was oral. */
export const ORAL_COOLDOWN = 10;

/**
 * Picks the next exercise type. Oral tasks take real preparation time, so they come up
 * rarely (about 1 draw in 17 when eligible) and never twice within ORAL_COOLDOWN assignments.
 * `recent` lists earlier assignment types, oldest first.
 */
export function pickAssignmentType<T extends string>(
  all: readonly T[],
  recent: readonly string[] = [],
  rand: () => number = Math.random,
): T {
  const oralRecently = recent.slice(-ORAL_COOLDOWN).some(isOralType);
  const pool = all
    .map((type) => ({ type, weight: isOralType(type) ? (oralRecently ? 0 : ORAL_WEIGHT) : 1 }))
    .filter((x) => x.weight > 0);
  const candidates = pool.length ? pool : all.map((type) => ({ type, weight: 1 }));
  const total = candidates.reduce((n, x) => n + x.weight, 0);
  let roll = rand() * total;
  for (const x of candidates) {
    roll -= x.weight;
    if (roll < 0) return x.type;
  }
  return candidates[candidates.length - 1].type;
}
