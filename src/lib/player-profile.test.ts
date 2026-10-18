import { test } from "node:test";
import assert from "node:assert/strict";
import { PLAYER_NAME_KEY, loadPlayerName, savePlayerName, playerIdentityPrompt } from "./player-profile";

test("first visit needs a name and the saved name survives returning", () => {
  const values = new Map<string, string>();
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  } });
  try {
    assert.equal(loadPlayerName(), "");
    assert.throws(() => savePlayerName("   "));
    assert.equal(savePlayerName("  Carjun  Carvangular  "), "Carjun Carvangular");
    assert.equal(values.get(PLAYER_NAME_KEY), "Carjun Carvangular");
    assert.equal(loadPlayerName(), "Carjun Carvangular");
    assert.ok(playerIdentityPrompt().includes('"Carjun Carvangular"'));
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("characters receive the chosen name, not an invented player identity", () => {
  assert.ok(playerIdentityPrompt("Alex").includes('chosen name is "Alex"'));
  assert.ok(playerIdentityPrompt("Maja").includes('chosen name is "Maja"'));
  assert.equal(playerIdentityPrompt(""), "");
});