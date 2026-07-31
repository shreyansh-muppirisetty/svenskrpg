import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { ClassroomMode } from "@/components/ClassroomMode";
import { ClassBook } from "@/components/ClassBook";
import { HardWords } from "@/components/HardWords";
import { EnEllerEtt } from "@/components/EnEllerEtt";
import { WhatsAppMode } from "@/components/WhatsAppMode";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Svenska Quest — Grammar Is the Game" },
      { name: "description", content: "A classroom mode for Swedish practice with AI-generated assignments, a dictionary, teacher chat, and saved grades." },
      { property: "og:title", content: "Svenska Quest — Klassrumsläge" },
      { property: "og:description", content: "Practice Swedish with AI-generated assignments, a dictionary, teacher chat, and saved grades." },
    ],
  }),
  component: Game,
});

type Screen = { view: "map" } | { view: "classroom" } | { view: "classbook" } | { view: "hardwords" } | { view: "enellerett" } | { view: "whatsapp" };

function Game() {
  const [screen, setScreen] = useState<Screen>({ view: "map" });

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-5 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-pixel text-lg leading-relaxed text-primary sm:text-2xl">SVENSKA QUEST</h1>
          <p className="text-muted-foreground">Klassrumsläge · Läraren</p>
        </div>
        <div className="flex gap-2">
          {screen.view !== "map" && (
            <button
              onClick={() => setScreen({ view: "map" })}
              className="rounded-sm border-2 border-border bg-card px-3 py-2 font-pixel text-[9px] shadow-pixel-sm active:translate-y-0.5 active:shadow-none"
            >
              KARTAN
            </button>
          )}
          <Link to="/admin" className="rounded-sm border-2 border-border bg-card px-3 py-2 font-pixel text-[9px] shadow-pixel-sm active:translate-y-0.5 active:shadow-none">
            ADMIN
          </Link>
        </div>
      </header>

      {screen.view === "map" ? (
        <MapScreen
          onClassroom={() => setScreen({ view: "classroom" })}
          onClassBook={() => setScreen({ view: "classbook" })}
          onHardWords={() => setScreen({ view: "hardwords" })}
          onEnEllerEtt={() => setScreen({ view: "enellerett" })}
          onWhatsApp={() => setScreen({ view: "whatsapp" })}
        />
      ) : screen.view === "classroom" ? (
        <ClassroomMode onExit={() => setScreen({ view: "map" })} />
      ) : screen.view === "classbook" ? (
        <ClassBook onExit={() => setScreen({ view: "map" })} />
      ) : screen.view === "hardwords" ? (
        <HardWords onExit={() => setScreen({ view: "map" })} />
      ) : screen.view === "enellerett" ? (
        <EnEllerEtt onExit={() => setScreen({ view: "map" })} />
      ) : (
        <WhatsAppMode onExit={() => setScreen({ view: "map" })} />
      )}

      <footer className="mt-auto pt-4 font-pixel text-[9px] leading-relaxed text-muted-foreground">
        klassrumsläge · klassbok · ordbok · uppgifter · betygsmatris
      </footer>
    </main>
  );
}

function MapScreen({ onClassroom, onClassBook, onHardWords, onEnEllerEtt, onWhatsApp }: { onClassroom: () => void; onClassBook: () => void; onHardWords: () => void; onEnEllerEtt: () => void; onWhatsApp: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <section className="pixel-panel rounded-sm bg-chalk p-5 text-chalk-foreground">
        <p className="text-2xl leading-snug">
          Öva svenska med läraren, slå upp ord och spara dina betyg i klassrumsläget.
        </p>
      </section>

      <button
        onClick={onClassroom}
        className="pixel-panel flex items-center gap-4 rounded-sm bg-card p-4 text-left transition-transform active:translate-y-0.5"
      >
        <span className="font-pixel text-[10px] text-muted-foreground">✦</span>
        <span className="flex-1">
          <span className="flex items-center gap-2">
            <span className="block font-pixel text-[11px] text-foreground">Klassrumsläge</span>
            <span className="rounded-sm bg-accent px-1.5 py-0.5 font-pixel text-[7px] text-accent-foreground">BETA</span>
          </span>
          <span className="block text-lg text-muted-foreground">Chatta fritt med Läraren på svenska.</span>
        </span>
        <span className="font-pixel text-xl text-accent-foreground">→</span>
      </button>

      <button
        onClick={onClassBook}
        className="pixel-panel flex items-center gap-4 rounded-sm bg-card p-4 text-left transition-transform active:translate-y-0.5"
      >
        <span className="font-pixel text-[10px] text-muted-foreground">📖</span>
        <span className="flex-1">
          <span className="flex items-center gap-2">
            <span className="block font-pixel text-[11px] text-foreground">Klassbok</span>
            <span className="rounded-sm bg-accent px-1.5 py-0.5 font-pixel text-[7px] text-accent-foreground">BETA</span>
          </span>
          <span className="block text-lg text-muted-foreground">Läs en bok kapitel för kapitel och bli bedömd.</span>
        </span>
        <span className="font-pixel text-xl text-accent-foreground">→</span>
      </button>
      <button
        onClick={onHardWords}
        className="pixel-panel flex items-center gap-4 rounded-sm bg-card p-4 text-left transition-transform active:translate-y-0.5"
      >
        <span className="font-pixel text-[10px] text-muted-foreground">🃏</span>
        <span className="flex-1">
          <span className="flex items-center gap-2">
            <span className="block font-pixel text-[11px] text-foreground">Svåra Ord</span>
            <span className="rounded-sm bg-accent px-1.5 py-0.5 font-pixel text-[7px] text-accent-foreground">BETA</span>
          </span>
          <span className="block text-lg text-muted-foreground">Repetera uppslagda ord med quiz och matchningsspel.</span>
        </span>
        <span className="font-pixel text-xl text-accent-foreground">→</span>
      </button>
      <button
        onClick={onEnEllerEtt}
        className="pixel-panel flex items-center gap-4 rounded-sm bg-card p-4 text-left transition-transform active:translate-y-0.5"
      >
        <span className="font-pixel text-[10px] text-muted-foreground">🎯</span>
        <span className="flex-1">
          <span className="flex items-center gap-2">
            <span className="block font-pixel text-[11px] text-foreground">En eller Ett</span>
            <span className="rounded-sm bg-accent px-1.5 py-0.5 font-pixel text-[7px] text-accent-foreground">BETA</span>
          </span>
          <span className="block text-lg text-muted-foreground">Öva artiklar — fel en/ett sparas automatiskt.</span>
        </span>
        <span className="font-pixel text-xl text-accent-foreground">→</span>
      </button>
      <button
        onClick={onWhatsApp}
        className="pixel-panel flex items-center gap-4 rounded-sm bg-card p-4 text-left transition-transform active:translate-y-0.5"
      >
        <span className="font-pixel text-[10px] text-muted-foreground">💬</span>
        <span className="flex-1">
          <span className="flex items-center gap-2">
            <span className="block font-pixel text-[11px] text-foreground">WhatsApp</span>
            <span className="rounded-sm bg-accent px-1.5 py-0.5 font-pixel text-[7px] text-accent-foreground">BETA</span>
          </span>
          <span className="block text-lg text-muted-foreground">Chatta med Johnny, Jacob, Sam och klassen.</span>
        </span>
        <span className="font-pixel text-xl text-accent-foreground">→</span>
      </button>
    </div>
  );
}
