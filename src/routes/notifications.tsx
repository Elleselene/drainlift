import { useMemo, useState } from "react";
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
import { notifications as seed } from "@/lib/drainlift";

// Notifications page (URL: "/notifications"): buong history ng alerts na may filter at pagination
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

const filters = ["All", "Acknowledged", "Auto-Released"] as const; // mga filter buttons
const PAGE_SIZE = 4; // ilang rows ang lalabas kada page

function NotificationsPage() {
  const [rows, setRows] = useState(seed); // lahat ng notifications (may kopya tayo para ma-update)
  const [filter, setFilter] = useState<(typeof filters)[number]>("All"); // napiling filter
  const [page, setPage] = useState(0); // kasalukuyang page (0 = una)

  // I-filter ang rows base sa napiling filter (uulitin lang pag nagbago ang rows o filter)
  const filtered = useMemo(
    () =>
      rows.filter((r) =>
        filter === "All"
          ? true
          : filter === "Acknowledged"
            ? r.status === "acknowledged"
            : r.status === "auto-released",
      ),
    [rows, filter],
  );

  // Ilang pages lahat (kahit walang rows, minimum na 1 page)
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Hiwain lang yung rows na para sa kasalukuyang page
  const visible = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <AppShell
      title="Notifications"
      subtitle="Alert history and acknowledgment log"
    >
      <div className="space-y-5">
        {/* Summary cards: bilangin ang bawat status */}
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard value={rows.length} label="Notifications Today" icon={<Bell className="h-5 w-5" />} />
          <StatCard
            value={rows.filter((r) => r.status === "acknowledged").length}
            label="Acknowledged Today"
            icon={<CheckCircle2 className="h-5 w-5" />}
            tone="primary"
          />
          <StatCard
            value={rows.filter((r) => r.status === "auto-released").length}
            label="Auto-Released Today"
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
              {/* Rows para sa kasalukuyang page lang */}
              {visible.map((n) => (
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
                    {/* Pending: may Acknowledge button. Pag pinindot, magiging "acknowledged" ang status ng row */}
                    {n.status === "pending" && (
                      <Button
                        variant="primary"
                        className="px-2.5 py-1.5 text-xs"
                        onClick={() =>
                          setRows((prev) =>
                            prev.map((r) =>
                              r.id === n.id ? { ...r, status: "acknowledged" } : r,
                            ),
                          )
                        }
                      >
                        Acknowledge
                      </Button>
                    )}
                    {n.status === "acknowledged" && (
                      <StatusPill tone="primary">Acknowledged</StatusPill>
                    )}
                    {n.status === "auto-released" && (
                      <StatusPill tone="warning">Auto-Released</StatusPill>
                    )}
                  </td>
                </tr>
              ))}
              {/* Mensahe kung walang tugma sa filter */}
              {visible.length === 0 && (
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
