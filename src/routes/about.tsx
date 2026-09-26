import { createFileRoute } from "@tanstack/react-router";
import { Clock, Droplet, RefreshCw, Settings, Users } from "lucide-react";
import { AppShell } from "@/components/dl/AppShell";
import { Card, SectionTitle } from "@/components/dl/primitives";
import { initialsOf, researchers } from "@/lib/drainlift";

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
  return (
    <AppShell
      title="About Us"
      subtitle="Learn more about the DrainLift project and the team behind it"
    >
      <div className="space-y-6">
        {/* Hero / heading ng page */}
        <div className="rounded-xl bg-gradient-to-b from-primary/10 to-transparent py-10 text-center">
          <RefreshCw className="mx-auto h-9 w-9 text-foreground" />
          <h2 className="mt-4 text-3xl font-bold sm:text-4xl">About DrainLift</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Keeping our canals clear, one barangay at a time.
          </p>
        </div>

        {/* Info cards, galing sa "cards" array sa taas */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((c) => (
            <Card key={c.title} className="p-5">
              <c.icon className="h-6 w-6 text-foreground" />
              <h3 className="mt-4 font-semibold">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
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
            {researchers.map((r) => (
              <Card key={r.name} className="p-6 text-center">
                <span className="mx-auto grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-info to-primary font-mono text-lg font-bold text-primary-foreground">
                  {/* Kung may photo, yun ang ipakita. Kung wala, initials ng pangalan */}
                  {r.photo ? (
                    <img src={r.photo} alt={r.name} className="h-full w-full object-cover" />
                  ) : (
                    initialsOf(r.name)
                  )}
                </span>
                <p className="mt-4 font-semibold">{r.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{r.role}</p>
              </Card>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Placeholder team entries — send me the real names, roles and photos and I'll
            put them in.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
