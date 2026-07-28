import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Logga in — Svenska Quest" },
      { name: "description", content: "Sign in to manage Svenska Quest zones and game settings." },
      { property: "og:title", content: "Logga in — Svenska Quest" },
      { property: "og:description", content: "Admin sign-in for the Svenska Quest grammar RPG." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/admin` },
          });
    setBusy(false);
    if (res.error) return setMsg(res.error.message);
    if (res.data.session) navigate({ to: "/admin", replace: true });
    else setMsg("Kolla din mejl för att bekräfta kontot.");
  }

  async function google() {
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (res.error) return setMsg(res.error.message ?? "Google-inloggning misslyckades.");
    if (res.redirected) return;
    navigate({ to: "/admin", replace: true });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-4 py-8">
      <h1 className="font-pixel text-sm leading-relaxed text-primary">
        {mode === "in" ? "LOGGA IN" : "SKAPA KONTO"}
      </h1>
      <form onSubmit={submit} className="pixel-panel flex flex-col gap-3 rounded-sm bg-card p-4">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-post"
          className="rounded-sm border-2 border-border bg-secondary/50 px-3 py-3 text-xl outline-none focus:border-ring"
        />
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Lösenord"
          className="rounded-sm border-2 border-border bg-secondary/50 px-3 py-3 text-xl outline-none focus:border-ring"
        />
        <button
          disabled={busy}
          className="rounded-sm border-2 border-border bg-primary px-4 py-2 font-pixel text-[10px] text-primary-foreground shadow-pixel-sm active:translate-y-0.5 active:shadow-none disabled:opacity-60"
        >
          {mode === "in" ? "LOGGA IN" : "REGISTRERA"}
        </button>
        <button
          type="button"
          onClick={google}
          className="rounded-sm border-2 border-border bg-card px-4 py-2 font-pixel text-[10px] shadow-pixel-sm active:translate-y-0.5 active:shadow-none"
        >
          FORTSÄTT MED GOOGLE
        </button>
        {msg && <p className="text-lg text-destructive">{msg}</p>}
      </form>
      <button
        onClick={() => setMode(mode === "in" ? "up" : "in")}
        className="self-start font-pixel text-[9px] text-muted-foreground underline underline-offset-4"
      >
        {mode === "in" ? "skapa konto istället" : "jag har redan konto"}
      </button>
    </main>
  );
}
