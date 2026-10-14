
import { createFileRoute } from "@tanstack/react-router";
import { getUserRole } from "@/lib/server/auth";

export const Route = createFileRoute("/api/user-role")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const role = await getUserRole(request);

        if (!role) {
          return Response.json(
            { error: "Unauthorized" },
            { status: 401 },
          );
        }

        return Response.json({ role });
      },
    },
  },
});
