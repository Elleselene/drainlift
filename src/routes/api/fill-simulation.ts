
import { createFileRoute } from "@tanstack/react-router";
import { requireAdmin } from "@/lib/server/auth";
import {
  acknowledgeNotification,
  setBypassEnabled,
  getNotificationState,
  releaseNotification,
  setCarlaFillLevel,
} from "@/lib/server/notification-store";

type ActionBody = {
  action?: string;
  fillLevel?: number;
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
            startedAt: state.notificationSentAt
              ? new Date(state.notificationSentAt).toISOString()
              : null,
            releasedBy: state.releasedBy,
          });
        } catch (error) {
          console.error("[fill-simulation] GET failed:", error);

          return Response.json(
            { error: "Failed to load fill state" },
            { status: 500 },
          );
        }
      },

      POST: async ({ request }) => {
        if (!(await requireAdmin(request))) {
          return Response.json(
            { error: "Admin access required" },
            { status: 403 },
          );
        }

        const body = (await request.json().catch(() => null)) as
          | ActionBody
          | null;

        if (
          !body ||
          typeof body !== "object" ||
          Array.isArray(body)
        ) {
          return Response.json(
            { error: "Invalid request" },
            { status: 400 },
          );
        }

        try {
          switch (body.action) {
            case "toggle-bypass": {
              if (typeof (body as ActionBody & { enabled?: unknown }).enabled !== "boolean") {
                return Response.json({ error: "enabled (boolean) is required" }, { status: 400 });
              }
              const enabled = (body as ActionBody & { enabled: boolean }).enabled;
              const state = await setBypassEnabled(enabled);
              return Response.json({ ok: true, state });
            }

            case "set": {
              const level = body.fillLevel;

              if (
                typeof level !== "number" ||
                !Number.isInteger(level) ||
                level < 0 ||
                level > 100
              ) {
                return Response.json(
                  { error: "Fill level must be an integer from 0 to 100" },
                  { status: 400 },
                );
              }

              const state = await setCarlaFillLevel(level);

              return Response.json({
                ok: true,
                state,
              });
            }

            case "stop": {
              const state = await setBypassEnabled(false);

              return Response.json({
                ok: true,
                state,
              });
            }

            case "acknowledge": {
              const current = await getNotificationState();

              if (
                !current.fullOverrideActive ||
                current.fillLevel !== 100 ||
                current.notificationStatus !== "SENT"
              ) {
                return Response.json(
                  { error: "No active Carla alert to acknowledge" },
                  { status: 409 },
                );
              }

              const state = await acknowledgeNotification();

              return Response.json({
                ok: true,
                state,
              });
            }

            case "release": {
              const current = await getNotificationState();

              if (
                !current.fullOverrideActive ||
                current.fillLevel !== 100 ||
                !["SENT", "ACKNOWLEDGED"].includes(
                  current.notificationStatus,
                ) ||
                current.releasedAt !== null
              ) {
                return Response.json(
                  { error: "No eligible Carla alert to release" },
                  { status: 409 },
                );
              }

              const state = await releaseNotification();

              return Response.json({
                ok: true,
                state,
              });
            }

            default:
              return Response.json(
                { error: "Invalid action" },
                { status: 400 },
              );
          }
        } catch (error) {
          console.error("[fill-simulation] POST failed:", error);

          return Response.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to update fill state",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
