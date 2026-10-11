
import { createFileRoute } from "@tanstack/react-router";
import { clearFullOverride } from "@/lib/server/notification-store";

export const Route = createFileRoute("/api/full-override/clear")({
  server: {
    handlers: {
      POST: async () => {
        try {
          return Response.json(await clearFullOverride());
        } catch (error) {
          return Response.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to clear FULL override",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
