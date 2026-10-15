import { createFileRoute } from "@tanstack/react-router";
import { getUserRole } from "@/lib/server/auth";
import { acknowledgeNotification } from "@/lib/server/notification-store";

export const Route = createFileRoute("/api/notification-acknowledge")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const role = await getUserRole(request);
        if (role !== "admin" && role !== "user") {
          return Response.json({ error: "Login required" }, { status: 403 });
        }
        try {
          const { performed, state } = await acknowledgeNotification();
          return Response.json({ ok: performed, state });
        } catch (error) {
          console.error("[notification-acknowledge]", error);
          return Response.json({ error: "Unable to update notification" }, { status: 500 });
        }
      },
    },
  },
});
