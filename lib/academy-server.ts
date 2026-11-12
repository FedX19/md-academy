import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type AcademyIdentity = {
  id: string;
  name: string;
  email: string | null;
  admin: boolean;
  author: boolean;
  publisher: boolean;
  client: SupabaseClient;
};
export const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Authorization" };
export function getPublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !url.startsWith("https://")) return null;
  return { url, key };
}
export async function authenticateAcademy(request: Request): Promise<AcademyIdentity | null> {
  const token = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1];
  const config = getPublicConfig();
  if (!token || !config) return null;
  const client = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: "Bearer " + token } },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user || data.user.is_anonymous) return null;
  const uid = data.user.id;
  const [roles, profile, authorCheck, publishCheck] = await Promise.all([
    client.from("academy_admin_roles").select("role").eq("user_id", uid).maybeSingle(),
    client.from("profiles").select("org_role,is_platform_admin,full_name").eq("id", uid).maybeSingle(),
    client.rpc("academy_can_author"),
    client.rpc("academy_can_publish"),
  ]);
  if (roles.error || profile.error || authorCheck.error || publishCheck.error) return null;
  const platformAdmin = profile.data?.org_role === "platform_admin" || profile.data?.is_platform_admin === true;
  // Even platform administrators must be on the internal Modern Day Coach staff roster.
  const publisher = (platformAdmin || roles.data?.role === "admin") && publishCheck.data === true;
  // Editor role alone is insufficient: current MDC staff must still be active.
  // Keep server authorization aligned with the database RLS helper.
  const author = authorCheck.data === true && (publisher || roles.data?.role === "editor");
  return {
    id: uid,
    name: profile.data?.full_name ?? data.user.email ?? "Member",
    email: data.user.email ?? null,
    admin: author,
    author,
    publisher,
    client,
  };
}
export async function hasCourseAccess(user: AcademyIdentity, courseId: string) {
  if (user.author) return true;
  const { data, error } = await user.client.from("academy_enrollments")
    .select("id").eq("course_id", courseId).eq("user_id", user.id).eq("status", "active").maybeSingle();
  return !error && !!data;
}
