import { createFileRoute } from "@tanstack/react-router";
import { getNotificationState, reportSensorReading } from "@/lib/server/notification-store";

export const Route = createFileRoute("/api/sensor-reading")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => null);
        const fillLevel = Number((body as { fillLevel?: unknown } | null)?.fillLevel);
        if (!Number.isFinite(fillLevel) || fillLevel < 0 || fillLevel > 100) {
          return Response.json({ error: "fillLevel (number, 0-100) is required" }, { status: 400 });
        }
        try {
          return Response.json(await reportSensorReading(fillLevel));
        } catch (error) {
          console.error("[sensor-reading] POST failed:", error);
          return Response.json({ error: "Unable to record sensor reading" }, { status: 500 });
        }
      },
      GET: async () => {
        try {
          return Response.json(await getNotificationState());
        } catch (error) {
          console.error("[sensor-reading] GET failed:", error);
          return Response.json({ error: "Unable to load notification state" }, { status: 500 });
        }
      },
    },
  },
});
