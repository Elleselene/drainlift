import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Bell,
  Building2,
  Calendar,
  CheckCircle2,
  KeyRound,
  MapPin,
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
import { supabase } from "@/lib/supabase-client";
import { useAppState } from "@/lib/app-state";
import type { NotificationDto } from "@/lib/notification-types";

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

type TransitionResponse = { ok: boolean; state: NotificationDto };

function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function useNotificationHistoryPreview() {
  const [rows, setRows] = useState<HistoryRow[] | null>(null);

  const refreshHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/notification-history", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setRows(Array.isArray(data.rows) ? data.rows.slice(0, 5) : []);
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    void refreshHistory();
    const id = setInterval(() => void refreshHistory(), 10000);
    return () => clearInterval(id);
  }, [refreshHistory]);

  return { rows, refreshHistory };
}

function useNotification() {
  const [dto, setDto] = useState<NotificationDto | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [pending, setPending] = useState(false);
  const receivedAt = useRef(0);
  const sequence = useRef(0);
  const requestInProgress = useRef(false);
  const expiryRefreshKey = useRef<string | null>(null);

  const applyDto = useCallback((next: NotificationDto) => {
    receivedAt.current = Date.now();
    setDto(next);
    setNow(receivedAt.current);
    setLoadFailed(false);
  }, []);

  const refresh = useCallback(async () => {
    const id = ++sequence.current;
    try {
      const response = await fetch("/api/notification", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const next = (await response.json()) as NotificationDto;
      if (id === sequence.current) applyDto(next);
    } catch {
      if (id === sequence.current) setLoadFailed(true);
    }
  }, [applyDto]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 4000);
    return () => clearInterval(id);
  }, [refresh]);

  const status = dto?.notificationStatus;

  useEffect(() => {
    if (status !== "SENT" && status !== "ACKNOWLEDGED" && status !== "RELEASED") return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [status]);

  const elapsed = dto ? Math.max(0, now - receivedAt.current) : 0;
  const remainingMs = dto ? Math.max(0, dto.remainingMs - elapsed) : 0;
  const resetRemainingMs = dto ? Math.max(0, dto.resetRemainingMs - elapsed) : 0;

  useEffect(() => {
    if (!dto) return;
    const due =
      (dto.notificationStatus === "SENT" && remainingMs === 0) ||
      ((dto.notificationStatus === "ACKNOWLEDGED" || dto.notificationStatus === "RELEASED") &&
        resetRemainingMs === 0);
    if (!due) return;
    const key = `${dto.notificationStatus}:${dto.notificationSentAt}`;
    if (expiryRefreshKey.current === key) return;
    expiryRefreshKey.current = key;
    const id = setTimeout(() => void refresh(), 400);
    return () => clearTimeout(id);
  }, [dto, remainingMs, resetRemainingMs, refresh]);

  const post = useCallback(
    async (url: string): Promise<TransitionResponse | null> => {
      if (requestInProgress.current) return null;
      requestInProgress.current = true;
      setPending(true);
      sequence.current += 1;
      try {
        const { data, error } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (error || !token) {
          toast.error("Please log in again.");
          return null;
        }
        const response = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          toast.error(
            response.status === 403 ? "Login required." : "Unable to complete the request.",
          );
          return null;
        }
        const result = (await response.json()) as TransitionResponse;
        sequence.current += 1;
        applyDto(result.state);
        return result;
      } catch (error) {
        console.error(error);
        toast.error("Unable to connect to the server.");
        return null;
      } finally {
        requestInProgress.current = false;
        setPending(false);
      }
    },
    [applyDto],
  );

  return {
    dto,
    loadFailed,
    remainingMs,
    resetRemainingMs,
    pending,
    acknowledge: () => post("/api/notification-acknowledge"),
    release: () => post("/api/notification-release"),
  };
}

function Dashboard() {
  const { dto, loadFailed, remainingMs, resetRemainingMs, pending, acknowledge, release } =
    useNotification();
  const { rows: historyRows, refreshHistory } = useNotificationHistoryPreview();
  const { userRole, roleLoading } = useAppState();

  const isAuthenticated = !roleLoading && (userRole === "admin" || userRole === "user");
  const status = dto?.notificationStatus ?? "NOT_SENT";
  const isAutoReleased = dto?.releasedBy === "auto";
  const showAlertCard = dto !== null && status !== "NOT_SENT";
  const canAct = isAuthenticated && status === "SENT" && !pending;

  async function handleAcknowledge() {
    const result = await acknowledge();
    if (!result) return;
    if (result.ok) {
      toast.success("Acknowledged", { description: "The countdown has stopped." });
    } else {
      toast.info("This alert was already resolved.");
    }
    await refreshHistory();
  }

  async function handleRelease() {
    const result = await release();
    if (!result) return;
    if (result.ok) {
      toast.success("Release Requested", {
        description: "The release command was sent to the Raspberry Pi.",
      });
    } else {
      toast.info("This alert was already resolved.");
    }
    await refreshHistory();
  }

  const lastAutoRelease = useRef<number | null>(null);

  useEffect(() => {
    if (dto?.releasedBy !== "auto" || dto.releasedAt === null) return;
    if (lastAutoRelease.current === dto.releasedAt) return;
    lastAutoRelease.current = dto.releasedAt;
    toast.info("Automatic Release Requested", {
      description: "The countdown expired and a release command was sent.",
    });
    void refreshHistory();
  }, [dto?.releasedBy, dto?.releasedAt, refreshHistory]);

  let countdown = "--:--";
  if (dto) {
    const windowMs = dto.windowSeconds * 1000;
    if (status === "SENT") {
      countdown = formatClock(remainingMs / 1000);
    } else if (status === "ACKNOWLEDGED" && dto.notificationSentAt && dto.acknowledgedAt) {
      countdown = formatClock((windowMs - (dto.acknowledgedAt - dto.notificationSentAt)) / 1000);
    } else if (status === "RELEASED") {
      countdown =
        isAutoReleased || !dto.notificationSentAt || !dto.releasedAt
          ? formatClock(0)
          : formatClock((windowMs - (dto.releasedAt - dto.notificationSentAt)) / 1000);
    }
  }

  return (
    <AppShell
      title="Notification Dashboard"
      subtitle="Waste Compartment Monitoring — Real-time Alerts"
      actions={
        <StatusPill tone="primary" className="hidden sm:inline-flex">
          {dto?.fullOverrideActive ? "System Online" : "System Online"}
        </StatusPill>
      }
    >
      <div className="space-y-5">
        {dto === null ? (
          <Card className="border-border p-4 sm:p-5">
            <p className="text-sm text-muted-foreground">
              {loadFailed
                ? "Unable to reach the server. Retrying…"
                : "Loading current status…"}
            </p>
          </Card>
        ) : !showAlertCard ? (
          <Card className="border-primary/40 p-4 sm:p-5">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-primary/40 bg-primary/15 text-primary">
                <CheckCircle2 className="h-7 w-7" />
              </span>
              <div className="min-w-0">
                <StatusPill tone="primary">All Clear</StatusPill>
                <h2 className="mt-2 text-xl font-bold sm:text-2xl">
                  Waste Compartment — {dto.fillLevel >= 100 ? "Monitoring" : "Not Full"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  <strong className="text-white">Current Fill Level: {dto.fillLevel}%</strong>{" "}
                  {dto.fillLevel >= 100 && !dto.releaseArmed
                    ? ""
                    : "Monitoring the waste compartment fill level."}
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="dl-glow-alert border-destructive/40 p-4 sm:p-5">
            <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)_auto_auto] lg:items-center">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-destructive/40 bg-destructive/15 text-destructive">
                <AlertTriangle className="h-7 w-7" />
              </span>
              <div className="min-w-0">
                {status === "SENT" && <StatusPill tone="danger">Live Alert</StatusPill>}
                {status === "ACKNOWLEDGED" && <StatusPill tone="primary">Acknowledged</StatusPill>}
                {status === "RELEASED" && (
                  <StatusPill tone="warning">
                    {isAutoReleased ? "Released Automatically" : "Released"}
                  </StatusPill>
                )}
                <h2 className="mt-2 text-xl font-bold sm:text-2xl">
                  DrainLift Unit – Waste Full
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {status === "SENT" &&
                    "The waste compartment has reached maximum capacity. Immediate collection is required."}
                  {status === "ACKNOWLEDGED" &&
                    "The alert has been acknowledged. No release was requested."}
                  {status === "RELEASED" &&
                    (isAutoReleased
                      ? "The countdown expired. A release command was sent automatically."
                      : "A release command was sent.")}
                  {status !== "SENT" && (
                    <>
                      {" "}
                      Returning to monitoring in{" "}
                      <span className="font-mono">{formatClock(resetRemainingMs / 1000)}</span>.
                    </>
                  )}
                </p>
              </div>
              <div className="shrink-0 border-l border-border pl-7 pr-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Auto-Release In
                </p>
                <p className="mt-1 font-mono text-3xl font-bold text-destructive">{countdown}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="primary" onClick={handleAcknowledge} disabled={!canAct}>
                  <CheckCircle2 className="h-4 w-4" />
                  Acknowledge Now
                </Button>
                <Button variant="danger" onClick={handleRelease} disabled={!canAct}>
                  <Zap className="h-4 w-4" />
                  Release Now
                </Button>
              </div>
            </div>
          </Card>
        )}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <InfoCard label="Owner" value={device.owner} icon={<Building2 className="h-4 w-4" />} />
          <InfoCard label="Installation Date" value={device.installationDate} icon={<Calendar className="h-4 w-4" />} />
          <InfoCard label="Device Number" value={device.deviceNumber} icon={<KeyRound className="h-4 w-4" />} />
          <InfoCard label="Location" value={device.location} icon={<MapPin className="h-4 w-4" />} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard value={historyRows?.length ?? "—"} label="Recent Notifications" icon={<Bell className="h-5 w-5" />} />
          <StatCard
            value={historyRows?.filter((r) => r.status === "acknowledged").length ?? "—"}
            label="Acknowledged"
            icon={<CheckCircle2 className="h-5 w-5" />}
            tone="primary"
          />
          <StatCard
            value={historyRows?.filter((r) => r.status !== "acknowledged").length ?? "—"}
            label="Released"
            icon={<AlertTriangle className="h-5 w-5" />}
            tone="warning"
          />
        </div>
        <div className="space-y-3">
          <SectionTitle>Notification History</SectionTitle>
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  {["#", "Notification", "Timestamp", "Device ID", "Fill Level", "Action"].map((h) => (
                    <th key={h} className="dl-label px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historyRows === null && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      Loading notification history…
                    </td>
                  </tr>
                )}
                {historyRows !== null && historyRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No notifications yet.
                    </td>
                  </tr>
                )}
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
                    <td className="px-4 py-3">
                      {n.status === "acknowledged" && <StatusPill tone="primary">Acknowledged</StatusPill>}
                      {n.status === "auto-released" && <StatusPill tone="warning">Released Automatically</StatusPill>}
                      {n.status === "released" && <StatusPill tone="warning">Released</StatusPill>}
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
