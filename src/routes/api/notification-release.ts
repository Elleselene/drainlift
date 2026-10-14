import { createFileRoute } from "@tanstack/react-router";
import { releaseNotification } from "@/lib/server/notification-store";
import { getUserRole } from "@/lib/server/auth";

// Manual release request for an authenticated Admin or User.
// The notification store enforces the release state and fill-level rules.
export const Route = createFileRoute("/api/notification-release")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const role = await getUserRole(request);
        if (role !== "admin" && role !== "user") {
          return Response.json({ error: "Authenticated user access required" }, { status: 403 });
        }

        return Response.json(await releaseNotification());
      },
    },
  },
});