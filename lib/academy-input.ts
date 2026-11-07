export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const isSlug = (value: unknown): value is string =>
  typeof value === "string" && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value) && value.length <= 72;
export const isText = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
export const isOrder = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 10000;
export const isAudience = (x: unknown): x is "mdc-coach" | "league-coach" | "parent" | "public" =>
  x === "mdc-coach" || x === "league-coach" || x === "parent" || x === "public";
export const isLessonType = (x: unknown): x is "video" | "article" | "quiz" =>
  x === "video" || x === "article" || x === "quiz";
export function fail(error: string, status: number) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "private, no-store" } });
}
export async function parseSmallJson(request: Request): Promise<Record<string, unknown> | null> {
  if (Number(request.headers.get("content-length") ?? 0) > 65536) return null;
  try {
    const body: unknown = await request.json();
    return body !== null && typeof body === "object" && !Array.isArray(body)
      ? body as Record<string, unknown> : null;
  } catch {
    return null;
  }
}
