import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/server/supabase-admin";
import { requireAdmin } from "@/lib/server/auth";

export const Route = createFileRoute("/api/motor-control")({
  server: { handlers: {
    GET: async () => {
      const { data, error } = await supabaseAdmin.from("motor_control").select("enabled,updated_at").eq("id", 1).single();
      if (error || !data) return Response.json({ error: error?.message ?? "Motor control missing" }, { status: 500 });
      return Response.json({ enabled: data.enabled === true, updatedAt: data.updated_at });
    },
    POST: async ({ request }) => {
      if (!(await requireAdmin(request))) return Response.json({ error: "Admin access required" }, { status: 403 });
      const body = await request.json().catch(() => null) as { enabled?: unknown } | null;
      if (typeof body?.enabled !== "boolean") return Response.json({ error: "enabled must be boolean" }, { status: 400 });
      // Fail closed on missing database row; never claim success without a saved value.
      const { data, error } = await supabaseAdmin.from("motor_control")
        .update({ enabled: body.enabled, updated_at: new Date().toISOString() })
        .eq("id", 1).select("enabled,updated_at").single();
      if (error || !data) return Response.json({ error: error?.message ?? "Unable to save motor state" }, { status: 500 });
      return Response.json({ enabled: data.enabled === true, updatedAt: data.updated_at });
    },
  } },
});
