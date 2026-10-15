import { createFileRoute } from "@tanstack/react-router";
import { getNotificationState } from "@/lib/server/notification-store";

// GET /api/notification — kasalukuyang estado ng live alert. Dito nagpo-poll ang dashboard
// (Live Alert card) tuwing ilang segundo para manatiling sync sa totoong estado ng backend.
export const Route = createFileRoute("/api/notification")({
  server: {
    handlers: {
      GET: async () => Response.json(await getNotificationState()),
    },
  },
});
