import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { normalizePlayerName, savePlayerName } from "@/lib/player-profile";

export function PlayerNameSetup({ onComplete }: { onComplete: (name: string) => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    try {
      onComplete(savePlayerName(name));
    } catch {
      setError("Namnet kunde inte sparas. Tillåt lagring på enheten och försök igen.");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-8 px-4 py-8">
      <h1 className="font-pixel text-lg leading-relaxed text-primary sm:text-2xl">SVENSKA QUEST</h1>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <h2 className="font-pixel text-sm leading-relaxed">VAD HETER DU?</h2>
        <label htmlFor="player-name" className="text-xl">Ditt namn</label>
        <input
          id="player-name"
          name="name"
          autoComplete="given-name"
          autoFocus
          required
          value={name}
          onChange={(event) => { setName(event.target.value); setError(""); }}
          className="w-full rounded-sm border-2 border-border bg-card px-4 py-3 text-2xl text-foreground outline-none focus:border-ring"
        />
        {error && <p role="alert" className="text-destructive">{error}</p>}
        <Button type="submit" disabled={!normalizePlayerName(name)} className="h-12 self-start rounded-sm border-2 border-border px-5 font-pixel text-[10px] shadow-pixel-sm">
          BÖRJA SPELA <ArrowRight aria-hidden="true" />
        </Button>
      </form>
    </main>
  );
}