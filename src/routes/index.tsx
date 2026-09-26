import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Bell,
  Building2,
  Calendar,
  CheckCircle2,
  Gauge,
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
import { device, notifications } from "@/lib/drainlift";

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

// Custom hook para sa countdown timer (bumababa ng 1 kada segundo hanggang 0).
// Ibinabalik yung natitirang "seconds" (para malaman kung kailan naabot ang 0)
// pati yung "label" na naka-format na bilang "mm:ss", hal. 278 seconds = "04:38"
function useCountdown(startSeconds: number) {
  const [seconds, setSeconds] = useState(startSeconds);
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    // Cleanup: ihinto ang timer pag nag-unmount ang page
    return () => clearInterval(id);
  }, []);
  // I-convert sa minutes at seconds, tapos lagyan ng leading zero (5 -> "05")
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return { seconds, label: `${mm}:${ss}` };
}

// Estado ng live alert:
// "pending"      = tumatakbo pa ang countdown, hinihintay ang acknowledgment
// "acknowledged" = na-acknowledge na ng barangay official, hindi na kailangan ng actuator
// "released"     = na-activate na ang actuator (kusa pag naubos ang oras, o manual na command)
type AlertState = "pending" | "acknowledged" | "released";

function Dashboard() {
  const [alertState, setAlertState] = useState<AlertState>("pending");
  const { seconds, label: countdown } = useCountdown(278); // auto-release countdown (278 sec = 4:38)

  // Kapag naubos na ang countdown at hindi pa na-acknowledge, kusang mag-a-activate ang actuator
  // (auto-release) tapos may lalabas na notification sa app.
  useEffect(() => {
    if (seconds === 0 && alertState === "pending") {
      setAlertState("released");
      toast.error("Actuator auto-activated", {
        description:
          "Walang acknowledgment sa loob ng 5 minuto. Kusang na-release ng DrainLift ang basura.",
      });
    }
  }, [seconds, alertState]);

  // Pag na-acknowledge ng barangay official, itigil na ang countdown at hindi na kailangang
  // gamitin ang actuator — may pupuntang tao para mangolekta nang manual.
  function handleAcknowledge() {
    setAlertState("acknowledged");
    toast.success("Alert acknowledged", {
      description: "Naka-log na. Hindi na kailangang i-activate ang actuator.",
    });
  }

  // Manual na command: pindutin ito ng admin para agad i-activate ang actuator
  // kahit tumatakbo pa ang countdown (hal. emergency o hindi na aabot yung responder sa oras).
  function handleActivateActuator() {
    setAlertState("released");
    toast.warning("Actuator activated", {
      description: "Manual na na-activate ang actuator ng admin.",
    });
  }

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
          <Button variant="info">
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Simulate Alert</span>
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Live alert: pulang card na nagsasabing puno na ang waste compartment */}
        <Card className="dl-glow-alert border-destructive/40 p-4 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-destructive/40 bg-destructive/15 text-destructive">
              <AlertTriangle className="h-7 w-7" />
            </span>
            <div className="min-w-0">
              {/* Nagbabago ang label depende sa kasalukuyang state ng alert */}
              {alertState === "pending" && <StatusPill tone="danger">Live Alert</StatusPill>}
              {alertState === "acknowledged" && (
                <StatusPill tone="primary">Acknowledged</StatusPill>
              )}
              {alertState === "released" && (
                <StatusPill tone="warning">Actuator Activated</StatusPill>
              )}
              <h2 className="mt-2 text-xl font-bold sm:text-2xl">
                DrainLift Unit – Waste Full
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {alertState === "pending" &&
                  "The waste compartment has reached maximum capacity. Immediate collection is required."}
                {alertState === "acknowledged" &&
                  "Acknowledged by a barangay official — a responder is on the way. Actuator will not be used."}
                {alertState === "released" &&
                  "The actuator has been activated and the compartment has been released."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4 lg:justify-end">
              <div className="lg:border-r lg:border-border lg:pr-4">
                <p className="dl-label">Auto-release in</p>
                <p className="font-mono text-3xl font-bold text-destructive">
                  {/* Tumatakbo lang ang countdown habang "pending" pa */}
                  {alertState === "pending" ? countdown : "--:--"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Acknowledge button: pag pinindot, hindi na kailangan ang actuator */}
                <Button
                  variant="primary"
                  onClick={handleAcknowledge}
                  disabled={alertState !== "pending"}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {alertState === "acknowledged" ? "Acknowledged" : "Acknowledge Now"}
                </Button>
                {/* Activate Actuator: command para agad i-release, kahit hindi pa tapos ang countdown */}
                <Button
                  variant="danger"
                  onClick={handleActivateActuator}
                  disabled={alertState !== "pending"}
                >
                  <Zap className="h-4 w-4" />
                  {alertState === "released" ? "Activated" : "Activate Actuator"}
                </Button>
              </div>
            </div>
          </div>
        </Card>

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

        {/* Summary: bilang ng notifications ngayong araw */}
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard value={5} label="Notifications Today" icon={<Bell className="h-5 w-5" />} />
          <StatCard
            value={1}
            label="Acknowledged Today"
            icon={<CheckCircle2 className="h-5 w-5" />}
            tone="primary"
          />
          <StatCard
            value={3}
            label="Auto-Released Today"
            icon={<AlertTriangle className="h-5 w-5" />}
            tone="warning"
          />
        </div>

        {/* Notification history: table ng mga alerts galing sa dummy data */}
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
                {/* Isang row para sa bawat notification */}
                {notifications.map((n) => (
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
                    {/* Iba-iba ang lalabas depende sa status ng notification */}
                    <td className="px-4 py-3">
                      {n.status === "pending" && (
                        <Button variant="primary" className="px-2.5 py-1.5 text-xs">
                          <Gauge className="h-3.5 w-3.5" /> Acknowledge
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
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
