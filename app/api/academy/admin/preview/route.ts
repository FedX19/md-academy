import { authenticateAcademy, privateHeaders } from "@/lib/academy-server";
import { fail, isUuid, parseSmallJson } from "@/lib/academy-input";

/** Private, read-only curriculum preview. No enrollment or progress writes. */
export async function GET(request: Request) {
  const identity = await authenticateAcademy(request);
  if (!identity?.author) return fail("Academy editor access required.", 403);
  const url = new URL(request.url);
  const courseId = url.searchParams.get("courseId");
  const lessonId = url.searchParams.get("lessonId");
  if (isUuid(courseId) && !lessonId) {
    const { data, error } = await identity.client.from("academy_courses")
      .select("id,slug,title,summary,status,passing_score_pct,academy_modules(id,title,sort_order,academy_lessons(id,title,summary,lesson_type,body,duration_seconds,sort_order))")
      .eq("id", courseId).maybeSingle();
    if (error || !data) return fail("Course unavailable to preview.", 404);
    return Response.json({ course: data }, { headers: privateHeaders });
  }
  if (isUuid(lessonId) && !courseId) {
    const { data: lesson, error: lookupError } = await identity.client.from("academy_lessons")
      .select("id,lesson_type").eq("id", lessonId).maybeSingle();
    if (lookupError || lesson?.lesson_type !== "quiz") return fail("Assessment unavailable.", 404);
    const { data, error } = await identity.client.from("academy_quiz_questions")
      .select("id,prompt,choices,correct_index,sort_order")
      .eq("lesson_id", lessonId).order("sort_order", { ascending: true });
    if (error) return fail("Preview assessment unavailable.", 503);
    // Answer keys are only accessible to verified editors in this preview endpoint.
    return Response.json({ questions: data ?? [] }, { headers: privateHeaders });
  }
  return fail("Invalid preview request.", 400);
}

export async function POST(request: Request) {
  const identity = await authenticateAcademy(request);
  if (!identity?.author) return fail("Academy editor access required.", 403);
  const body = await parseSmallJson(request);
  if (!body || !isUuid(body.lessonId)) return fail("Invalid preview lesson.", 400);
  const { data: lesson, error } = await identity.client.from("academy_lessons")
    .select("id,lesson_type,media_asset_id").eq("id", body.lessonId).maybeSingle();
  if (error || lesson?.lesson_type !== "video" || !lesson.media_asset_id) return fail("No video has been uploaded for this draft lesson.", 404);
  const { data: asset, error: assetError } = await identity.client.from("academy_media_assets")
    .select("storage_path").eq("id", lesson.media_asset_id).maybeSingle();
  if (assetError || !asset) return fail("Private video asset unavailable.", 404);
  const { data: link, error: signError } = await identity.client.storage.from("md-academy-private").createSignedUrl(asset.storage_path, 900);
  if (signError || !link?.signedUrl) return fail("Preview video could not be loaded.", 503);
  return Response.json({ url: link.signedUrl, expiresInSeconds: 900 }, { headers: privateHeaders });
}
