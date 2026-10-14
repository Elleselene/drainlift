
import { supabaseAdmin } from "./supabase-admin";

export type UserRole = "admin" | "user";

export async function getAuthenticatedUser(
  request: Request,
) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice(7).trim();

  if (!token) return null;

  const { data, error } =
    await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) return null;

  return data.user;
}

export async function getUserRole(
  request: Request,
): Promise<UserRole | null> {
  const user = await getAuthenticatedUser(request);

  if (!user) return null;

  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (error || !data) return null;

  if (data.role === "admin") return "admin";
  if (data.role === "user") return "user";

  return null;
}

export async function requireAdmin(request: Request) {
  return (await getUserRole(request)) === "admin";
}
