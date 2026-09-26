import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Lock, Mail, Waves } from "lucide-react";
import { Button, Card } from "@/components/dl/primitives";
import { useAppState } from "@/lib/app-state";
import { currentUser } from "@/lib/drainlift";

// Login page (URL: "/login").
// Fake login lang ito: kahit anong email na may "@" at password na 6+ characters ay papasok.
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
  const { signIn, signedIn } = useAppState();
  const navigate = useNavigate();
  // May default na value para mabilis mag-demo
  const [email, setEmail] = useState(currentUser.email);
  const [password, setPassword] = useState("drainlift");
  const [error, setError] = useState(""); // error message sa form

  // Kung naka-sign in na, dalhin na agad sa dashboard
  useEffect(() => {
    if (signedIn) navigate({ to: "/" });
  }, [signedIn, navigate]);

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-lg border border-primary/40 bg-primary/10 text-primary">
            <Waves className="h-5 w-5" />
          </span>
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
            onSubmit={(e) => {
              e.preventDefault(); // huwag i-reload ang page
              // Simpleng validation: may "@" ang email at hindi bababa sa 6 ang password
              if (!email.includes("@") || password.length < 6) {
                setError("Enter a valid email and a password of at least 6 characters.");
                return;
              }
              // Okay na, i-sign in tapos punta sa dashboard
              setError("");
              signIn();
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
                  className="w-full bg-transparent py-2 font-mono text-sm outline-none"
                />
              </div>
            </label>

            {/* Lalabas lang kung may error */}
            {error && <p className="text-xs text-destructive">{error}</p>}

            <Button variant="primary" type="submit" className="w-full">
              Sign in
            </Button>
          </form>

        </Card>
      </div>
    </div>
  );
}
