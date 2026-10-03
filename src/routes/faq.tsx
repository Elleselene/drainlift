import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  CircleHelp,
  Minus,
  Plus,
  Search,
} from "lucide-react";
import { AppShell } from "@/components/dl/AppShell";
import { Button, Card, SectionTitle, StatusPill } from "@/components/dl/primitives";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — DrainLift" },
      {
        name: "description",
        content: "Frequently asked questions and system guide for the DrainLift monitoring system.",
      },
      { property: "og:title", content: "DrainLift System Guide" },
    ],
  }),
  component: FAQPage,
});

type CategoryId = "about" | "how" | "notifications" | "dashboard" | "testing";

type FAQItem = {
  id: number;
  category: CategoryId;
  question: string;
  answer: string;
};

const categories: { id: "all" | CategoryId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "about", label: "About DrainLift" },
  { id: "how", label: "How It Works" },
  { id: "notifications", label: "Notifications" },
  { id: "dashboard", label: "Dashboard" },
  { id: "testing", label: "Testing" },
];

const categoryTitles: Record<CategoryId, string> = {
  about: "About DrainLift",
  how: "How the System Works",
  notifications: "Notifications and Actuator",
  dashboard: "Dashboard and Monitoring",
  testing: "Testing and System Controls",
};

const faqs: FAQItem[] = [
  {
    id: 1,
    category: "about",
    question: "What is DrainLift?",
    answer:
      "DrainLift is a self-cleaning drainage system designed to help collect floating garbage from drainage canals. It combines image processing, automated waste collection, waste-level monitoring, and notifications to support easier drainage maintenance.",
  },
  {
    id: 2,
    category: "about",
    question: "What problem does DrainLift address?",
    answer:
      "DrainLift is designed to help address the accumulation of floating garbage in drainage canals, which can contribute to blocked water flow and make manual waste collection more difficult.",
  },
  {
    id: 3,
    category: "about",
    question: "Where is the DrainLift system intended to be used?",
    answer:
      "DrainLift is intended for use in drainage canals where floating waste can be collected and monitored.",
  },
  {
    id: 4,
    category: "how",
    question: "How does DrainLift detect garbage?",
    answer:
      "The system uses a Raspberry Pi camera together with image processing and YOLOv8 to detect garbage in the monitored drainage area.",
  },
  {
    id: 5,
    category: "how",
    question: "What happens when garbage is detected?",
    answer:
      "When garbage is detected, the system sends a control signal that activates the waste collection mechanism. The conveyor collects the detected waste and transfers it into the waste compartment.",
  },
  {
    id: 6,
    category: "how",
    question: "How does the waste collection mechanism work?",
    answer:
      "The conveyor mechanism moves the collected waste from the drainage area into the attached waste compartment for temporary storage.",
  },
  {
    id: 7,
    category: "how",
    question: "How does the system know when the waste compartment is full?",
    answer:
      "An ultrasonic sensor monitors the waste compartment. When the measured waste level reaches the defined full condition, the system generates a full-compartment notification.",
  },
  {
    id: 8,
    category: "notifications",
    question: "What happens when the waste compartment becomes full?",
    answer:
      "When the ultrasonic sensor detects that the compartment is full, DrainLift records the condition and sends a notification to the authorized user through the monitoring system.",
  },
  {
    id: 9,
    category: "notifications",
    question: "What does the ‘Acknowledge’ action mean?",
    answer:
      "‘Acknowledge’ indicates that the authorized user has already seen and recognized the waste-full notification.",
  },
  {
    id: 10,
    category: "notifications",
    question: "What happens if the notification is not acknowledged?",
    answer:
      "If the notification remains unacknowledged, the system follows the configured release process. After the specified waiting period, the actuator can be activated to release the stored waste.",
  },
  {
    id: 11,
    category: "notifications",
    question: "What is the purpose of the actuator?",
    answer:
      "The actuator operates the waste-release mechanism when the stored waste needs to be removed from the compartment.",
  },
  {
    id: 12,
    category: "notifications",
    question: "Will the system repeatedly send notifications while the compartment is still full?",
    answer:
      "No. DrainLift uses a notification state process so that the same full-compartment condition does not continuously generate duplicate notifications. A new full notification can be generated after the previous waste-full event has been resolved.",
  },
  {
    id: 13,
    category: "dashboard",
    question: "What information can be viewed on the dashboard?",
    answer:
      "The dashboard provides information about the system status, waste compartment fill level, garbage detection activity, conveyor status, notifications, and other monitoring information supported by the system.",
  },
  {
    id: 14,
    category: "dashboard",
    question: "What does ‘Waste Compartment – Not Full’ mean?",
    answer:
      "It means that the current ultrasonic sensor reading indicates that the waste compartment has not reached the defined full level.",
  },
  {
    id: 15,
    category: "dashboard",
    question: "What does ‘Waste Full’ mean?",
    answer:
      "It means that the waste compartment has reached the configured full condition based on the ultrasonic sensor reading.",
  },
  {
    id: 16,
    category: "dashboard",
    question: "What is the purpose of Notification History?",
    answer:
      "Notification History keeps a record of previous waste-full events, including relevant timestamps, device information, fill level, and the action taken.",
  },
  {
    id: 17,
    category: "testing",
    question: "What is the purpose of ‘Simulate Alert’?",
    answer:
      "‘Simulate Alert’ is a testing function used to simulate a full-compartment condition without requiring the actual ultrasonic sensor to trigger the event. It is intended for system testing and demonstration.",
  },
  {
    id: 18,
    category: "testing",
    question: "What does ‘Mark Waste Removed’ do?",
    answer:
      "‘Mark Waste Removed’ is a testing function that simulates the waste compartment returning to a non-full condition after the waste has been removed.",
  },
  {
    id: 19,
    category: "testing",
    question: "What is the purpose of ‘Activate Actuator’?",
    answer:
      "‘Activate Actuator’ allows the actuator release process to be triggered manually when permitted by the system.",
  },
  {
    id: 20,
    category: "testing",
    question: "Are the testing buttons part of the actual sensor operation?",
    answer:
      "No. The simulation controls are provided for testing and demonstration. During actual operation, the corresponding system states are expected to come from the hardware sensors and controllers.",
  },
];

function FAQPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | CategoryId>("all");
  const [openId, setOpenId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return faqs.filter((faq) => {
      const matchesCategory = category === "all" || faq.category === category;
      const matchesSearch =
        !term ||
        faq.question.toLowerCase().includes(term) ||
        faq.answer.toLowerCase().includes(term);
      return matchesCategory && matchesSearch;
    });
  }, [category, query]);

  const grouped = useMemo(() => {
    const result: Partial<Record<CategoryId, FAQItem[]>> = {};
    for (const faq of filtered) {
      (result[faq.category] ??= []).push(faq);
    }
    return result;
  }, [filtered]);

  return (
    <AppShell
      title="Frequently Asked Questions"
      subtitle="Learn more about DrainLift, its monitoring system, and how it works."
      actions={
        <StatusPill tone="primary" className="hidden sm:inline-flex">
          System Guide
        </StatusPill>
      }
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <Card accent className="overflow-hidden p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
            <span className="grid h-12 w-12 place-items-center rounded-xl border border-info/40 bg-info/10 text-info shadow-[0_0_24px_rgba(0,180,255,0.08)]">
              <CircleHelp className="h-6 w-6" />
            </span>
            <div>
              <p className="dl-label text-primary">DrainLift System Guide</p>
              <p className="mt-2 max-w-4xl text-sm leading-relaxed text-muted-foreground">
                Have questions about DrainLift? Browse the frequently asked questions below to learn how the drainage monitoring, garbage detection, waste collection, notification, and actuator systems work.
              </p>
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpenId(null);
              }}
              placeholder="Search frequently asked questions…"
              className="h-11 w-full rounded-xl border border-border-strong bg-card pl-10 pr-4 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-info/60 focus:shadow-[0_0_0_3px_rgba(0,180,255,0.08)]"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map((item) => {
              const active = category === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setCategory(item.id);
                    setOpenId(null);
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "border-primary/50 bg-primary/15 text-primary shadow-[0_0_18px_rgba(0,255,160,0.06)]"
                      : "border-border-strong bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {filtered.length === 0 ? (
          <Card className="px-5 py-12 text-center">
            <CircleHelp className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="mt-4 font-semibold text-foreground">No matching questions found.</h2>
            <p className="mt-1 text-sm text-muted-foreground">Try using a different keyword.</p>
          </Card>
        ) : (
          <div className="space-y-7">
            {(Object.keys(categoryTitles) as CategoryId[]).map((categoryId) => {
              const items = grouped[categoryId];
              if (!items?.length) return null;

              return (
                <section key={categoryId} className="space-y-3">
                  <SectionTitle>{categoryTitles[categoryId]}</SectionTitle>
                  <div className="space-y-2.5">
                    {items.map((faq) => {
                      const open = openId === faq.id;
                      return (
                        <Card
                          key={faq.id}
                          className={cn(
                            "overflow-hidden transition-[border-color,box-shadow] duration-200",
                            open && "border-info/40 shadow-[inset_3px_0_0_0_var(--color-info),0_0_22px_rgba(0,180,255,0.05)]",
                          )}
                        >
                          <button
                            type="button"
                            aria-expanded={open}
                            onClick={() => setOpenId(open ? null : faq.id)}
                            className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 text-left sm:px-5"
                          >
                            <span className={cn("text-sm font-semibold text-foreground", open && "text-info")}>{faq.question}</span>
                            <span
                              className={cn(
                                "grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-border-strong bg-secondary text-muted-foreground transition-colors",
                                open && "border-info/40 bg-info/10 text-info",
                              )}
                            >
                              {open ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                            </span>
                          </button>
                          <div
                            className={cn(
                              "grid transition-[grid-template-rows] duration-200 ease-out",
                              open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                            )}
                          >
                            <div className="overflow-hidden">
                              <div className="border-t border-border bg-muted/30 px-4 py-4 sm:px-5">
                                <p className="max-w-4xl text-sm leading-7 text-muted-foreground">{faq.answer}</p>
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        <Card accent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 gap-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-primary/40 bg-primary/10 text-primary">
                <BookOpen className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-semibold text-foreground">Need help understanding the system?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Review the Dashboard and Notification pages to monitor the current DrainLift status.
                </p>
              </div>
            </div>
            <Button variant="primary" onClick={() => navigate({ to: "/" })} className="shrink-0">
              Go to Dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
