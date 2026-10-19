import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  ORAL_TYPES, isOralType, oralNeedsSlides, formatClock, countWords, speakingStats, paceLabel, lengthVerdict, buildOralWork,
} from "./oral";

describe("oral helpers", () => {
  it("knows the oral types and when slides are used", () => {
    for (const t of ORAL_TYPES) assert.equal(isOralType(t), true);
    assert.equal(isOralType("write_story"), false);
    assert.equal(oralNeedsSlides("oral_presentation"), "required");
    assert.equal(oralNeedsSlides("oral_speech"), "optional");
    assert.equal(oralNeedsSlides("oral_story"), "none");
  });
  it("formats time and counts words", () => {
    assert.equal(formatClock(0), "0:00");
    assert.equal(formatClock(125), "2:05");
    assert.equal(formatClock(-4), "0:00");
    assert.equal(countWords("  hej   på  dig "), 3);
    assert.equal(countWords(""), 0);
  });
  it("measures pace only when there is enough time", () => {
    assert.deepEqual(speakingStats("ett två tre fyra fem sex", 3), { words: 6, wpm: 0, seconds: 3 });
    assert.equal(speakingStats(Array(120).fill("ord").join(" "), 60).wpm, 120);
    assert.equal(paceLabel(0), "går inte att mäta");
    assert.equal(paceLabel(60), "mycket långsamt");
    assert.equal(paceLabel(100), "lugnt");
    assert.equal(paceLabel(140), "lagom");
    assert.equal(paceLabel(190), "snabbt");
    assert.equal(paceLabel(260), "mycket snabbt");
  });
  it("treats 70–130 % of the target as fitting", () => {
    assert.equal(lengthVerdict(60, 120), "för kort");
    assert.equal(lengthVerdict(90, 120), "lagom");
    assert.equal(lengthVerdict(150, 120), "lagom");
    assert.equal(lengthVerdict(200, 120), "för lång");
  });
  it("builds the work text the teacher grades", () => {
    const work = buildOralWork({
      title: "Min hobby", targetSeconds: 120, seconds: 100, transcript: " Hej alla. Idag pratar jag om fotboll ",
      typedInstead: false, presentationText: "Presentation: \"x\" (2 bilder)", planNotes: "inledning, tre skäl, slut",
    });
    assert.match(work, /Uppgift: Min hobby/);
    assert.match(work, /Faktisk tid: 1:40 \(lagom\)/);
    assert.match(work, /Hjälpmedel: bilder/);
    assert.match(work, /Elevens stödord: inledning/);
    assert.match(work, /felhörningar/);
    assert.match(work, /"""\nHej alla\. Idag pratar jag om fotboll\n"""/);
    const typed = buildOralWork({ title: "t", targetSeconds: 90, seconds: 90, transcript: "hej", typedInstead: true });
    assert.match(typed, /elevens egen nedskrivning/);
    assert.match(typed, /inga bilder/);
  });
});
