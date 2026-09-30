import { createFileRoute } from "@tanstack/react-router";
import { getNotificationState, reportSensorReading } from "@/lib/server/notification-store";

// REST endpoint na tatawagin ng ultrasonic sensor (Arduino/Raspberry Pi) tuwing may bagong
// reading. Halimbawa (mula sa microcontroller):
//
//   POST /api/sensor-reading
//   Content-Type: application/json
//   { "fillLevel": 100 }
//
// Ginagamit din ito ng "Simulate Alert" / "Mark Waste Removed" buttons sa dashboard habang
// wala pang totoong hardware na naka-connect.
export const Route = createFileRoute("/api/sensor-reading")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => null);
        const fillLevel = Number((body as { fillLevel?: unknown } | null)?.fillLevel);
        if (!Number.isFinite(fillLevel)) {
          return Response.json({ error: "fillLevel (number, 0-100) is required" }, { status: 400 });
        }
        return Response.json(await reportSensorReading(fillLevel));
      },
      // Convenience lang: pwedeng tingnan ang kasalukuyang state dito rin
      GET: async () => Response.json(await getNotificationState()),
    },
  },
});
