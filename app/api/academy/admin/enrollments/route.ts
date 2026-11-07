import { authenticateAcademy, privateHeaders } from "@/lib/academy-server";
import { fail, isUuid, parseSmallJson } from "@/lib/academy-input";

export async function POST(request: Request) {
  const user = await authenticateAcademy(request);
  if (!user?.publisher) return fail("Only Academy administrators can enroll coaches.", 403);
  const body = await parseSmallJson(request);
  if (!body || !isUuid(body.courseId) || !isUuid(body.userId)) return fail("Invalid enrollment.", 400);
  const { data: course } = await user.client.from("academy_courses").select("status").eq("id", body.courseId).maybeSingle();
  if (course?.status !== "published") return fail("Only published courses can be assigned.", 400);
  const { data, error } = await user.client.from("academy_enrollments").upsert({
    user_id: body.userId, course_id: body.courseId, status: "active",
  }, { onConflict: "course_id,user_id" }).select("id").single();
  if (error) return fail("Could not assign coach. Verify the UniteHQ user ID.", 503);
  return Response.json({ enrollmentId: data.id, assigned: true }, { headers: privateHeaders });
}

export async function PATCH(request: Request) {
  const user = await authenticateAcademy(request);
  if (!user?.publisher) return fail("Only Academy administrators can revoke access.", 403);
  const body = await parseSmallJson(request);
  if (!body || !isUuid(body.courseId) || !isUuid(body.userId) || body.status !== "revoked") return fail("Invalid revocation.", 400);
  const { data, error } = await user.client.from("academy_enrollments").update({ status: "revoked" })
    .eq("course_id", body.courseId).eq("user_id", body.userId).select("id").maybeSingle();
  if (error) return fail("Could not revoke enrollment.", 503);
  return data ? Response.json({ revoked: true }, { headers: privateHeaders }) : fail("Enrollment not found.", 404);
}
