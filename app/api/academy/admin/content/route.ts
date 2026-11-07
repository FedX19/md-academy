import { authenticateAcademy, privateHeaders } from "@/lib/academy-server";
import { fail, isLessonType, isOrder, isText, isUuid, parseSmallJson } from "@/lib/academy-input";

export async function POST(request: Request) {
  const user = await authenticateAcademy(request);
  if (!user?.author) return fail("Academy editor access required.", 403);
  const body = await parseSmallJson(request);
  if (!body || !isText(body.title, 100) || !isOrder(body.sortOrder)) return fail("Invalid content.", 400);

  if (body.kind === "module") {
    if (!isUuid(body.courseId)) return fail("Invalid course.", 400);
    const { data, error } = await user.client.from("academy_modules")
      .insert({ course_id: body.courseId, title: body.title, sort_order: body.sortOrder })
      .select("id,course_id,title,sort_order").single();
    return error ? fail(error.code === "23505" ? "That module order is occupied." : "Module not created.", error.code === "23505" ? 409 : 503)
      : Response.json({ module: data }, { status: 201, headers: privateHeaders });
  }

  if (body.kind === "lesson") {
    if (!isUuid(body.moduleId) || !isLessonType(body.type) || !isText(body.summary, 500) ||
        !Number.isInteger(body.durationSeconds) || (body.durationSeconds as number) < 0 || (body.durationSeconds as number) > 5400) return fail("Invalid lesson.", 400);
    if (body.mediaAssetId !== undefined && body.mediaAssetId !== null && !isUuid(body.mediaAssetId)) return fail("Invalid asset.", 400);
    if (body.body !== undefined && (typeof body.body !== "string" || body.body.length > 20000)) return fail("Lesson body too long.", 400);
    const { data, error } = await user.client.from("academy_lessons")
      .insert({
        module_id: body.moduleId, title: body.title, summary: body.summary,
        lesson_type: body.type, body: body.body ?? "", sort_order: body.sortOrder,
        duration_seconds: body.durationSeconds, media_asset_id: body.type === "video" ? body.mediaAssetId ?? null : null,
      }).select("id,module_id,title,sort_order").single();
    return error ? fail(error.code === "23505" ? "That lesson order is occupied." : "Lesson not created.", error.code === "23505" ? 409 : 503)
      : Response.json({ lesson: data }, { status: 201, headers: privateHeaders });
  }
  return fail("Unknown content kind.", 400);
}

export async function PATCH(request: Request) {
  const user = await authenticateAcademy(request);
  if (!user?.author) return fail("Academy editor access required.", 403);
  const body = await parseSmallJson(request);
  if (!body || !isUuid(body.id)) return fail("Invalid content ID.", 400);
  const updates: Record<string, string | number | null> = {};
  if (body.title !== undefined) {
    if (!isText(body.title, 100)) return fail("Invalid title.", 400);
    updates.title = body.title;
  }
  if (body.sortOrder !== undefined) {
    if (!isOrder(body.sortOrder)) return fail("Invalid order.", 400);
    updates.sort_order = body.sortOrder;
  }
  if (body.kind === "lesson") {
    if (body.summary !== undefined) { if (!isText(body.summary, 500)) return fail("Invalid summary.", 400); updates.summary = body.summary; }
    if (body.body !== undefined) { if (typeof body.body !== "string" || body.body.length > 20000) return fail("Invalid content body.", 400); updates.body = body.body; }
    if (body.durationSeconds !== undefined) { if (typeof body.durationSeconds !== "number" || !Number.isInteger(body.durationSeconds) || body.durationSeconds < 0 || body.durationSeconds > 5400) return fail("Invalid duration.", 400); updates.duration_seconds = body.durationSeconds; }
    if (body.mediaAssetId !== undefined) { if (body.mediaAssetId !== null && !isUuid(body.mediaAssetId)) return fail("Invalid asset.", 400); updates.media_asset_id = body.mediaAssetId; }
  } else if (body.kind !== "module") return fail("Unknown content kind.", 400);
  if (!Object.keys(updates).length) return fail("Nothing to update.", 400);
  const table = body.kind === "lesson" ? "academy_lessons" : "academy_modules";
  const { data, error } = await user.client.from(table).update(updates).eq("id", body.id).select("id").maybeSingle();
  if (error) return fail("Content could not be updated.", 503);
  return data ? Response.json({ updated: true }, { headers: privateHeaders }) : fail("Content unavailable or locked.", 404);
}
