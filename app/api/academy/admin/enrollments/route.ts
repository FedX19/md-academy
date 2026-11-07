import { authenticateAcademy, privateHeaders } from "@/lib/academy-server";
import { fail, isUuid, parseSmallJson } from "@/lib/academy-input";

async function resolveUser(user: NonNullable<Awaited<ReturnType<typeof authenticateAcademy>>>, body: Record<string, unknown>): Promise<string | null> {
  if (isUuid(body.userId)) return body.userId;
  if (typeof body.email !== "string" || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) return null;
  const { data, error } = await user.client.rpc("academy_lookup_user", { p_email: body.email.trim() });
  const found = data as { id?: unknown } | null;
  return !error && isUuid(found?.id) ? found.id : null;
}


export async function POST(request: Request) {
  const user = await authenticateAcademy(request);
  if (!user?.publisher) return fail("Only Academy administrators can enroll coaches.", 403);
  const body = await parseSmallJson(request);
  if (!body || !isUuid(body.courseId)) return fail("Invalid enrollment.", 400);
  const resolvedId = await resolveUser(user, body);
  if (!resolvedId) return fail("Verified UniteHQ coach not found. Check their email or user ID.", 404);
  const { data: course } = await user.client.from("academy_courses").select("status").eq("id", body.courseId).maybeSingle();
  if (course?.status !== "published") return fail("Only published courses can be assigned.", 400);
  const { data, error } = await user.client.from("academy_enrollments").upsert({
    user_id: resolvedId, course_id: body.courseId, status: "active",
  }, { onConflict: "course_id,user_id" }).select("id").single();
  if (error) return fail("Could not assign coach. Verify the UniteHQ user ID.", 503);
  return Response.json({ enrollmentId: data.id, assigned: true }, { headers: privateHeaders });
}

export async function PATCH(request: Request) {
  const user = await authenticateAcademy(request);
  if (!user?.publisher) return fail("Only Academy administrators can revoke access.", 403);
  const body = await parseSmallJson(request);
  if (!body || !isUuid(body.courseId) || body.status !== "revoked") return fail("Invalid revocation.", 400);
  const resolvedId = await resolveUser(user, body);
  if (!resolvedId) return fail("Verified UniteHQ coach not found.", 404);
  const { data, error } = await user.client.from("academy_enrollments").update({ status: "revoked" })
    .eq("course_id", body.courseId).eq("user_id", resolvedId).select("id").maybeSingle();
  if (error) return fail("Could not revoke enrollment.", 503);
  return data ? Response.json({ revoked: true }, { headers: privateHeaders }) : fail("Enrollment not found.", 404);
}
