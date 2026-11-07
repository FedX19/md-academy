import { authenticateAcademy, privateHeaders } from "@/lib/academy-server";
import { fail, isAudience, isSlug, isText, isUuid, parseSmallJson } from "@/lib/academy-input";

export async function GET(request: Request) {
  const user = await authenticateAcademy(request);
  if (!user?.author) return fail("Academy editor access required.", 403);
  const { data, error } = await user.client.from("academy_courses")
    .select("id,slug,title,summary,status,audience,published_at,academy_modules(id,title,sort_order,academy_lessons(id,title,summary,lesson_type,body,duration_seconds,media_asset_id,sort_order))")
    .order("created_at", { ascending: false }).limit(100);
  return error ? fail("Cannot load courses.", 503) : Response.json({ courses: data ?? [] }, { headers: privateHeaders });
}

export async function POST(request: Request) {
  const user = await authenticateAcademy(request);
  if (!user?.author) return fail("Academy editor access required.", 403);
  const body = await parseSmallJson(request);
  if (!body || !isSlug(body.slug) || !isText(body.title, 100) ||
      !isText(body.summary, 320) || !isAudience(body.audience)) return fail("Invalid course details.", 400);
  const { data, error } = await user.client.from("academy_courses")
    .insert({ slug: body.slug, title: body.title, summary: body.summary, audience: body.audience, status: "draft" })
    .select("id,slug,title,status").single();
  if (error) return fail(error.code === "23505" ? "A course with that slug already exists." : "Course could not be created.", error.code === "23505" ? 409 : 503);
  return Response.json({ course: data }, { status: 201, headers: privateHeaders });
}

export async function PATCH(request: Request) {
  const user = await authenticateAcademy(request);
  if (!user?.author) return fail("Academy editor access required.", 403);
  const body = await parseSmallJson(request);
  if (!body || !isUuid(body.id)) return fail("Invalid course.", 400);
  const updates: Record<string, string> = {};
  if (body.slug !== undefined) { if (!isSlug(body.slug)) return fail("Invalid slug.", 400); updates.slug = body.slug; }
  if (body.title !== undefined) { if (!isText(body.title, 100)) return fail("Invalid title.", 400); updates.title = body.title; }
  if (body.summary !== undefined) { if (!isText(body.summary, 320)) return fail("Invalid summary.", 400); updates.summary = body.summary; }
  if (body.audience !== undefined) { if (!isAudience(body.audience)) return fail("Invalid audience.", 400); updates.audience = body.audience; }
  if (body.status !== undefined) {
    if (body.status !== "draft" && body.status !== "review") return fail("Use the protected publish endpoint to publish.", 400);
    updates.status = body.status;
  }
  if (!Object.keys(updates).length) return fail("Nothing to update.", 400);
  const { data, error } = await user.client.from("academy_courses")
    .update({ ...updates, updated_at: new Date().toISOString() }).eq("id", body.id)
    .select("id,slug,title,status").maybeSingle();
  if (error) return fail("Course could not be updated.", 503);
  return data ? Response.json({ course: data }, { headers: privateHeaders }) : fail("Course unavailable or locked.", 404);
}
