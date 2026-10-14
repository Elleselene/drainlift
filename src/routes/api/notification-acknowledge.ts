import { createFileRoute } from "@tanstack/react-router";
import { acknowledgeNotification } from "@/lib/server/notification-store";
import { getUserRole } from "@/lib/server/auth";

// Acknowledges the active alert without triggering the actuator.
export const Route = createFileRoute("/api/notification-acknowledge")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const role = await getUserRole(request);
        if (role !== "admin" && role !== "user") {
          return Response.json({ error: "Authenticated user access required" }, { status: 403 });
        }

        return Response.json(await acknowledgeNotification());
      },
    },
  },
});