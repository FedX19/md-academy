import { authenticateAcademy, privateHeaders } from "@/lib/academy-server";
import { fail, isUuid, parseSmallJson } from "@/lib/academy-input";

export async function GET(request: Request) {
  const user = await authenticateAcademy(request);
  if (!user) return fail("Sign in to access your assessment.", 401);
  const lessonId = new URL(request.url).searchParams.get("lessonId");
  if (!isUuid(lessonId)) return fail("Invalid quiz lesson.", 400);
  const { data, error } = await user.client.rpc("academy_get_quiz", { p_lesson_id: lessonId });
  if (error) return fail("Quiz unavailable or you are not enrolled.", 403);
  return Response.json({ questions: data ?? [] }, { headers: privateHeaders });
}

export async function POST(request: Request) {
  const user = await authenticateAcademy(request);
  if (!user) return fail("Sign in to submit your assessment.", 401);
  const body = await parseSmallJson(request);
  if (!body || !isUuid(body.lessonId) || !body.answers || typeof body.answers !== "object" || Array.isArray(body.answers)) {
    return fail("Invalid assessment.", 400);
  }
  const answers = body.answers as Record<string, unknown>;
  const entries = Object.entries(answers);
  if (!entries.length || entries.length > 50 || entries.some(([key, answer]) => !isUuid(key) || !Number.isInteger(answer) || (answer as number) < 0 || (answer as number) > 5)) {
    return fail("Answer each question with a valid choice.", 400);
  }
  const { data, error } = await user.client.rpc("academy_grade_quiz", {
    p_lesson_id: body.lessonId, p_answers: answers,
  });
  if (error) return fail("Submission rejected. Confirm your enrollment, quiz answers and attempt limit.", 409);
  return Response.json({ result: data }, { headers: privateHeaders });
}
