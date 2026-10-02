import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Bell,
  Building2,
  Calendar,
  CheckCircle2,
  KeyRound,
  MapPin,
  RefreshCw,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/dl/AppShell";
import {
  Button,
  Card,
  FillBar,
  InfoCard,
  SectionTitle,
  StatCard,
  StatusPill,
} from "@/components/dl/primitives";
import { device } from "@/lib/drainlift";

// Dashboard page (URL: "/").
// Route definition: "head" = title at meta tags ng page, "component" = yung ipapakita
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DrainLift Dashboard — Waste Compartment Monitoring" },
      {
        name: "description",
        content:
          "Real-time DrainLift monitoring for barangay drainage units: fill level, conveyor control, AI garbage detection and alerts.",
      },
      { property: "og:title", content: "DrainLift Dashboard" },
      {
        property: "og:description",
        content:
          "Real-time waste compartment monitoring and conveyor control for barangay drainage units.",
      },
    ],
  }),
  component: Dashboard,
});

// Hugis ng estado na ibinabalik ng backend (src/lib/server/notification-store.ts) —
// dapat tumugma ito sa NotificationDto doon.
// Hugis ng bawat row na ibinabalik ng GET /api/notification-history (totoong audit log
// galing sa Supabase, ginagamit ng preview table sa ibaba)
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

// Kunin ang pinakabagong 5 entries ng notification history — client-only fetch, dahil
// hindi ito available sa SSR (walang env vars/session pa sa unang render pass)
function useNotificationHistoryPreview() {
  const [rows, setRows] = useState<HistoryRow[] | null>(null); // null = loading pa
  useEffect(() => {
    let cancelled = false;
    fetch("/api/notification-history")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setRows((data.rows ?? []).slice(0, 5));
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return rows;
}

type NotificationDto = {
  wasteStatus: "FULL" | "NOT_FULL";
  fillLevel: number;
  notificationStatus: "NOT_SENT" | "SENT" | "ACKNOWLEDGED" | "EXPIRED";
  notificationSentAt: number | null;
  acknowledgedAt: number | null;
  actuatorActive: boolean;
  releaseArmed: boolean;
  releasedAt: number | null;
  releasedBy: "manual" | "auto" | null;
  remainingSeconds: number;
  windowSeconds: number;
};

// Custom hook na nag-poll sa backend (GET /api/notification) tuwing ilang segundo para
// manatiling sync ang dashboard sa totoong estado — kahit ibang tao pa ang nag-acknowledge,
// o totoong ultrasonic sensor na ang nagre-report. Dito rin nakalagay ang mga action
// (acknowledge, release, simulate) na tumatawag sa backend.
function useNotification() {
  const [dto, setDto] = useState<NotificationDto | null>(null);
  const [displaySeconds, setDisplaySeconds] = useState(0);

  // I-save ang bagong estado galing sa backend, at i-sync ang display countdown dito
  const applyDto = useCallback((next: NotificationDto) => {
    setDto(next);
    setDisplaySeconds(next.remainingSeconds);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notification");
      if (res.ok) applyDto(await res.json());
    } catch {
      // Hayaan lang — susubukan ulit sa susunod na poll
    }
  }, [applyDto]);

  // Poll ang backend paminsan-minsan (kada 4 segundo) para manatiling updated
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [refresh]);

  // Sa pagitan ng bawat poll, ito ang nagbibigay ng smooth na pagbaba ng countdown kada segundo
  useEffect(() => {
    if (!dto || dto.notificationStatus !== "SENT") return;
    const id = setInterval(() => setDisplaySeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [dto?.notificationStatus]);

  async function post(url: string) {
    const res = await fetch(url, { method: "POST" });
    if (res.ok) applyDto(await res.json());
    return res.ok;
  }

  async function reportReading(fillLevel: number) {
    const res = await fetch("/api/sensor-reading", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fillLevel }),
    });
    if (res.ok) applyDto(await res.json());
    return res.ok;
  }

  return {
    dto,
    displaySeconds,
    acknowledge: () => post("/api/notification-acknowledge"),
    release: () => post("/api/notification-release"),
    simulateFull: () => reportReading(100),
    simulateRemoved: () => reportReading(0),
  };
}

function Dashboard() {
  const { dto, displaySeconds, acknowledge, release, simulateFull, simulateRemoved } =
    useNotification();
  const historyRows = useNotificationHistoryPreview(); // pinakabagong 5, galing sa Supabase

  // Pinipindot ng barangay official pag nakita na niya ang alert — itigil ang countdown,
  // hindi na kailangang i-activate ang actuator (may backend logic na sa server na
  // nagpe-prevent nito kapag na-release na, o expired na).
  async function handleAcknowledge() {
    const ok = await acknowledge();
    if (ok) {
      toast.success("Alert acknowledged", {
        description: "Naka-log na sa backend. Hindi na kailangang i-activate ang actuator.",
      });
    }
  }

  // Manual na command: agad i-activate ang actuator, kahit tumatakbo pa ang countdown
  async function handleActivateActuator() {
    const ok = await release();
    if (ok) {
      toast.warning("Actuator activated", {
        description: "Manual na na-activate ang actuator ng admin.",
      });
    }
  }

  // Bagong FULL reading (demo lang, habang wala pang totoong ultrasonic sensor na naka-connect)
  async function handleSimulateFull() {
    const ok = await simulateFull();
    if (ok) {
      toast.info("Sensor reading: FULL", {
        description: "Bagong FULL event — magpapadala ng notification kung wala pang aktibo.",
      });
    }
  }

  // Simulate na naalis na ang basura — dito nag-re-reset ang buong notification cycle
  async function handleSimulateRemoved() {
    const ok = await simulateRemoved();
    if (ok) {
      toast.info("Sensor reading: NOT FULL", {
        description: "Naalis na ang basura — na-reset ang notification cycle.",
      });
    }
  }

  // Kapag naubos na ang countdown (5 minuto) nang walang acknowledgment, ang server mismo
  // (hindi ang browser) ang nagde-decide na mag-expire at kusang mag-a-activate ng actuator.
  // Dito lang natin ipapakita yung toast sa unang pagkakataong makita natin ang bagong estado.
  useEffect(() => {
    if (dto?.notificationStatus === "EXPIRED" && dto.releasedBy === "auto") {
      toast.error("Actuator auto-activated", {
        description:
          "Walang acknowledgment sa loob ng 5 minuto. Kusang na-release ng DrainLift ang basura.",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dto?.notificationStatus, dto?.releasedBy, dto?.notificationSentAt]);

  const mm = String(Math.floor(displaySeconds / 60)).padStart(2, "0");
  const ss = String(displaySeconds % 60).padStart(2, "0");
  const countdown = `${mm}:${ss}`;

  // Habang wala pang unang response galing sa backend (client-only ang fetch na ito, kaya
  // wala pa nito sa unang SSR render) — simpleng loading placeholder muna
  const isLoading = dto === null;

const showReleaseButton =
  (dto?.fillLevel ?? 0) >= 50;

const showAcknowledgeButton =
  dto?.fillLevel === 100;


  return (
    <AppShell
      title="Notification Dashboard"
      subtitle="Waste Compartment Monitoring — Real-time Alerts"
      // Mga button sa kanan ng header
      actions={
        <>
          <StatusPill tone="primary" className="hidden sm:inline-flex">
            System Online
          </StatusPill>
          {/* Iisang button para i-demo ang buong cycle: FULL -> ... -> removed -> NOT_FULL */}
          <Button
            variant="info"
            onClick={dto?.wasteStatus === "FULL" ? handleSimulateRemoved : handleSimulateFull}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">
              {dto?.wasteStatus === "FULL" ? "Mark Waste Removed" : "Simulate Alert"}
            </span>
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Live alert card. Nagbabago ang itsura depende sa estadong galing sa backend */}
        {isLoading ? (
          <Card className="border-border p-4 sm:p-5">
            <p className="text-sm text-muted-foreground">Loading current status…</p>
          </Card>
        ) : dto.wasteStatus === "NOT_FULL" ? (
          // Walang aktibong alert — hindi pa FULL (o naalis na ang basura)
          <Card className="border-primary/40 p-4 sm:p-5">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-primary/40 bg-primary/15 text-primary">
                <CheckCircle2 className="h-7 w-7" />
              </span>
              <div className="min-w-0">
                <StatusPill tone="primary">All Clear</StatusPill>
                <h2 className="mt-2 text-xl font-bold sm:text-2xl">
                  Waste Compartment — Not Full
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                <strong className="text-white">
                Current Fill Level: {dto.fillLevel}%
              </strong>
              {" "}
              Monitoring the ultrasonic sensor for a full-compartment reading.
                </p>
              </div>
              {showReleaseButton && (
                <Button
                  variant="danger"
                  onClick={handleActivateActuator}
                  disabled={dto.actuatorActive}
                  className="ml-auto"
                >
                  <Zap className="h-4 w-4" />
                  {dto.actuatorActive ? "Released" : "Release Now"}
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <Card className="dl-glow-alert border-destructive/40 p-4 sm:p-5">
            <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-destructive/40 bg-destructive/15 text-destructive">
                <AlertTriangle className="h-7 w-7" />
              </span>
              <div className="min-w-0">
                {/* Nagbabago ang label depende sa kasalukuyang notification status */}
                {dto.notificationStatus === "SENT" && (
                  <StatusPill tone="danger">Live Alert</StatusPill>
                )}
                {dto.notificationStatus === "ACKNOWLEDGED" && (
                  <StatusPill tone="primary">Acknowledged</StatusPill>
                )}
                {(dto.notificationStatus === "EXPIRED" || dto.actuatorActive) && (
                  <StatusPill tone="warning">Actuator Activated</StatusPill>
                )}
                <h2 className="mt-2 text-xl font-bold sm:text-2xl">
                  DrainLift Unit – Waste Full
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {dto.notificationStatus === "SENT" &&
                    "The waste compartment has reached maximum capacity. Immediate collection is required."}
                  {dto.notificationStatus === "ACKNOWLEDGED" &&
                    "Acknowledged by a barangay official — a responder is on the way. Actuator will not be used."}
                  {dto.notificationStatus === "EXPIRED" &&
                    "The actuator has been activated and the compartment has been released."}
                </p>
              </div>
             <div className="flex flex-wrap items-center gap-2">
                  {showAcknowledgeButton && (
                    <Button
                      variant="primary"
                      onClick={handleAcknowledge}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Acknowledge Now
                    </Button>
                  )}

                  {showReleaseButton && (
                    <Button
                      variant="danger"
                      onClick={handleActivateActuator}
                      disabled={dto.actuatorActive}
                    >
                      <Zap className="h-4 w-4" />
                      {dto.actuatorActive ? "Released" : "Release Now"}
                    </Button>
                  )}
                </div>
              </div>
          </Card>
        )}

        {/* Device info: owner, installation date, device number, at location */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <InfoCard
            label="Owner"
            value={device.owner}
            icon={<Building2 className="h-4 w-4" />}
          />
          <InfoCard
            label="Installation Date"
            value={device.installationDate}
            icon={<Calendar className="h-4 w-4" />}
          />
          <InfoCard
            label="Device Number"
            value={device.deviceNumber}
            icon={<KeyRound className="h-4 w-4" />}
          />
          <InfoCard
            label="Location"
            value={device.location}
            icon={<MapPin className="h-4 w-4" />}
          />
        </div>

        {/* Summary: totoong bilang galing sa Supabase audit log (buong history, hindi lang "today") */}
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            value={historyRows?.length ?? "—"}
            label="Recent Notifications"
            icon={<Bell className="h-5 w-5" />}
          />
          <StatCard
            value={historyRows?.filter((r) => r.status === "acknowledged").length ?? "—"}
            label="Acknowledged"
            icon={<CheckCircle2 className="h-5 w-5" />}
            tone="primary"
          />
          <StatCard
            value={historyRows?.filter((r) => r.status !== "acknowledged").length ?? "—"}
            label="Actuator Activated"
            icon={<AlertTriangle className="h-5 w-5" />}
            tone="warning"
          />
        </div>

        {/* Notification history: pinakabagong 5 entries, totoong data galing sa Supabase */}
        <div className="space-y-3">
          <SectionTitle>Notification History</SectionTitle>
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  {/* Column headers */}
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
                {historyRows === null && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      Loading notification history…
                    </td>
                  </tr>
                )}
                {/* Wala pang naka-log na history (bagong Supabase project, walang laman pa) */}
                {historyRows !== null && historyRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No notifications yet.
                    </td>
                  </tr>
                )}
                {/* Isang row para sa bawat notification */}
                {historyRows?.map((n) => (
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
                    {/* Bawat row dito ay laging RESOLVED na (acknowledged o released) */}
                    <td className="px-4 py-3">
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
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
