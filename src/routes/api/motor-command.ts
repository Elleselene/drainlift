import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/server/supabase-admin";

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
        const body = await request.json();

        if (body.command !== "DETECT") {
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