import { useState, useEffect } from "react";
import { getGroqApiKey, setGroqApiKey } from "@/game/ai";

export type Difficulty = "easy" | "medium" | "hard";

type Props = {
  current: Difficulty;
  onChange: (diff: Difficulty) => void;
};

export function DifficultySelector({ current, onChange }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    const k = getGroqApiKey() ?? "";
    setApiKey(k);
    setHasKey(!!k);
  }, []);

  function handleSaveKey() {
    setGroqApiKey(apiKey);
    setHasKey(!!apiKey.trim());
    setShowKeyInput(false);
  }

  const options: { id: Difficulty; label: string; desc: string }[] = [
    { id: "easy", label: "LÄTT", desc: "Ordkort (Tiles)" },
    { id: "medium", label: "MEDEL", desc: "Skriv själv (Text)" },
    { id: "hard", label: "SVÅR", desc: "Live Röst (Voice)" },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Groq API Key Browser Storage Section */}
      <div className="pixel-panel rounded-sm bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-pixel text-[9px] text-primary">GROQ AI NYCKEL</span>
            <span className={`rounded-sm px-2 py-0.5 font-pixel text-[8px] ${hasKey ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}`}>
              {hasKey ? "AKTIV (SPARAD I WEBBLÄSAREN)" : "EJ ANGIVEN (FALLBACK-LÄGE)"}
            </span>
          </div>
          <button
            onClick={() => setShowKeyInput(!showKeyInput)}
            className="font-pixel text-[9px] text-muted-foreground underline underline-offset-4"
          >
            {showKeyInput ? "DÖLJ" : hasKey ? "ÄNDRA NYCKEL" : "LÄGG TILL GROQ-NYCKEL"}
          </button>
        </div>

        {showKeyInput && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Klistra in din Groq API Key (gsk_...)"
              className="flex-1 rounded-sm border-2 border-border bg-secondary/50 px-3 py-2 text-sm outline-none focus:border-ring"
            />
            <button
              onClick={handleSaveKey}
              className="rounded-sm border-2 border-border bg-primary px-3 py-2 font-pixel text-[9px] text-primary-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none"
            >
              SPARA I WEBBLÄSAREN
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-pixel text-[10px] text-muted-foreground">SVÅRIGHETSGRAD</span>
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => {
            const active = current === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => onChange(opt.id)}
                className={`flex-1 rounded-sm border-2 border-border p-2 text-left transition-transform active:translate-y-0.5 ${
                  active
                    ? "bg-primary text-primary-foreground shadow-pixel-sm"
                    : "bg-card text-foreground hover:bg-secondary/60"
                }`}
              >
                <span className="block font-pixel text-[10px]">{opt.label}</span>
                <span className={`block text-xs ${active ? "text-primary-foreground/90" : "text-muted-foreground"}`}>
                  {opt.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
