import { createFileRoute } from "@tanstack/react-router";
import { releaseNotification } from "@/lib/server/notification-store";

// POST /api/notification-release — manual na command para agad i-activate ang actuator
// (hal. emergency), kahit hindi pa tapos ang 5-minute na countdown.
export const Route = createFileRoute("/api/notification-release")({
  server: {
    handlers: {
      POST: async () => Response.json(await releaseNotification()),
    },
  },
});
