import { createFileRoute } from "@tanstack/react-router";
import { acknowledgeNotification } from "@/lib/server/notification-store";
import { requireAdmin } from "@/lib/server/auth";

// POST /api/notification-acknowledge — pinipindot ng barangay official kapag nakita na
// niya ang alert. Itigil ang countdown, hindi na kailangang i-activate ang actuator.
export const Route = createFileRoute("/api/notification-acknowledge")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await requireAdmin(request))) {
          return Response.json({ error: "Admin access required" }, { status: 403 });
        }

        return Response.json(await acknowledgeNotification());
      },
    },
  },
});