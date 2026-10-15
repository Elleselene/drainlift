
import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Clock, Droplet, Settings, Users, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/dl/AppShell";
import { Card, SectionTitle } from "@/components/dl/primitives";
import { initialsOf, researchers } from "@/lib/drainlift";
import { useAppState } from "@/lib/app-state";
import { supabase } from "@/lib/supabase-client";


// About page (URL: "/about"): paliwanag tungkol sa project at sa mga researchers
export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About DrainLift — Self-Cleaning Drainage System" },
      {
        name: "description",
        content:
          "DrainLift is an IoT drainage unit that detects and collects canal garbage automatically, keeping barangay canals clear.",
      },
      { property: "og:title", content: "About DrainLift" },
      {
        property: "og:description",
        content: "Keeping our canals clear, one barangay at a time.",
      },
    ],
  }),
  component: AboutPage,
});

// Laman ng apat na info cards (icon, title, at paliwanag)
const cards = [
  {
    icon: Droplet,
    title: "The Problem",
    body: "Clogged canals cause flooding and health hazards, and manual trash collection is slow, unpredictable, and easy to miss during heavy rains.",
  },
  {
    icon: Settings,
    title: "How It Works",
    body: "DrainLift is an IoT-enabled unit installed along the canal. When its waste compartment fills up, it sends a real-time alert to this dashboard.",
  },
  {
    icon: Users,
    title: "Human in the Loop",
    body: "An available barangay responder acknowledges the alert here, confirming someone is on the way to collect the waste.",
  },
  {
    icon: Clock,
    title: "Automatic Fail-Safe",
    body: "If no one acknowledges the alert within 5 minutes, DrainLift automatically releases the trash on its own, so the canal is never left blocked.",
  },
];

function AboutPage() {
  const { userRole, roleLoading } = useAppState();
  const isAdmin = !roleLoading && userRole === "admin";

  const commandSent = useRef(false);

  const [sliderOpen, setSliderOpen] = useState(false);
  const [fillLevel, setFillLevel] = useState(0);
  const [bypassEnabled, setBypassEnabledLocal] = useState(false);
  const [bypassLoading, setBypassLoading] = useState(true);
  const [bypassPending, setBypassPending] = useState(false);

  const simulationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleFillChange(level: number) {
    setFillLevel(level);

    if (simulationTimer.current) {
      clearTimeout(simulationTimer.current);
    }

    simulationTimer.current = setTimeout(() => {
      void saveSimulatedFill(level);
    }, 300);
  }

  useEffect(() => {
    if (!isAdmin || !bypassEnabled) {
      setSliderOpen(false);
    }
  }, [isAdmin, bypassEnabled]);

  useEffect(() => {
    if (!sliderOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSliderOpen(false);
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [sliderOpen]);

  useEffect(() => {
    return () => {
      if (simulationTimer.current) {
        clearTimeout(simulationTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadBypass() {
      try {
        const response = await fetch("/api/notification", { cache: "no-store" });
        if (!response.ok) throw new Error("Unable to load Bypass Mode");
        const state = await response.json();
        if (!cancelled) {
          setBypassEnabledLocal(Boolean(state.fullOverrideActive));
          setFillLevel(Number(state.fillLevel) || 0);
        }
      } catch {
        if (!cancelled) toast.error("Unable to load Bypass Mode");
      } finally {
        if (!cancelled) setBypassLoading(false);
      }
    }
    void loadBypass();
    return () => { cancelled = true; };
  }, []);

  async function toggleBypass() {
    if (!isAdmin || bypassPending || bypassLoading) return;
    if (simulationTimer.current) {
      clearTimeout(simulationTimer.current);
      simulationTimer.current = null;
    }
    setBypassPending(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Please log in again.");
      const response = await fetch("/api/fill-simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "toggle-bypass", enabled: !bypassEnabled }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to switch Bypass Mode");
      setBypassEnabledLocal(result.state.fullOverrideActive);
      setFillLevel(result.state.fillLevel);
      toast.success(result.state.fullOverrideActive ? "Bypass Mode ON" : "Bypass Mode OFF");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to switch Bypass Mode");
    } finally {
      setBypassPending(false);
    }
  }

  async function secretActivateMotor() {
    if (!isAdmin || commandSent.current) return;

    if (!bypassEnabled) {
      toast.info("Turn Bypass ON using the clock icon first.");
      return;
    }

    commandSent.current = true;

    try {
      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session?.access_token) {
        throw new Error("No active login session");
      }
      const response = await fetch("/api/motor-command", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({
          command: "DETECT",
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "Motor command failed");
      }

      toast.success("DETECT command sent");
    } catch (error) {
      console.error("Failed to send DETECT command:", error);
      toast.error(error instanceof Error ? error.message : "Unable to send DETECT command");
    } finally {
      setTimeout(() => {
        commandSent.current = false;
      }, 1500);
    }
  }

  async function saveSimulatedFill(level: number) {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) return;

      const response = await fetch("/api/fill-simulation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "set",
          fillLevel: level,
        }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        toast.error(result.error || "Failed to update bypass fill level");
        if (response.status === 409) setBypassEnabledLocal(false);
      }
    } catch (error) {
      console.error("Simulation update failed:", error);
    }
  }


  return (
    <AppShell
      title="About Us"
      subtitle="Learn more about the DrainLift project and the team behind it"
    >
      <div className="space-y-6">
        {/* Hero / heading ng page */}
        <div className="rounded-xl bg-gradient-to-b from-primary/10 to-transparent py-10 text-center">
          {isAdmin ? (
            <button
              type="button"
              onClick={() => void secretActivateMotor()}
              className="mx-auto -mb-3.5 block select-none border-0 bg-transparent p-0"
              aria-label="DrainLift"
            >
              <img
                src="/logo.png"
                alt="DrainLift"
                draggable={false}
                className="h-20 w-20 select-none object-contain"
              />
            </button>
          ) : (
            <img
              src="/logo.png"
              alt="DrainLift"
              className="mx-auto -mb-3.5 h-20 w-20 object-contain"
            />
          )}

          <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
            About DrainLift
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Keeping our canals clear, one barangay at a time.
          </p>
        </div>

        {/* Info cards, galing sa "cards" array sa taas */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((c) => (
            <Card key={c.title} className="p-5">
              {c.title === "Automatic Fail-Safe" && isAdmin ? (
                <button
                  type="button"
                  onClick={() => void toggleBypass()}
                  disabled={bypassPending || bypassLoading}
                  aria-label={bypassEnabled ? "Turn Bypass OFF" : "Turn Bypass ON"}
                  aria-pressed={bypassEnabled}
                  title={bypassEnabled ? "Bypass ON — click to turn OFF" : "Bypass OFF — click to turn ON"}
                  className="rounded-full disabled:opacity-50"
                >
                  <span className={bypassEnabled ? "flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-900" : "flex h-9 w-9 items-center justify-center text-foreground"}>
                    <Clock className="h-6 w-6" />
                  </span>
                </button>
              ) : (
                <c.icon className="h-6 w-6 text-foreground" />
              )}
              <h3 className="mt-4 font-semibold">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {c.body}
              </p>
            </Card>
          ))}
        </div>

        {/* Mission */}
        <Card className="p-6">
          <h3 className="font-semibold">Our Mission</h3>
          <p className="mt-3 max-w-4xl text-sm leading-relaxed text-muted-foreground">
            DrainLift was built as a Computer Engineering thesis project to give local
            barangays an affordable, low-maintenance way to prevent canal blockages and
            reduce urban flooding through simple, reliable automation.
          </p>
        </Card>

        {/* Mga researchers: galing sa lib/drainlift.ts */}
        <div className="space-y-3">
          <SectionTitle>Meet the Researchers</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {researchers.map((r) => {
              const isCarla = r.name.toLowerCase().includes("carla");

              const photo = r.photo ? (
                <img
                  src={r.photo}
                  alt={r.name}
                  draggable={false}
                  className="h-full w-full select-none object-cover"
                />
              ) : (
                initialsOf(r.name)
              );

              const imageClass =
                "mx-auto grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-info to-primary font-mono text-lg font-bold text-primary-foreground";

              return (
                <Card key={r.name} className="p-6 text-center">
                  {isCarla && isAdmin ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (!bypassEnabled) {
                          toast.info("Turn Bypass ON using the clock icon first.");
                          return;
                        }
                        setSliderOpen(true);
                      }}
                      className={imageClass}
                      aria-label={r.name}
                    >
                      {photo}
                    </button>
                  ) : (
                    <span className={imageClass}>
                      {photo}
                    </span>
                  )}

                  <p className="mt-4 font-semibold">{r.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.role}
                  </p>
                </Card>
              );
            })}
          </div>
        </div>
      </div>


    {sliderOpen && isAdmin && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onClick={() => setSliderOpen(false)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Fill Level Control"
          className="relative flex w-32 flex-col items-center rounded-2xl border border-border bg-background px-3 py-4 shadow-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setSliderOpen(false)}
            aria-label="Close"
            className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          <span className="mt-5 text-lg font-semibold tabular-nums">
            {fillLevel}%
          </span>

          <div className="relative my-5 flex h-44 w-10 items-center justify-center">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={fillLevel}
              onChange={(event) =>
                handleFillChange(Number(event.target.value))
              }
              aria-label="Bypass fill level"
              className="absolute h-2 w-40 cursor-pointer accent-emerald-500"
              style={{
                transform: "rotate(-90deg)",
                touchAction: "none",
              }}
            />
          </div>

          <span className="text-[10px] text-muted-foreground">
            Fill Level
          </span>
        </div>
      </div>
    )}

    </AppShell>
  );
}
