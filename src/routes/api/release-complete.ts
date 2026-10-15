import { createFileRoute } from "@tanstack/react-router";
import { completeRelease } from "@/lib/server/notification-store";

export const Route = createFileRoute("/api/release-complete")({
  server: {
    handlers: {
      POST: async () => Response.json(await completeRelease()),
    },
  },
});