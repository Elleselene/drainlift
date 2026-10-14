import { createFileRoute } from "@tanstack/react-router";
import { completeRelease } from "@/lib/server/notification-store";

export const Route = createFileRoute("/api/release-complete")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.DRAINLIFT_DEVICE_TOKEN;
        if (!expected || request.headers.get("x-device-token") !== expected) {
          return Response.json({ error: "Unauthorized device" }, { status: 401 });
        }
        try {
          return Response.json(await completeRelease());
        } catch (error) {
          console.error("[release-complete]", error);
          return Response.json({ error: "Unable to confirm release" }, { status: 500 });
        }
      },
    },
  },
});
