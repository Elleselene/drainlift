import { createFileRoute } from "@tanstack/react-router";
import { requireAdmin } from "@/lib/server/auth";
import {
  BypassRequiredError,
  getNotificationState,
  setBypassEnabled,
  setSimulatedFillLevel,
} from "@/lib/server/notification-store";

type ActionBody = {
  action?: string;
  enabled?: unknown;
  fillLevel?: unknown;
};

export const Route = createFileRoute("/api/fill-simulation")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const state = await getNotificationState();
          return Response.json({
            active: state.fullOverrideActive,
            fillLevel: state.fillLevel,
            status: state.notificationStatus,
          });
        } catch (error) {
          console.error("[fill-simulation] GET failed:", error);
          return Response.json({ error: "Failed to load fill state" }, { status: 500 });
        }
      },

      POST: async ({ request }) => {
        if (!(await requireAdmin(request))) {
          return Response.json({ error: "Admin access required" }, { status: 403 });
        }

        const body = (await request.json().catch(() => null)) as ActionBody | null;
        if (!body || typeof body !== "object" || Array.isArray(body)) {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }

        try {
          switch (body.action) {
            case "toggle-bypass": {
              if (typeof body.enabled !== "boolean") {
                return Response.json({ error: "enabled (boolean) is required" }, { status: 400 });
              }
              return Response.json({ ok: true, state: await setBypassEnabled(body.enabled) });
            }

            case "set": {
              const level = body.fillLevel;
              if (typeof level !== "number" || !Number.isInteger(level) || level < 0 || level > 100) {
                return Response.json(
                  { error: "Fill level must be an integer from 0 to 100" },
                  { status: 400 },
                );
              }
              return Response.json({ ok: true, state: await setSimulatedFillLevel(level) });
            }

            default:
              return Response.json({ error: "Invalid action" }, { status: 400 });
          }
        } catch (error) {
          if (error instanceof BypassRequiredError) {
            return Response.json({ error: error.message }, { status: 409 });
          }
          console.error("[fill-simulation] POST failed:", error);
          return Response.json({ error: "Failed to update fill state" }, { status: 500 });
        }
      },
    },
  },
});
