import { authenticateAcademy, privateHeaders } from "@/lib/academy-server";
import { fail, isAudience, isUuid, parseSmallJson } from "@/lib/academy-input";

export async function POST(request: Request) {
  const user = await authenticateAcademy(request);
  if (!user?.publisher) return fail("Only a verified Academy administrator can publish courses.", 403);
  const body = await parseSmallJson(request);
  if (!body || !isUuid(body.courseId) || !isAudience(body.audience)) return fail("Choose who gets access before publishing.", 400);
  const { data: draft, error: updateError } = await user.client.from("academy_courses")
    .update({ audience: body.audience }).eq("id", body.courseId).in("status", ["draft", "review"])
    .select("id").maybeSingle();
  if (updateError || !draft) return fail("Course is unavailable or already published.", 409);
  const { data, error } = await user.client.rpc("academy_publish_course", { p_course_id: body.courseId });
  if (error || data !== true) return fail("Publishing blocked: check course lessons, video uploads and draft status.", 409);
  return Response.json({ published: true }, { headers: privateHeaders });
}
