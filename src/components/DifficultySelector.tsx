import { useState, useEffect } from "react";
import { getGroqApiKey, setGroqApiKey, getGroqModel, setGroqModel } from "@/game/ai";

export type Difficulty = "easy" | "medium" | "hard";

type Props = {
  current: Difficulty;
  onChange: (diff: Difficulty) => void;
};

export function DifficultySelector({ current, onChange }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("llama-3.1-8b-instant");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    const k = getGroqApiKey() ?? "";
    setApiKey(k);
    setHasKey(!!k);
    setSelectedModel(getGroqModel());
  }, []);

  function handleSaveKey() {
    setGroqApiKey(apiKey);
    setHasKey(!!apiKey.trim());
    setShowKeyInput(false);
  }

  function handleModelChange(m: string) {
    setSelectedModel(m);
    setGroqModel(m);
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
          <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
            <div className="flex flex-wrap items-center gap-2">
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
            <div className="flex items-center gap-2 mt-1">
              <span className="font-pixel text-[8px] text-muted-foreground">MODELL:</span>
              <select
                value={selectedModel}
                onChange={(e) => handleModelChange(e.target.value)}
                className="rounded-sm border-2 border-border bg-secondary/50 px-2 py-1 font-pixel text-[9px] outline-none"
              >
                <option value="llama-3.1-8b-instant">llama-3.1-8b-instant (Snabb + 131k TPM gräns - Rekommenderas)</option>
                <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile (Smartare + 12k TPM stram gräns)</option>
              </select>
            </div>
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
