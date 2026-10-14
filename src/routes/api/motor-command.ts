
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/server/supabase-admin";
import { requireAdmin } from "@/lib/server/auth";

export const Route = createFileRoute("/api/motor-command")({
  server: {
    handlers: {
      GET: async () => {
        const { data, error } = await supabaseAdmin
          .from("motor_command")
          .select("*")
          .eq("id", 1)
          .single();

        if (error) {
          return Response.json(
            { error: error.message },
            { status: 500 },
          );
        }

        return Response.json({
          command: data.command,
          commandId: data.command_id,
        });
      },

      POST: async ({ request }) => {
        const isAdmin = await requireAdmin(request);

        if (!isAdmin) {
          return Response.json(
            { error: "Admin access required" },
            { status: 403 },
          );
        }

        let body: { command?: string };

        try {
          body = await request.json();
        } catch {
          return Response.json(
            { error: "Invalid JSON" },
            { status: 400 },
          );
        }

        if (body?.command !== "DETECT") {
          return Response.json(
            { error: "Invalid command" },
            { status: 400 },
          );
        }

        const commandId = Date.now();

        const { error } = await supabaseAdmin
          .from("motor_command")
          .update({
            command: "DETECT",
            command_id: commandId,
            created_at: new Date().toISOString(),
          })
          .eq("id", 1);

        if (error) {
          return Response.json(
            { error: error.message },
            { status: 500 },
          );
        }

        return Response.json({
          ok: true,
          command: "DETECT",
          commandId,
        });
      },
    },
  },
});
