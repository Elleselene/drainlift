import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/server/supabase-admin";
import { requireAdmin } from "@/lib/server/auth";

const DETECT_COOLDOWN_MS = 6000;

export const Route = createFileRoute("/api/motor-command")({
  server: {
    handlers: {
      GET: async () => {
        const { data, error } = await supabaseAdmin
          .from("motor_command")
          .select("*")
          .eq("id", 1)
          .single();

        if (error || !data) {
          return Response.json({ error: error?.message ?? "No command" }, { status: 500 });
        }

        return Response.json({
          command: data.command,
          commandId: data.command_id,
          serverTime: Date.now(),
        });
      },

      POST: async ({ request }) => {
        if (!(await requireAdmin(request))) {
          return Response.json({ error: "Admin access required" }, { status: 403 });
        }

        const body = (await request.json().catch(() => null)) as { command?: string } | null;
        if (body?.command !== "DETECT") {
          return Response.json({ error: "Invalid command" }, { status: 400 });
        }

        try {
          const { data: control, error: controlError } = await supabaseAdmin
            .from("motor_control").select("enabled").eq("id", 1).single();
          if (controlError || !control || control.enabled !== true) {
            return Response.json({ error: "Conveyor motor is disabled" }, { status: 409 });
          }
          const { data: state, error: stateError } = await supabaseAdmin
            .from("notification_state").select("actual_fill_level,full_override_active,fill_level").eq("id", 1).single();
          if (stateError || !state || Number(state.actual_fill_level) >= 100 || Number(state.fill_level) >= 100) {
            return Response.json({ error: "Conveyor unavailable while compartment is full or state is unknown" }, { status: 409 });
          }
          const { data: last } = await supabaseAdmin
            .from("motor_command")
            .select("command_id")
            .eq("id", 1)
            .maybeSingle();

          const lastId = Number(last?.command_id ?? 0);
          const now = Date.now();
          if (Number.isFinite(lastId) && now - lastId < DETECT_COOLDOWN_MS) {
            return Response.json({ ok: true, command: "DETECT", commandId: lastId, duplicate: true });
          }

          const { error } = await supabaseAdmin
            .from("motor_command")
            .update({
              command: "DETECT",
              command_id: now,
              created_at: new Date(now).toISOString(),
            })
            .eq("id", 1);

          if (error) {
            return Response.json({ error: error.message }, { status: 500 });
          }

          return Response.json({ ok: true, command: "DETECT", commandId: now });
        } catch (error) {
          console.error("[motor-command] POST failed:", error);
          return Response.json({ error: "Unable to send DETECT command" }, { status: 500 });
        }
      },
    },
  },
});
