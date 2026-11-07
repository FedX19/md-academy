import { authenticateAcademy, privateHeaders } from "@/lib/academy-server";
import { fail, isUuid, parseSmallJson } from "@/lib/academy-input";

export async function GET(request: Request) {
  const user = await authenticateAcademy(request);
  if (!user) return fail("Sign in to see your certificates.", 401);
  const code = new URL(request.url).searchParams.get("code");
  if (code) {
    if (!/^[A-Fa-f0-9]{24}$/.test(code)) return fail("Invalid certificate.", 400);
    const { data, error } = await user.client.from("academy_certificates")
      .select("course_id,verification_code,issued_at,course_title,learner_name")
      .eq("user_id", user.id).eq("verification_code", code.toUpperCase()).maybeSingle();
    if (error || !data) return fail("Certificate not found.", 404);
    return Response.json({ certificate: data }, { headers: privateHeaders });
  }
  const { data, error } = await user.client.from("academy_certificates")
    .select("id,course_id,verification_code,issued_at,course_title,learner_name")
    .eq("user_id", user.id).order("issued_at", { ascending: false }).limit(100);
  return error ? fail("Unable to load certificates.", 503) : Response.json({ certificates: data ?? [] }, { headers: privateHeaders });
}

export async function POST(request: Request) {
  const user = await authenticateAcademy(request);
  if (!user) return fail("Sign in to complete your training.", 401);
  const body = await parseSmallJson(request);
  if (!body || !isUuid(body.courseId)) return fail("Invalid course.", 400);
  const { data, error } = await user.client.rpc("academy_issue_certificate", { p_course_id: body.courseId });
  if (error) return fail("Certificate not available. Finish all lessons and pass every assessment.", 409);
  return Response.json({ certificate: data }, { headers: privateHeaders });
}
