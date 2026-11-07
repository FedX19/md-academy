import { randomUUID } from "node:crypto";
import { authenticateAcademy, privateHeaders } from "@/lib/academy-server";
import { fail, isUuid, parseSmallJson } from "@/lib/academy-input";

// Authorize first; reserve a unique private path; upload directly from the browser with the learner's JWT.
export async function POST(request: Request) {
  const user = await authenticateAcademy(request);
  if (!user?.author) return fail("Academy editor access required.", 403);
  const body = await parseSmallJson(request);
  if (!body || !isUuid(body.courseId) || (body.mimeType !== "video/mp4" && body.mimeType !== "video/webm")) return fail("Invalid media request.", 400);
  const { data: course, error } = await user.client.from("academy_courses")
    .select("id,status").eq("id", body.courseId).maybeSingle();
  if (error || !course || (course.status === "published" && !user.publisher) || course.status === "archived") return fail("Course unavailable or locked.", 403);
  const path = "courses/" + body.courseId + "/" + randomUUID() + (body.mimeType === "video/mp4" ? ".mp4" : ".webm");
  const { data: asset, error: insertError } = await user.client.from("academy_media_assets")
    .insert({ storage_path: path, mime_type: body.mimeType }).select("id").single();
  if (insertError) return fail("Unable to register the private media.", 503);
  return Response.json({
    assetId: asset.id, bucket: "md-academy-private", path,
    allowedMimeType: body.mimeType, maxBytes: 314572800,
    instructions: "Upload to this exact path using the signed-in Supabase client. Never send videos through Vercel.",
  }, { status: 201, headers: privateHeaders });
}
