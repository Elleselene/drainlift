import { createFileRoute } from "@tanstack/react-router";
import { getNotificationState } from "@/lib/server/notification-store";

export const Route = createFileRoute("/api/notification")({
  server: {
    handlers: {
      GET: async () => {
        try {
          return Response.json(await getNotificationState(), {
            headers: { "Cache-Control": "no-store" },
          });
        } catch (error) {
          console.error("[notification] GET failed:", error);
          return Response.json({ error: "Unable to load notification state" }, { status: 500 });
        }
      },
    },
  },
});
