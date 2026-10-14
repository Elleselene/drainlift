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



type NotificationDto = {

  wasteStatus: "FULL" | "NOT_FULL";

  fillLevel: number;

  notificationStatus: "NOT_SENT" | "SENT" | "ACKNOWLEDGED" | "EXPIRED";

  notificationSentAt: number | null;

  acknowledgedAt: number | null;

  releasedAt: number | null;

  releasedBy: "manual" | "auto" | null;

  remainingSeconds: number;

  windowSeconds: number;

  actuatorActive: boolean;

  releaseArmed: boolean;

  fullOverrideActive: boolean;

  hardwareSystemActive: boolean | null;

  hardwareOnline: boolean;

};



function useNotificationHistoryPreview() {

  const [rows, setRows] = useState<HistoryRow[] | null>(null);

  const refreshHistory = useCallback(async () => {

    try {

      const response = await fetch("/api/notification-history", { cache: "no-store" });

      if (!response.ok) return;

      const data = await response.json();

      setRows(Array.isArray(data.rows) ? data.rows.slice(0, 5) : []);

    } catch {

      // Keep the most recent successfully loaded history.

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

  const [displaySeconds, setDisplaySeconds] = useState(0);

  const [pending, setPending] = useState(false);

  const requestInProgress = useRef(false);



  const applyDto = useCallback((next: NotificationDto) => {

    setDto(next);

    setDisplaySeconds(next.remainingSeconds);

  }, []);



  const refresh = useCallback(async () => {

    try {

      const response = await fetch("/api/notification", { cache: "no-store" });

      if (!response.ok) return;

      applyDto((await response.json()) as NotificationDto);

    } catch {

      // Try again on the next poll.

    }

  }, [applyDto]);



  useEffect(() => {

    void refresh();

    const id = setInterval(() => void refresh(), 4000);

    return () => clearInterval(id);

  }, [refresh]);



  useEffect(() => {

    if (dto?.notificationStatus !== "SENT") return;

    const id = setInterval(() => {

      setDisplaySeconds((seconds) => Math.max(0, seconds - 1));

    }, 1000);

    return () => clearInterval(id);

  }, [dto?.notificationStatus, dto?.notificationSentAt]);



  const post = useCallback(

    async (url: string): Promise<boolean> => {

      if (requestInProgress.current) return false;

      requestInProgress.current = true;

      setPending(true);

      try {

        const { data, error } = await supabase.auth.getSession();

        const token = data.session?.access_token;

        if (error || !token) {

          toast.error("Please log in again.");

          return false;

        }



        const response = await fetch(url, {

          method: "POST",

          headers: { Authorization: `Bearer ${token}` },

        });



        if (!response.ok) {

          toast.error(

            response.status === 403

              ? "Authorized user access required."

              : "Unable to complete the request.",

          );

          return false;

        }



        applyDto((await response.json()) as NotificationDto);

        await refresh();

        return true;

      } catch (error) {

        console.error(error);

        toast.error("Unable to connect to the server.");

        return false;

      } finally {

        requestInProgress.current = false;

        setPending(false);

      }

    },

    [applyDto, refresh],

  );



  return {

    dto,

    displaySeconds,

    pending,

    refresh,

    acknowledge: () => post("/api/notification-acknowledge"),

    release: () => post("/api/notification-release"),

  };

}



function Dashboard() {

  const { dto, displaySeconds, pending, acknowledge, release } = useNotification();

  const { rows: historyRows, refreshHistory } = useNotificationHistoryPreview();

  const { userRole, roleLoading } = useAppState();

  const isAuthenticated = !roleLoading && (userRole === "admin" || userRole === "user");

  const isLoading = dto === null;

  const isReleased = dto?.releasedAt != null;

  const isAutoReleased = dto?.releasedBy === "auto";

  const isLiveAlert = dto?.fillLevel === 100 && dto.notificationStatus === "SENT";

  const showAcknowledgeButton = isAuthenticated && isLiveAlert;

  const showReleaseButton =
    isAuthenticated &&
    (dto?.fillLevel ?? 0) >= 50 &&
    !isReleased &&
    (dto?.fillLevel !== 100 ||
      dto.notificationStatus === "SENT" ||
      dto.notificationStatus === "ACKNOWLEDGED");

  async function handleAcknowledge() {

    if (await acknowledge()) {

      toast.success("Acknowledged", {

        description: "The countdown has stopped.",

      });

      await refreshHistory();

    }

  }



  async function handleRelease() {

    if (await release()) {

      toast.success("Request Processed", {

        description: "If the device is offline or stopped, the request is cancelled. Otherwise, the website returns to normal after 2 minutes.",

      });

      await refreshHistory();

    }

  }



  const lastAutoRelease = useRef<number | null>(null);

  useEffect(() => {

    if (dto?.releasedBy !== "auto" || dto.releasedAt === null) return;

    if (lastAutoRelease.current === dto.releasedAt) return;

    lastAutoRelease.current = dto.releasedAt;

    toast.info("Automatic Release Requested", {

      description: "The countdown expired and a release request was recorded.",

    });

  }, [dto?.releasedBy, dto?.releasedAt]);



  const countdown = `${String(Math.floor(displaySeconds / 60)).padStart(2, "0")}:${String(displaySeconds % 60).padStart(2, "0")}`;

  const showAlertCard = dto?.fillLevel === 100 && dto.notificationStatus !== "NOT_SENT";



  return (

    <AppShell

      title="Notification Dashboard"

      subtitle="Waste Compartment Monitoring — Real-time Alerts"

      actions={

        <StatusPill tone="primary" className="hidden sm:inline-flex">

          {dto?.hardwareOnline ? (dto.hardwareSystemActive ? "System Online" : "System Stopped") : "System Offline"}

        </StatusPill>

      }

    >

      <div className="space-y-5">

        {isLoading ? (

          <Card className="border-border p-4 sm:p-5">

            <p className="text-sm text-muted-foreground">Loading current status…</p>

          </Card>

        ) : !showAlertCard ? (

          <Card className="border-primary/40 p-4 sm:p-5">

            <div className="flex items-center gap-4">

              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-primary/40 bg-primary/15 text-primary">

                <CheckCircle2 className="h-7 w-7" />

              </span>

              <div className="min-w-0">

                <StatusPill tone="primary">{dto.fillLevel === 100 ? "Monitoring" : "All Clear"}</StatusPill>

                <h2 className="mt-2 text-xl font-bold sm:text-2xl">

                  Waste Compartment — {dto.fillLevel === 100 ? "Monitoring" : "Not Full"}

                </h2>

                <p className="mt-1 text-sm text-muted-foreground">

                  <strong className="text-white">Current Fill Level: {dto.fillLevel}%</strong>{" "}

                  Monitoring the waste compartment fill level.

                </p>

                {showReleaseButton && (

                  <div className="mt-3">

                    <Button variant="danger" onClick={handleRelease} disabled={pending}>

                      <Zap className="h-4 w-4" />

                      Release Now

                    </Button>

                    {(!dto.hardwareOnline || dto.hardwareSystemActive === false) && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        System stopped/offline — no new release command will be queued.
                      </p>
                    )}

                  </div>

                )}

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

                {dto.notificationStatus === "SENT" && (

                  <StatusPill tone="danger">Live Alert</StatusPill>

                )}

                {dto.notificationStatus === "ACKNOWLEDGED" && (

                  <StatusPill tone="primary">Acknowledged</StatusPill>

                )}

                {isReleased && (

                  <StatusPill tone="warning">

                    {isAutoReleased ? "Auto-Release Requested" : "Release Requested"}

                  </StatusPill>

                )}

                <h2 className="mt-2 text-xl font-bold sm:text-2xl">

                  DrainLift Unit – Waste Full

                </h2>

                <p className="mt-1 text-sm text-muted-foreground">

                  {dto.notificationStatus === "SENT" &&

                    "The waste compartment has reached maximum capacity. Immediate collection is required."}

                  {dto.notificationStatus === "ACKNOWLEDGED" &&

                    "The alert has been acknowledged. Automatic release has been cancelled for this alert."}

                  {isReleased &&

                    (isAutoReleased

                      ? "The countdown expired. An automatic release request has been recorded."

                      : "A manual release request has been recorded.")}

                </p>

              </div>

              <div className="shrink-0 border-l border-border pl-7 pr-2">

                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">

                  Auto-Release In

                </p>

                <p className="mt-1 font-mono text-3xl font-bold text-destructive">

                  {dto.notificationStatus === "SENT" ? countdown : "--:--"}

                </p>

              </div>

              <div className="flex flex-wrap items-center gap-2">

                {(showAcknowledgeButton || dto.notificationStatus === "ACKNOWLEDGED" || isReleased) && (
                  <Button variant="primary" onClick={handleAcknowledge}
                    disabled={pending || dto.notificationStatus !== "SENT" || isReleased}>
                    <CheckCircle2 className="h-4 w-4" />
                    {dto.notificationStatus === "ACKNOWLEDGED" ? "Acknowledged" : "Acknowledge Now"}
                  </Button>
                )}

                {(showReleaseButton || isReleased) && (
                  <Button variant="danger" onClick={handleRelease} disabled={pending || isReleased}>
                    <Zap className="h-4 w-4" />
                    {isReleased ? "Release Requested" : "Release Now"}
                  </Button>
                )}

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
