import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  TEMPLATES, LAYOUTS, MAX_SLIDES, createPresentation, addSlide, removeSlide, duplicateSlide, moveSlide,
  updateSlide, bulletsOf, wordCount, presentationToText, parsePresentations, loadPresentations,
  savePresentations, upsertPresentation, deletePresentation, PRESENTATIONS_KEY,
} from "./presentation";

describe("presentation templates", () => {
  it("every template builds a valid presentation with unique slide ids", () => {
    for (const t of TEMPLATES) {
      const p = createPresentation(t.id);
      assert.ok(p.slides.length >= 1, t.id);
      assert.equal(new Set(p.slides.map((s) => s.id)).size, p.slides.length);
      for (const s of p.slides) assert.ok(LAYOUTS.some((l) => l.id === s.layout));
    }
  });
  it("falls back to the blank template and keeps a custom title", () => {
    assert.equal(createPresentation("nope").slides.length, 1);
    assert.equal(createPresentation("topic", "  Fotboll  ").title, "Fotboll");
    assert.equal(createPresentation("topic", "   ").title, "Det här gillar jag");
  });
});

describe("editing slides", () => {
  it("adds after the chosen slide and respects the slide limit", () => {
    let p = createPresentation("topic");
    const n = p.slides.length;
    p = addSlide(p, "quote", 0);
    assert.equal(p.slides.length, n + 1);
    assert.equal(p.slides[1].layout, "quote");
    while (p.slides.length < MAX_SLIDES) p = addSlide(p, "blank");
    assert.equal(addSlide(p, "blank").slides.length, MAX_SLIDES);
  });
  it("never removes the last slide", () => {
    const p = createPresentation("blank");
    assert.equal(removeSlide(p, 0).slides.length, 1);
    const q = createPresentation("topic");
    assert.equal(removeSlide(q, 0).slides.length, q.slides.length - 1);
  });
  it("duplicates with a fresh id and moves within bounds", () => {
    let p = createPresentation("topic");
    p = duplicateSlide(p, 1);
    assert.equal(p.slides[1].title, p.slides[2].title);
    assert.notEqual(p.slides[1].id, p.slides[2].id);
    const first = p.slides[0].id;
    p = moveSlide(p, 0, 99);
    assert.equal(p.slides[p.slides.length - 1].id, first);
    assert.equal(moveSlide(p, -1, 0), p);
  });
  it("updates one slide without touching the others", () => {
    const p = createPresentation("topic");
    const q = updateSlide(p, 1, { title: "Ny" });
    assert.equal(q.slides[1].title, "Ny");
    assert.equal(q.slides[0], p.slides[0]);
    assert.equal(updateSlide(p, 99, { title: "x" }), p);
  });
});

describe("text helpers", () => {
  it("turns body text into bullets", () => {
    assert.deepEqual(bulletsOf("- ett\n• två\n\n  * tre\n– fyra\nfem"), ["ett", "två", "tre", "fyra", "fem"]);
  });
  it("counts words and exports a plain-text version for the teacher", () => {
    let p = createPresentation("blank");
    p = updateSlide(p, 0, { title: "Min hund", body: "Den heter Sixten", notes: "hemligt manus", image: "data:image/jpeg;base64,AAA" });
    assert.equal(wordCount(p), 5);
    const text = presentationToText(p);
    assert.match(text, /Bild 1 \(Titel\)/);
    assert.match(text, /rubrik: Min hund/);
    assert.match(text, /bild: ja/);
    assert.match(text, /talarstöd: ja/);
    assert.doesNotMatch(text, /hemligt manus/);
  });
});

describe("safe storage", () => {
  it("ignores garbage and repairs odd data", () => {
    assert.deepEqual(parsePresentations(null), []);
    assert.deepEqual(parsePresentations("not json"), []);
    assert.deepEqual(parsePresentations('{"a":1}'), []);
    const out = parsePresentations(JSON.stringify([
      { title: "  ", themeId: "pink", slides: [{ layout: "weird", title: 5, image: "javascript:alert(1)" }] },
      { title: "tom", slides: [] },
      "x",
    ]));
    assert.equal(out.length, 1);
    assert.equal(out[0].title, "Utan titel");
    assert.equal(out[0].themeId, "chalk");
    assert.equal(out[0].slides[0].layout, "blank");
    assert.equal(out[0].slides[0].title, "");
    assert.equal(out[0].slides[0].image, "");
  });
  it("round-trips through a storage object and reports a full quota", () => {
    const data = new Map<string, string>();
    const ok = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
    const p = createPresentation("topic");
    assert.equal(savePresentations(ok, [p]), true);
    assert.ok(data.has(PRESENTATIONS_KEY));
    assert.equal(loadPresentations(ok)[0].slides.length, p.slides.length);
    const full = { getItem: () => null, setItem: () => { throw new Error("QuotaExceededError"); } };
    assert.equal(savePresentations(full, [p]), false);
  });
  it("upserts newest first and deletes by id", () => {
    const a = { ...createPresentation("blank"), updatedAt: 1 };
    const b = { ...createPresentation("topic"), updatedAt: 2 };
    let list = upsertPresentation([], a);
    list = upsertPresentation(list, b);
    assert.equal(list[0].id, b.id);
    list = upsertPresentation(list, { ...a, title: "Ändrad", updatedAt: 3 });
    assert.equal(list.length, 2);
    assert.equal(list[0].title, "Ändrad");
    assert.equal(deletePresentation(list, a.id).length, 1);
  });
});
