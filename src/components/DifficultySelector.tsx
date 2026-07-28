import { useState, useEffect } from "react";
import {
  getAiProvider,
  setAiProvider,
  getGeminiApiKey,
  setGeminiApiKey,
  getGroqApiKey,
  setGroqApiKey,
  getGroqModel,
  setGroqModel,
  type Provider,
} from "@/game/ai";

export type Difficulty = "easy" | "medium" | "hard";

type Props = {
  current: Difficulty;
  onChange: (diff: Difficulty) => void;
};

export function DifficultySelector({ current, onChange }: Props) {
  const [provider, setProviderState] = useState<Provider>("gemini");
  const [geminiKey, setGeminiKeyState] = useState("");
  const [groqKey, setGroqKeyState] = useState("");
  const [selectedGroqModel, setSelectedGroqModel] = useState("llama-3.1-8b-instant");
  const [showKeyInput, setShowKeyInput] = useState(false);

  useEffect(() => {
    setProviderState(getAiProvider());
    setGeminiKeyState(getGeminiApiKey() ?? "");
    setGroqKeyState(getGroqApiKey() ?? "");
    setSelectedGroqModel(getGroqModel());
  }, []);

  function handleProviderChange(p: Provider) {
    setProviderState(p);
    setAiProvider(p);
  }

  function handleSaveGeminiKey() {
    setGeminiApiKey(geminiKey);
    setShowKeyInput(false);
  }

  function handleSaveGroqKey() {
    setGroqApiKey(groqKey);
    setShowKeyInput(false);
  }

  function handleGroqModelChange(m: string) {
    setSelectedGroqModel(m);
    setGroqModel(m);
  }

  const activeKey = provider === "gemini" ? geminiKey : groqKey;

  const options: { id: Difficulty; label: string; desc: string }[] = [
    { id: "easy", label: "LÄTT", desc: "Ordkort (Tiles)" },
    { id: "medium", label: "MEDEL", desc: "Skriv själv (Text)" },
    { id: "hard", label: "SVÅR", desc: "Live Röst (Voice)" },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* AI Provider & Key Manager */}
      <div className="pixel-panel rounded-sm bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-pixel text-[9px] text-primary">AI-LEVERANTÖR</span>
            <div className="flex rounded-sm border border-border p-0.5 bg-secondary/40">
              <button
                onClick={() => handleProviderChange("gemini")}
                className={`px-2 py-0.5 font-pixel text-[8px] rounded-xs ${
                  provider === "gemini" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                GEMINI FLASH (REKOMMENDERAS)
              </button>
              <button
                onClick={() => handleProviderChange("groq")}
                className={`px-2 py-0.5 font-pixel text-[8px] rounded-xs ${
                  provider === "groq" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                GROQ
              </button>
            </div>
          </div>
          <button
            onClick={() => setShowKeyInput(!showKeyInput)}
            className="font-pixel text-[9px] text-muted-foreground underline underline-offset-4"
          >
            {showKeyInput ? "DÖLJ" : activeKey ? "INSTÄLLNINGAR" : "LÄGG TILL NYCKEL"}
          </button>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className={`rounded-sm px-2 py-0.5 font-pixel text-[8px] ${activeKey ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}`}>
            {activeKey
              ? `${provider.toUpperCase()} NYCKEL AKTIV`
              : `INGEN ${provider.toUpperCase()} NYCKEL (FALLBACK-LÄGE)`}
          </span>
          {provider === "gemini" && (
            <span className="font-pixel text-[8px] text-muted-foreground">
              (1 000 000 TPM gräns · Ingen rate limit)
            </span>
          )}
        </div>

        {showKeyInput && (
          <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
            {provider === "gemini" ? (
              <div className="flex flex-col gap-2">
                <span className="font-pixel text-[8px] text-muted-foreground">
                  GEMINI API-NYCKEL (GRATIS PÅ AISTUDIO.GOOGLE.COM):
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="password"
                    value={geminiKey}
                    onChange={(e) => setGeminiKeyState(e.target.value)}
                    placeholder="Klistra in Gemini API Key (AIzaSy...)"
                    className="flex-1 rounded-sm border-2 border-border bg-secondary/50 px-3 py-2 text-sm outline-none focus:border-ring"
                  />
                  <button
                    onClick={handleSaveGeminiKey}
                    className="rounded-sm border-2 border-border bg-primary px-3 py-2 font-pixel text-[9px] text-primary-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none"
                  >
                    SPARA GEMINI NYCKEL
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <span className="font-pixel text-[8px] text-muted-foreground">GROQ API-NYCKEL:</span>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="password"
                    value={groqKey}
                    onChange={(e) => setGroqKeyState(e.target.value)}
                    placeholder="Klistra in Groq API Key (gsk_...)"
                    className="flex-1 rounded-sm border-2 border-border bg-secondary/50 px-3 py-2 text-sm outline-none focus:border-ring"
                  />
                  <button
                    onClick={handleSaveGroqKey}
                    className="rounded-sm border-2 border-border bg-primary px-3 py-2 font-pixel text-[9px] text-primary-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none"
                  >
                    SPARA GROQ NYCKEL
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-pixel text-[8px] text-muted-foreground">GROQ MODELL:</span>
                  <select
                    value={selectedGroqModel}
                    onChange={(e) => handleGroqModelChange(e.target.value)}
                    className="rounded-sm border-2 border-border bg-secondary/50 px-2 py-1 font-pixel text-[9px] outline-none"
                  >
                    <option value="llama-3.1-8b-instant">llama-3.1-8b-instant (Snabb + 131k TPM gräns)</option>
                    <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile (12k TPM stram gräns)</option>
                  </select>
                </div>
              </div>
            )}
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
