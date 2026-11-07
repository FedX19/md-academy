import { authenticateAcademy, privateHeaders } from "@/lib/academy-server";
import { fail, isUuid, parseSmallJson } from "@/lib/academy-input";

export async function POST(request: Request) {
  const user = await authenticateAcademy(request);
  if (!user?.publisher) return fail("Only a verified Academy administrator can publish courses.", 403);
  const body = await parseSmallJson(request);
  if (!body || !isUuid(body.courseId)) return fail("Invalid course.", 400);
  const { data, error } = await user.client.rpc("academy_publish_course", { p_course_id: body.courseId });
  if (error || data !== true) return fail("Publishing blocked: check course lessons, video uploads and draft status.", 409);
  return Response.json({ published: true }, { headers: privateHeaders });
}
