import { authenticateAcademy, privateHeaders } from "@/lib/academy-server";
import { fail, isOrder, isText, isUuid, parseSmallJson } from "@/lib/academy-input";

function validChoices(value: unknown): value is string[] {
  return Array.isArray(value) && value.length >= 2 && value.length <= 6
    && value.every(item => isText(item, 200));
}
export async function GET(request: Request) {
  const user = await authenticateAcademy(request);
  if (!user?.author) return fail("Editor access required.", 403);
  const lessonId = new URL(request.url).searchParams.get("lessonId");
  if (!isUuid(lessonId)) return fail("Invalid lesson.", 400);
  const { data, error } = await user.client.from("academy_quiz_questions")
    .select("id,lesson_id,prompt,choices,correct_index,explanation,sort_order")
    .eq("lesson_id", lessonId).order("sort_order", { ascending: true });
  return error ? fail("Questions not available.", 503) : Response.json({ questions: data ?? [] }, { headers: privateHeaders });
}
export async function POST(request: Request) {
  const user = await authenticateAcademy(request);
  if (!user?.author) return fail("Editor access required.", 403);
  const body = await parseSmallJson(request);
  if (!body || !isUuid(body.lessonId) || !isText(body.prompt, 800) || !validChoices(body.choices)
      || !Number.isInteger(body.correctIndex) || (body.correctIndex as number) < 0
      || (body.correctIndex as number) >= body.choices.length || !isOrder(body.sortOrder)) return fail("Invalid question.", 400);
  if (body.explanation !== undefined && (typeof body.explanation !== "string" || body.explanation.length > 1000)) return fail("Invalid explanation.", 400);
  const { data, error } = await user.client.from("academy_quiz_questions")
    .insert({
      lesson_id: body.lessonId, prompt: body.prompt, choices: body.choices,
      correct_index: body.correctIndex, explanation: body.explanation ?? "", sort_order: body.sortOrder,
    }).select("id").single();
  if (error) return fail(error.code === "23505" ? "Question order already in use." : "Question not created.", error.code === "23505" ? 409 : 503);
  return Response.json({ id: data.id }, { status: 201, headers: privateHeaders });
}
export async function PATCH(request: Request) {
  const user = await authenticateAcademy(request);
  if (!user?.author) return fail("Editor access required.", 403);
  const body = await parseSmallJson(request);
  if (!body || !isUuid(body.id)) return fail("Invalid question.", 400);
  const updates: Record<string, string | string[] | number> = {};
  if (body.prompt !== undefined) { if (!isText(body.prompt, 800)) return fail("Invalid prompt.", 400); updates.prompt = body.prompt; }
  if (body.choices !== undefined) { if (!validChoices(body.choices)) return fail("Invalid choices.", 400); updates.choices = body.choices; }
  if (body.correctIndex !== undefined) { if (!Number.isInteger(body.correctIndex) || (body.correctIndex as number) < 0 || (body.correctIndex as number) > 5) return fail("Invalid answer.", 400); updates.correct_index = body.correctIndex as number; }
  if (body.explanation !== undefined) { if (typeof body.explanation !== "string" || body.explanation.length > 1000) return fail("Invalid explanation.", 400); updates.explanation = body.explanation; }
  if (body.sortOrder !== undefined) { if (!isOrder(body.sortOrder)) return fail("Invalid order.", 400); updates.sort_order = body.sortOrder; }
  if (!Object.keys(updates).length) return fail("Nothing to update.", 400);
  const { data, error } = await user.client.from("academy_quiz_questions")
    .update(updates).eq("id", body.id).select("id").maybeSingle();
  if (error) return fail("Question update failed or answer index outside the choices.", 409);
  return data ? Response.json({ updated: true }, { headers: privateHeaders }) : fail("Question not available or course locked.", 404);
}
export async function DELETE(request: Request) {
  const user = await authenticateAcademy(request);
  if (!user?.author) return fail("Editor access required.", 403);
  const body = await parseSmallJson(request);
  if (!body || !isUuid(body.id)) return fail("Invalid question.", 400);
  const { data, error } = await user.client.from("academy_quiz_questions")
    .delete().eq("id", body.id).select("id").maybeSingle();
  if (error) return fail("Question could not be removed.", 503);
  return data ? Response.json({ deleted: true }, { headers: privateHeaders }) : fail("Question unavailable or course locked.", 404);
}
