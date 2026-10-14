import { createFileRoute } from "@tanstack/react-router";
import { getUserRole } from "@/lib/server/auth";
import { releaseNotification } from "@/lib/server/notification-store";

export const Route = createFileRoute("/api/notification-release")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const role = await getUserRole(request);
        if (role !== "admin" && role !== "user") {
          return Response.json({ error: "Login required" }, { status: 403 });
        }
        try {
          return Response.json(await releaseNotification());
        } catch (error) {
          console.error("[notification-release]", error);
          return Response.json({ error: "Unable to update notification" }, { status: 500 });
        }
      },
    },
  },
});
