export type Difficulty = "easy" | "medium" | "hard";

type Props = {
  current: Difficulty;
  onChange: (diff: Difficulty) => void;
};

export function DifficultySelector({ current, onChange }: Props) {
  const options: { id: Difficulty; label: string; desc: string }[] = [
    { id: "easy", label: "LÄTT", desc: "Ordkort (Tiles)" },
    { id: "medium", label: "MEDEL", desc: "Skriv själv (Text)" },
    { id: "hard", label: "SVÅR", desc: "Live Röst (Voice)" },
  ];

  return (
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
  );
}
