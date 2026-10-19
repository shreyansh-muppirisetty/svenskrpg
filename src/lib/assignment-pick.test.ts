import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { pickAssignmentType, ORAL_COOLDOWN } from "./assignment-pick";
import { isOralType } from "./oral";

const TYPES = [
  "verbs", "correct_mistakes", "reading_comprehension", "write_story", "kallkritik", "fill_blank",
  "translate_sentences", "word_class", "en_ett", "write_letter", "argumentative_text", "analyze_fiction",
  "language_use", "correct_punctuation", "summarize", "write_dialogue", "plural_forms", "write_poem",
  "oral_presentation", "oral_speech", "oral_story",
] as const;

// Small deterministic random generator so the test never flakes.
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function oralShare(recent: string[], draws = 20000) {
  const rand = seeded(42);
  let oral = 0;
  for (let i = 0; i < draws; i++) if (isOralType(pickAssignmentType(TYPES, recent, rand))) oral++;
  return oral / draws;
}

describe("assignment type picker", () => {
  it("makes oral tasks rare but still possible", () => {
    const share = oralShare([]);
    assert.ok(share > 0.03 && share < 0.09, `share was ${share}`);
  });
  it("never repeats an oral task within the cooldown", () => {
    assert.equal(oralShare(["oral_story"]), 0);
    // still blocked when the oral task is the oldest of the last ORAL_COOLDOWN assignments
    assert.equal(oralShare(["oral_speech", ...Array(ORAL_COOLDOWN - 1).fill("verbs")]), 0);
    // allowed again once ORAL_COOLDOWN written tasks have passed
    assert.ok(oralShare(["oral_speech", ...Array(ORAL_COOLDOWN).fill("verbs")]) > 0);
  });
  it("still picks every written type", () => {
    const rand = seeded(7);
    const seen = new Set<string>();
    for (let i = 0; i < 4000; i++) seen.add(pickAssignmentType(TYPES, [], rand));
    for (const t of TYPES) assert.ok(seen.has(t), t);
  });
  it("copes with a list that is only oral tasks", () => {
    assert.equal(isOralType(pickAssignmentType(["oral_story"], ["oral_story"])), true);
  });
});
