import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Lock, Mail } from "lucide-react";
import { Button, Card } from "@/components/dl/primitives";
import { useAppState } from "@/lib/app-state";

// Login page (URL: "/login").
// TOTOONG login na ito gamit ang Supabase Auth (email + password) — kailangan munang
// gumawa ng account sa Supabase dashboard (Authentication -> Users -> "Add user") bago
// makapag-sign in dito.
export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In — DrainLift Monitoring" },
      {
        name: "description",
        content:
          "Sign in to the DrainLift monitoring dashboard for barangay drainage units.",
      },
      { property: "og:title", content: "Sign In — DrainLift" },
      {
        property: "og:description",
        content: "Barangay official access to the DrainLift monitoring dashboard.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn, signedIn, authLoading } = useAppState();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(""); // error message sa form
  const [submitting, setSubmitting] = useState(false); // habang hinihintay ang Supabase

  // Kung naka-sign in na (o may existing session), dalhin na agad sa dashboard
  useEffect(() => {
    if (!authLoading && signedIn) navigate({ to: "/" });
  }, [authLoading, signedIn, navigate]);

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <img src="/logo.png" alt="DrainLift logo" className="h-10 w-10 object-contain" />
          <span className="text-2xl font-bold tracking-tight">
            <span className="text-primary">Drain</span>
            <span className="text-info">Lift</span>
          </span>
        </div>

        <Card accent className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold">Sign in</h1>
              <p className="text-xs text-muted-foreground">
                Barangay official / facility admin access
              </p>
            </div>
          </div>

          <form
            className="mt-5 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault(); // huwag i-reload ang page
              if (!email.includes("@") || password.length < 6) {
                setError("Enter a valid email and a password of at least 6 characters.");
                return;
              }
              setError("");
              setSubmitting(true);
              const { error: signInError } = await signIn(email, password);
              setSubmitting(false);
              if (signInError) {
                setError(signInError);
                return;
              }
              navigate({ to: "/" });
            }}
          >
            {/* Email field */}
            <label className="block">
              <span className="dl-label">Email</span>
              <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-input bg-background px-3">
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="w-full bg-transparent py-2 font-mono text-sm outline-none"
                />
              </div>
            </label>

            {/* Password field */}
            <label className="block">
              <span className="dl-label">Password</span>
              <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-input bg-background px-3">
                <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full bg-transparent py-2 font-mono text-sm outline-none"
                />
              </div>
            </label>

            {/* Lalabas lang kung may error */}
            {error && <p className="text-xs text-destructive">{error}</p>}

            <Button variant="primary" type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
