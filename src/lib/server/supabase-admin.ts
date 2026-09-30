import { createClient } from "@supabase/supabase-js";

// Server-only Supabase client — gumagamit ito ng SERVICE ROLE key, na may BUONG access sa
// database (nilalampasan nito ang Row Level Security policies). Kaya BAWAL itong ma-expose
// sa browser.
//
// Ligtas ito dahil nasa loob ito ng "src/lib/server/" folder — naka-configure sa
// vite.config.ts (importProtection) na bawal i-import ng anumang client-side code ang
// anumang file sa ilalim ng isang folder na "server". Ito lang ang gagamitin ng mga server
// routes sa src/routes/api/*.ts.
const supabaseUrl = process.env["SUPABASE_URL"];
const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

if (!supabaseUrl || !serviceRoleKey) {
  // eslint-disable-next-line no-console
  console.warn(
    "[supabase] Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — backend Supabase calls will fail.",
  );
}

export const supabaseAdmin = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  serviceRoleKey || "placeholder-service-role-key",
  { auth: { persistSession: false } },
);
