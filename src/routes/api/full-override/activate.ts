
import { createFileRoute } from "@tanstack/react-router";
import { activateFullOverride } from "@/lib/server/notification-store";

export const Route = createFileRoute("/api/full-override/activate")({
  server: {
    handlers: {
      POST: async () => {
        try {
          return Response.json(await activateFullOverride());
        } catch (error) {
          return Response.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to activate FULL override",
            },
            { status: 409 },
          );
        }
      },
    },
  },
});
