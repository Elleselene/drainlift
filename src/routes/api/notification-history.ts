import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/server/supabase-admin";
import { device } from "@/lib/drainlift";

// GET /api/notification-history — kunin ang TOTOONG notification history galing sa
// Supabase (audit log ng mga resolved na notification cycles — acknowledged, auto-released,
// o manual na na-release). Dito kumukuha ang Notifications page at ang preview sa Dashboard,
// kapalit ng dating dummy data.

// Hugis ng row sa Supabase "notification_history" table
type HistoryRow = {
  id: string;
  notification_sent_at: string;
  acknowledged_at: string | null;
  released_at: string | null;
  released_by: "manual" | "auto" | null;
  fill_level: number | null;
  created_at: string;
};

// I-format ang timestamp papunta sa "YYYY-MM-DD HH:MM" gamit ang Philippine time (Asia/Manila),
// kahit anong timezone ang server na pinagta-tumbahan nito
function formatManilaTimestamp(iso: string | null): string {
  if (!iso) return "—";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

export const Route = createFileRoute("/api/notification-history")({
  server: {
    handlers: {
      GET: async () => {
        const { data, error } = await supabaseAdmin
          .from("notification_history")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200);

        if (error) {
          return Response.json({ error: error.message }, { status: 500 });
        }

        const rows = (data as HistoryRow[]).map((row, i) => {
          // Ang status ay depende sa kung paano na-resolve ang cycle na ito
          const status: "acknowledged" | "auto-released" | "released" = row.acknowledged_at
            ? "acknowledged"
            : row.released_by === "auto"
              ? "auto-released"
              : "released"; // manual na "Activate Actuator" command

          // Yung timestamp na ipapakita: kailan talaga na-resolve (hindi kung kailan na-send)
          const resolvedAt = row.acknowledged_at ?? row.released_at ?? row.notification_sent_at;

          return {
            id: row.id,
            index: String(i + 1).padStart(2, "0"),
            title: "DrainLift Unit – Waste Full",
            subtitle: `Fill level reached ${row.fill_level ?? 0}%`,
            timestamp: formatManilaTimestamp(resolvedAt),
            deviceId: device.deviceNumber,
            fillLevel: row.fill_level ?? 0,
            status,
          };
        });

        return Response.json({ rows });
      },
    },
  },
});
