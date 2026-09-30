import { createFileRoute } from "@tanstack/react-router";
import { acknowledgeNotification } from "@/lib/server/notification-store";

// POST /api/notification-acknowledge — pinipindot ng barangay official kapag nakita na
// niya ang alert. Itigil ang countdown, hindi na kailangang i-activate ang actuator.
export const Route = createFileRoute("/api/notification-acknowledge")({
  server: {
    handlers: {
      POST: async () => Response.json(await acknowledgeNotification()),
    },
  },
});
