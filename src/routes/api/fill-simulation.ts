import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/server/supabase-admin";
import { requireAdmin } from "@/lib/server/auth";

const TABLE = "fill_simulation";
const WINDOW_MS = 5 * 60 * 1000;

export const Route = createFileRoute("/api/fill-simulation")({
  server: {
    handlers: {
      GET: async () => {
        const { data, error } = await supabaseAdmin
          .from(TABLE)
          .select("*")
          .eq("id", 1)
          .single();

        if (error) {
          return Response.json({ error: error.message }, { status: 500 });
        }

        const expired =
          data.active &&
          data.status === "SENT" &&
          data.started_at &&
          Date.now() - new Date(data.started_at).getTime() >= WINDOW_MS;

        return Response.json({
          active: data.active,
          fillLevel: data.fill_level,
          status: expired ? "EXPIRED" : data.status,
          startedAt: data.started_at,
          releasedBy: expired ? "auto" : data.released_by,
        });
      },

      POST: async ({ request }) => {
        if (!(await requireAdmin(request))) {
          return Response.json(
            { error: "Admin access required" },
            { status: 403 }
          );
        }

        const body = await request.json().catch(() => null);

        if (!body || typeof body !== "object") {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }

        const { data: current, error: readError } = await supabaseAdmin
          .from(TABLE)
          .select("*")
          .eq("id", 1)
          .single();

        if (readError || !current) {
          return Response.json(
            { error: readError?.message ?? "Simulation not found" },
            { status: 500 }
          );
        }

        const action = body.action;

        if (action === "stop") {
          const { error } = await supabaseAdmin
            .from(TABLE)
            .update({
              active: false,
              fill_level: 0,
              status: "NOT_SENT",
              started_at: null,
              released_by: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", 1);

          return error
            ? Response.json({ error: error.message }, { status: 500 })
            : Response.json({ ok: true });
        }

        if (action === "set") {
          if (
            typeof body.fillLevel !== "number" ||
            !Number.isInteger(body.fillLevel) ||
            body.fillLevel < 0 ||
            body.fillLevel > 100
          ) {
            return Response.json({ error: "Invalid fill level" }, { status: 400 });
          }

          const full = body.fillLevel === 100;
          const keepCycle =
            full &&
            current.active &&
            current.fill_level === 100;

          const { error } = await supabaseAdmin
            .from(TABLE)
            .update({
              active: true,
              fill_level: body.fillLevel,
              status: keepCycle
                ? current.status
                : full ? "SENT" : "NOT_SENT",
              started_at: keepCycle
                ? current.started_at
                : full ? new Date().toISOString() : null,
              released_by: keepCycle ? current.released_by : null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", 1);

          return error
            ? Response.json({ error: error.message }, { status: 500 })
            : Response.json({ ok: true });
        }

        if (action === "acknowledge" || action === "release") {
          if (!current.active || current.fill_level !== 100) {
            return Response.json({ error: "No full simulation" }, { status: 400 });
          }

          const expired =
            current.status === "SENT" &&
            current.started_at &&
            Date.now() - new Date(current.started_at).getTime() >= WINDOW_MS;

          if (expired || current.status === "EXPIRED") {
            return Response.json({ error: "Simulation expired" }, { status: 409 });
          }

          if (action === "acknowledge" && current.status !== "SENT") {
            return Response.json({ error: "Cannot acknowledge" }, { status: 409 });
          }

          if (action === "release" && current.released_by) {
            return Response.json({ error: "Already released" }, { status: 409 });
          }

          const { error } = await supabaseAdmin
            .from(TABLE)
            .update({
              status: action === "release" ? "EXPIRED" : "ACKNOWLEDGED",
              released_by: action === "release" ? "manual" : null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", 1);

          return error
            ? Response.json({ error: error.message }, { status: 500 })
            : Response.json({ ok: true });
        }

        return Response.json({ error: "Invalid action" }, { status: 400 });
      },
    },
  },
});