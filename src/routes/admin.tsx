import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ZoneRow } from "@/game/remote";
import { DEFAULT_STARTING_FLUENCY } from "@/game/remote";
import { ADMIN_UNLOCK_KEY } from "@/game/zones";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Adminpanel — Svenska Quest" },
      {
        name: "description",
        content: "Add new Svenska Quest zones and change the starting fluency for every player.",
      },
      { property: "og:title", content: "Adminpanel — Svenska Quest" },
      { property: "og:description", content: "Manage zones and game settings for Svenska Quest." },
    ],
  }),
  component: Admin,
});

type Draft = {
  slug: string;
  name: string;
  npc: string;
  blurb: string;
  time_limit: number;
  intro: string;
  outro: string;
  sort_order: number;
  published: boolean;
  challengesText: string;
};

const EMPTY: Draft = {
  slug: "",
  name: "",
  npc: "",
  blurb: "",
  time_limit: 0,
  intro: "",
  outro: "",
  sort_order: 100,
  published: true,
  challengesText: `[
  {
    "npc": "Hej! Vad heter du?",
    "task": "Say: My name is Alex.",
    "rule": "questions",
    "mode": "tiles",
    "answer": "jag heter Alex",
    "hint": "Subject – verb – rest."
  }
]`,
};

function Admin() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [fluency, setFluency] = useState(DEFAULT_STARTING_FLUENCY);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [unlockAll, setUnlockAll] = useState<boolean>(false);

  useEffect(() => {
    try {
      setUnlockAll(localStorage.getItem(ADMIN_UNLOCK_KEY) === "true");
    } catch {
      /* ignore */
    }
  }, []);

  function toggleUnlockAll(val: boolean) {
    setUnlockAll(val);
    try {
      if (val) localStorage.setItem(ADMIN_UNLOCK_KEY, "true");
      else localStorage.removeItem(ADMIN_UNLOCK_KEY);
    } catch {
      /* ignore */
    }
  }

  const refresh = useCallback(async () => {
    const [z, s] = await Promise.all([
      supabase.from("custom_zones").select("*").order("sort_order", { ascending: true }),
      supabase.from("game_settings").select("starting_fluency").eq("id", 1).maybeSingle(),
    ]);
    setZones((z.data as ZoneRow[] | null) ?? []);
    setFluency(s.data?.starting_fluency ?? DEFAULT_STARTING_FLUENCY);
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      setEmail(data.user.email ?? null);
      const { data: admin } = await supabase.rpc("has_role", {
        _user_id: data.user.id,
        _role: "admin",
      });
      setIsAdmin(!!admin);
      if (admin) await refresh();
      setReady(true);
    })();
  }, [navigate, refresh]);

  async function claim() {
    const { data, error } = await supabase.rpc("claim_admin");
    if (error) return setNote(error.message);
    if (data) {
      setIsAdmin(true);
      await refresh();
      setNote("Du är nu admin.");
    } else {
      setNote("Det finns redan en admin. Be den bjuda in dig.");
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function saveSettings() {
    const value = Math.min(100, Math.max(1, Math.round(fluency)));
    const { error } = await supabase
      .from("game_settings")
      .update({ starting_fluency: value })
      .eq("id", 1);
    setNote(error ? error.message : `Startflyt sparat: ${value}%.`);
  }

  async function saveZone() {
    let challenges: unknown;
    try {
      challenges = JSON.parse(draft.challengesText);
    } catch {
      return setNote("Challenges måste vara giltig JSON (en lista).");
    }
    if (!Array.isArray(challenges) || challenges.length === 0) {
      return setNote("Lägg till minst en challenge.");
    }
    if (!draft.slug.trim() || !draft.name.trim()) {
      return setNote("Slug och namn krävs.");
    }
    const payload = {
      slug: draft.slug.trim(),
      name: draft.name.trim(),
      npc: draft.npc,
      blurb: draft.blurb,
      time_limit: Number(draft.time_limit) || 0,
      intro: draft.intro,
      outro: draft.outro,
      sort_order: Number(draft.sort_order) || 100,
      published: draft.published,
      challenges,
    };
    const { error } = editing
      ? await supabase.from("custom_zones").update(payload).eq("id", editing)
      : await supabase.from("custom_zones").insert(payload);
    if (error) return setNote(error.message);
    setNote(editing ? "Zon uppdaterad." : "Zon tillagd.");
    setDraft(EMPTY);
    setEditing(null);
    await refresh();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("custom_zones").delete().eq("id", id);
    setNote(error ? error.message : "Zon borttagen.");
    await refresh();
  }

  function edit(z: ZoneRow) {
    setEditing(z.id);
    setDraft({
      slug: z.slug,
      name: z.name,
      npc: z.npc,
      blurb: z.blurb,
      time_limit: z.time_limit,
      intro: z.intro,
      outro: z.outro,
      sort_order: z.sort_order,
      published: z.published,
      challengesText: JSON.stringify(z.challenges, null, 2),
    });
  }

  if (!ready) {
    return <main className="p-8 font-pixel text-[10px] text-muted-foreground">LADDAR…</main>;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-5 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-pixel text-sm leading-relaxed text-primary">ADMINPANEL</h1>
          <p className="text-muted-foreground">{email}</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/"
            className="rounded-sm border-2 border-border bg-card px-3 py-2 font-pixel text-[9px] shadow-pixel-sm"
          >
            SPELET
          </Link>
          <button
            onClick={signOut}
            className="rounded-sm border-2 border-border bg-card px-3 py-2 font-pixel text-[9px] shadow-pixel-sm"
          >
            LOGGA UT
          </button>
        </div>
      </header>

      {note && <p className="pixel-panel rounded-sm bg-card p-3 text-lg">{note}</p>}

      {!isAdmin ? (
        <section className="pixel-panel rounded-sm bg-card p-5">
          <p className="text-xl">Ditt konto är inte admin ännu.</p>
          <button
            onClick={claim}
            className="mt-4 rounded-sm border-2 border-border bg-primary px-4 py-2 font-pixel text-[10px] text-primary-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none"
          >
            BLI ADMIN
          </button>
          <p className="mt-2 text-sm text-muted-foreground">
            Fungerar bara om ingen admin finns än.
          </p>
        </section>
      ) : (
        <>
          <section className="pixel-panel rounded-sm bg-card p-5">
            <h2 className="font-pixel text-[11px]">ADMIN-INSTÄLLNINGAR</h2>
            <p className="mt-1 text-lg text-muted-foreground">
              Välj om alla zoner ska låsas upp direkt utan att behöva klara tidigare zoner.
            </p>
            <div className="mt-4 flex flex-col gap-4">
              <label className="flex items-center gap-3 text-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={unlockAll}
                  onChange={(e) => toggleUnlockAll(e.target.checked)}
                  className="h-5 w-5 accent-primary"
                />
                <span>Lås upp alla zoner för admin / alla spelare på denna enhet</span>
              </label>
              
              <div className="border-t border-border pt-4">
                <span className="font-pixel text-[10px] block mb-1">STARTFLYT</span>
                <p className="text-lg text-muted-foreground mb-2">
                  Flytet spelare börjar varje zon med (1–100).
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={fluency}
                    onChange={(e) => setFluency(Number(e.target.value))}
                    className="w-28 rounded-sm border-2 border-border bg-secondary/50 px-3 py-2 text-xl outline-none focus:border-ring"
                  />
                  <button
                    onClick={saveSettings}
                    className="rounded-sm border-2 border-border bg-primary px-4 py-2 font-pixel text-[10px] text-primary-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none"
                  >
                    SPARA
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="pixel-panel rounded-sm bg-card p-5">
            <h2 className="font-pixel text-[11px]">{editing ? "REDIGERA ZON" : "NY ZON"}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Slug (unik id)" value={draft.slug} onChange={(v) => setDraft({ ...draft, slug: v })} />
              <Field label="Namn" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />
              <Field label="NPC" value={draft.npc} onChange={(v) => setDraft({ ...draft, npc: v })} />
              <Field label="Blurb" value={draft.blurb} onChange={(v) => setDraft({ ...draft, blurb: v })} />
              <Field label="Intro" value={draft.intro} onChange={(v) => setDraft({ ...draft, intro: v })} />
              <Field label="Outro" value={draft.outro} onChange={(v) => setDraft({ ...draft, outro: v })} />
              <Field
                label="Tidsgräns (s, 0 = ingen)"
                type="number"
                value={String(draft.time_limit)}
                onChange={(v) => setDraft({ ...draft, time_limit: Number(v) })}
              />
              <Field
                label="Ordning"
                type="number"
                value={String(draft.sort_order)}
                onChange={(v) => setDraft({ ...draft, sort_order: Number(v) })}
              />
            </div>

            <label className="mt-3 flex items-center gap-2 text-lg">
              <input
                type="checkbox"
                checked={draft.published}
                onChange={(e) => setDraft({ ...draft, published: e.target.checked })}
              />
              Publicerad
            </label>

            <label className="mt-3 block">
              <span className="font-pixel text-[9px] text-muted-foreground">CHALLENGES (JSON)</span>
              <textarea
                rows={12}
                value={draft.challengesText}
                onChange={(e) => setDraft({ ...draft, challengesText: e.target.value })}
                className="mt-1 w-full rounded-sm border-2 border-border bg-secondary/50 p-3 font-mono text-sm outline-none focus:border-ring"
              />
            </label>
            <p className="mt-1 text-sm text-muted-foreground">
              Fält per challenge: npc, task, rule (questions | v2 | gender | modal | bisats), mode
              (tiles | type), answer, hint, alt (valfri lista).
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={saveZone}
                className="rounded-sm border-2 border-border bg-primary px-4 py-2 font-pixel text-[10px] text-primary-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none"
              >
                {editing ? "SPARA ÄNDRINGAR" : "LÄGG TILL ZON"}
              </button>
              {editing && (
                <button
                  onClick={() => {
                    setEditing(null);
                    setDraft(EMPTY);
                  }}
                  className="font-pixel text-[10px] text-muted-foreground underline underline-offset-4"
                >
                  avbryt
                </button>
              )}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-pixel text-[11px]">EGNA ZONER ({zones.length})</h2>
            {zones.length === 0 && <p className="text-lg text-muted-foreground">Inga än.</p>}
            {zones.map((z) => (
              <div key={z.id} className="pixel-panel flex items-center gap-3 rounded-sm bg-card p-4">
                <span className="flex-1">
                  <span className="block font-pixel text-[10px]">{z.name}</span>
                  <span className="block text-lg text-muted-foreground">
                    {z.slug} · {Array.isArray(z.challenges) ? z.challenges.length : 0} repliker ·{" "}
                    {z.published ? "publicerad" : "dold"}
                  </span>
                </span>
                <button
                  onClick={() => edit(z)}
                  className="rounded-sm border-2 border-border bg-card px-3 py-2 font-pixel text-[9px] shadow-pixel-sm"
                >
                  ÄNDRA
                </button>
                <button
                  onClick={() => remove(z.id)}
                  className="rounded-sm border-2 border-border bg-destructive px-3 py-2 font-pixel text-[9px] text-destructive-foreground shadow-pixel-sm"
                >
                  TA BORT
                </button>
              </div>
            ))}
          </section>
        </>
      )}
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="font-pixel text-[9px] text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-sm border-2 border-border bg-secondary/50 px-3 py-2 text-lg outline-none focus:border-ring"
      />
    </label>
  );
}
