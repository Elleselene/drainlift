import { createClient } from "@supabase/supabase-js";

// Client-safe na Supabase client — ito ang gamit para sa LOGIN/LOGOUT (Supabase Auth) at
// pag-basa/pag-update ng SARILING profile ng naka-login na user.
//
// Ligtas ilantad ang "anon" key na ito sa browser — ang totoong proteksyon ay nasa Row Level
// Security (RLS) policies sa Supabase mismo, hindi sa pagtago ng key na ito.
//
// Para sa mga privileged na operations (hal. pag-record ng ultrasonic sensor readings, na
// dapat gumagana kahit walang naka-login), gamitin ang SERVER-ONLY client sa
// src/lib/server/supabase-admin.ts — huwag ito gamitin doon.
const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const supabaseAnonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    "[supabase] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — login won't work until these env vars are set.",
  );
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
);
