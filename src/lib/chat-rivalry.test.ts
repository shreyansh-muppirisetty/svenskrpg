import { test } from "node:test";
import assert from "node:assert/strict";
import { migrateRivalState, resolveRivalExchange, rivalMaySpeak, RIVAL_COOLDOWN_MS, isPushback } from "./chat-rivalry";

test("Viggo becomes Mahmet in saved contacts, messages, mentions and presence", () => {
  const saved = migrateRivalState({ added: ["Viggo"], presence: ["Viggo", "Maja"], convos: { viggo: [{ text: "@Viggo hej", sender: "Viggo" }] } });
  assert.deepEqual(saved.added, ["Mahmet"]);
  assert.deepEqual(saved.presence, ["Mahmet", "Maja"]);
  assert.equal(saved.convos?.mahmet[0].text, "@Mahmet hej");
  assert.equal(saved.convos?.mahmet[0].sender, "Mahmet");
  assert.equal(saved.convos?.viggo, undefined);
});
test("Mahmet joins only occasionally, but can be mentioned while available", () => {
  assert.equal(rivalMaySpeak(0, 1, false, 0.1), true);
  assert.equal(rivalMaySpeak(0, 1, false, 0.5), false);
  assert.equal(rivalMaySpeak(0, 1, true, 0.9), true);
});
test("classmates push back at Mahmet instead of siding with him or blaming the player", () => {
  const result = resolveRivalExchange([{ name: "Mahmet", text: "du är dålig" }, { name: "Elias", text: "sluta bråka båda två" }, { name: "Mahmet", text: "mer tjat" }], ["Elias", "Maja"], true);
  assert.deepEqual(result.lines.map(l => l.name), ["Mahmet", "Elias", "Maja", "Mahmet"]);
  assert.equal(result.lines[1].againstMahmet, true);
  assert.equal(result.lines[2].againstMahmet, true);
  assert.equal(result.lines.some(l => l.text === "sluta bråka båda två"), false);
});
test("when flamed Mahmet says håll käften once and leaves", () => {
  const result = resolveRivalExchange([{ name: "Mahmet", text: "en lång comeback" }], ["Maja"], true, isPushback("lägg av @Mahmet"));
  assert.deepEqual(result.lines, [{ name: "Mahmet", text: "håll käften", type: "text" }]);
  assert.equal(result.left, true);
});
test("after leaving Mahmet cannot respond or rejoin, even with a mention", () => {
  assert.equal(rivalMaySpeak(RIVAL_COOLDOWN_MS, 1, true, 0), false);
  const result = resolveRivalExchange([{ name: "Mahmet", text: "tillbaka" }, { name: "Maja", text: "hej" }], ["Maja"], false);
  assert.deepEqual(result.lines.map(l => l.name), ["Maja"]);
});