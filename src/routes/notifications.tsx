import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Bell, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/dl/AppShell";
import {
  Button,
  Card,
  FillBar,
  SectionTitle,
  StatCard,
  StatusPill,
} from "@/components/dl/primitives";

// Notifications page (URL: "/notifications"): buong history ng alerts na may filter at
// pagination — TOTOONG data na ito galing sa Supabase (audit log), hindi na dummy.
export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — DrainLift" },
      {
        name: "description",
        content:
          "DrainLift alert history: waste-full notifications, acknowledgments and automatic fail-safe releases.",
      },
      { property: "og:title", content: "Notifications — DrainLift" },
      {
        property: "og:description",
        content: "Waste-full alerts, acknowledgments and auto-released events.",
      },
    ],
  }),
  component: NotificationsPage,
});

// Hugis ng bawat row na ibinabalik ng GET /api/notification-history
type HistoryRow = {
  id: string;
  index: string;
  title: string;
  subtitle: string;
  timestamp: string;
  deviceId: string;
  fillLevel: number;
  status: "acknowledged" | "auto-released" | "released";
};

const filters = ["All", "Acknowledged", "Auto-Released", "Released"] as const; // mga filter buttons
const PAGE_SIZE = 4; // ilang rows ang lalabas kada page

function NotificationsPage() {
  const [rows, setRows] = useState<HistoryRow[] | null>(null); // null = loading pa
  const [filter, setFilter] = useState<(typeof filters)[number]>("All"); // napiling filter
  const [page, setPage] = useState(0); // kasalukuyang page (0 = una)

  // Kunin ang totoong history galing sa Supabase (client-only, hindi ito available sa SSR)
  useEffect(() => {
    let cancelled = false;
    fetch("/api/notification-history")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setRows(data.rows ?? []);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const allRows = rows ?? [];

  // I-filter ang rows base sa napiling filter
  const filtered = allRows.filter((r) => {
    if (filter === "All") return true;
    if (filter === "Acknowledged") return r.status === "acknowledged";
    if (filter === "Auto-Released") return r.status === "auto-released";
    return r.status === "released"; // "Released" = manual na "Activate Actuator" command
  });

  // Ilang pages lahat (kahit walang rows, minimum na 1 page)
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Hiwain lang yung rows na para sa kasalukuyang page
  const visible = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <AppShell title="Notifications" subtitle="Alert history and acknowledgment log">
      <div className="space-y-5">
        {/* Summary cards: bilangin ang bawat status */}
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard value={allRows.length} label="Total Notifications" icon={<Bell className="h-5 w-5" />} />
          <StatCard
            value={allRows.filter((r) => r.status === "acknowledged").length}
            label="Acknowledged"
            icon={<CheckCircle2 className="h-5 w-5" />}
            tone="primary"
          />
          <StatCard
            value={allRows.filter((r) => r.status !== "acknowledged").length}
            label="Actuator Activated"
            icon={<AlertTriangle className="h-5 w-5" />}
            tone="warning"
          />
        </div>

        {/* Title at mga filter buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle>Notification History</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <Button
                key={f}
                variant={filter === f ? "primary" : "default"}
                className="px-3 py-1.5 text-xs"
                onClick={() => {
                  setFilter(f);
                  setPage(0); // bumalik sa page 1 tuwing magpapalit ng filter
                }}
              >
                {f}
              </Button>
            ))}
          </div>
        </div>

        {/* Table ng notifications */}
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                {["#", "Notification", "Timestamp", "Device ID", "Fill Level", "Action"].map(
                  (h) => (
                    <th key={h} className="dl-label px-4 py-3">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {/* Habang hinihintay pa ang response galing sa backend */}
              {rows === null && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    Loading notification history…
                  </td>
                </tr>
              )}
              {/* Rows para sa kasalukuyang page lang */}
              {rows !== null &&
                visible.map((n) => (
                  <tr key={n.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-mono text-muted-foreground">{n.index}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{n.title}</p>
                      <p className="font-mono text-xs text-muted-foreground">{n.subtitle}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{n.timestamp}</td>
                    <td className="px-4 py-3 font-mono text-xs text-info">{n.deviceId}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FillBar level={n.fillLevel} className="w-20" />
                        <span className="font-mono text-xs">{n.fillLevel}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {/* Bawat row dito ay laging RESOLVED na (acknowledged o released) —
                          ang kasalukuyang "buhay" pang alert (kung meron) ay nasa Dashboard,
                          hindi dito sa history. */}
                      {n.status === "acknowledged" && (
                        <StatusPill tone="primary">Acknowledged</StatusPill>
                      )}
                      {n.status === "auto-released" && (
                        <StatusPill tone="warning">Auto-Released</StatusPill>
                      )}
                      {n.status === "released" && (
                        <StatusPill tone="warning">Actuator Activated</StatusPill>
                      )}
                    </td>
                  </tr>
                ))}
              {/* Mensahe kung walang tugma sa filter */}
              {rows !== null && visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    No notifications for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        {/* Pagination: Previous / Next */}
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-xs text-muted-foreground">
            Page {page + 1} of {pages}
          </p>
          <div className="flex gap-2">
            <Button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
