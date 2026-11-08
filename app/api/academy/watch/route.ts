import { authenticateAcademy, privateHeaders } from "@/lib/academy-server";
import { fail, isUuid, parseSmallJson } from "@/lib/academy-input";

const isPosition = (value: unknown): value is number =>
  Number.isInteger(value) && typeof value === "number" && value >= 0 && value <= 86400;

/** Start a server-owned watch session at the current player's saved position. */
export async function POST(request: Request) {
  const identity = await authenticateAcademy(request);
  if (!identity) return fail("Sign in to continue your training.", 401);
  const body = await parseSmallJson(request);
  if (!body || !isUuid(body.lessonId) || !isPosition(body.positionSeconds)) return fail("Invalid video session.", 400);
  const { data, error } = await identity.client.rpc("academy_begin_video_watch", {
    p_lesson_id: body.lessonId, p_position_seconds: body.positionSeconds,
  });
  if (error || !isUuid(data)) return fail("Published course enrollment required to begin video.", 403);
  return Response.json({ sessionId: data }, { headers: privateHeaders });
}

/** Count only server-timed sequential playback; seeking never earns watch credit. */
export async function PATCH(request: Request) {
  const identity = await authenticateAcademy(request);
  if (!identity) return fail("Sign in to save your video progress.", 401);
  const body = await parseSmallJson(request);
  if (!body || !isUuid(body.sessionId) || !isPosition(body.positionSeconds) ||
    (body.event !== "tick" && body.event !== "pause" && body.event !== "ended")) return fail("Invalid video progress.", 400);
  const { data, error } = await identity.client.rpc("academy_video_heartbeat", {
    p_session_id: body.sessionId, p_position_seconds: body.positionSeconds, p_event: body.event,
  });
  if (error) return fail("Video progress could not be saved. Reopen the lesson to reconnect.", 409);
  return Response.json({ watch: data }, { headers: privateHeaders });
}
