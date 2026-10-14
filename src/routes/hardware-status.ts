import { createFileRoute } from "@tanstack/react-router";
import { reportHardwareStatus } from "@/lib/server/notification-store";

export const Route = createFileRoute("/api/hardware-status")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.DRAINLIFT_DEVICE_TOKEN;
        if (!token || request.headers.get("x-device-token") !== token) {
          return Response.json({ error: "Unauthorized device" }, { status: 401 });
        }
        const body = await request.json().catch(() => null);
        if (typeof body?.active !== "boolean") {
          return Response.json({ error: "active must be a boolean" }, { status: 400 });
        }
        try {
          return Response.json(await reportHardwareStatus(body.active));
        } catch (error) {
          console.error("[hardware-status]", error);
          return Response.json({ error: "Status update failed" }, { status: 500 });
        }
      },
    },
  },
});
