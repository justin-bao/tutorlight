import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useSession } from "@/lib/auth";
import { Sparkles, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      // If a topic was queued from the landing prompt, create the lesson now.
      const pending = sessionStorage.getItem("pending_topic");
      if (pending) {
        sessionStorage.removeItem("pending_topic");
        (async () => {
          const { data } = await supabase
            .from("lessons")
            .insert({ user_id: user.id, topic: pending, status: "generating" })
            .select("id")
            .single();
          if (data) {
            const token = (await supabase.auth.getSession()).data.session?.access_token ?? "";
            fetch("/api/generate-lesson", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ lessonId: data.id, topic: pending }),
            }).catch(() => {});
            navigate({ to: "/lesson/$lessonId", params: { lessonId: data.id } });
            return;
          }
          navigate({ to: "/" });
        })();
      } else {
        navigate({ to: "/" });
      }
    }
  }, [user, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name || email.split("@")[0] } },
        });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    setError(null);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      // If redirected, browser will navigate away. If tokens returned, session is set.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="ambient-glow" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-12">
        <Link to="/" className="mb-8 flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 ring-1 ring-primary/30">
            <Sparkles className="h-4 w-4 text-primary" />
          </span>
          <span className="font-display text-xl tracking-tight">Tutorlight</span>
        </Link>

        <div className="w-full rounded-2xl border border-border/70 bg-card/60 p-6 shadow-2xl shadow-black/40 backdrop-blur">
          <h1 className="font-display text-3xl tracking-tight">
            {mode === "signup" ? "Begin learning" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signup"
              ? "Create an account to save your lessons."
              : "Sign in to continue your lessons."}
          </p>

          <button
            onClick={handleGoogle}
            disabled={busy}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm transition hover:bg-secondary/70 disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.62 4.1-5.5 4.1-3.31 0-6-2.74-6-6.1s2.69-6.1 6-6.1c1.88 0 3.14.8 3.86 1.49l2.64-2.55C16.95 3.4 14.7 2.5 12 2.5 6.76 2.5 2.5 6.76 2.5 12s4.26 9.5 9.5 9.5c5.48 0 9.1-3.85 9.1-9.27 0-.62-.07-1.1-.16-1.53H12z"/>
            </svg>
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            <span>or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name (optional)"
                className="w-full rounded-xl border border-border bg-input/40 px-4 py-2.5 text-sm outline-none transition focus:border-primary/60"
              />
            )}
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full rounded-xl border border-border bg-input/40 px-4 py-2.5 text-sm outline-none transition focus:border-primary/60"
            />
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 8 chars)"
              className="w-full rounded-xl border border-border bg-input/40 px-4 py-2.5 text-sm outline-none transition focus:border-primary/60"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:brightness-105 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "signup" ? "Already have an account?" : "New to Tutorlight?"}{" "}
            <button
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
              className="text-primary hover:underline"
            >
              {mode === "signup" ? "Sign in" : "Create one"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
