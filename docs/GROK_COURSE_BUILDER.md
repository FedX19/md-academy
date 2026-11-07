# Grok course-builder implementation handoff

The learner shell is independent from the course builder. Grok agents can contribute courses without changing React components.

## v1 draft interchange
Required: `schemaVersion=1`, `slug`, `title`, `summary`, `status`, `audience`, `modules[]`. Modules contain ordered `lessons[]` with `id`, `title`, `summary`, `type`, `estimatedMinutes`.

Lesson types: `video`, `article`, `quiz`. Videos reference an opaque `videoAssetId` issued by the future secure asset registry — never a link. A published video cannot omit its asset. The sample draft is in `content/examples/`.

## Administration UI to build
Four simple screens:
1. Course Setup — title, audience, metadata.
2. Modules & Lessons — reorder, upload approved video, attach resources, edit quizzes.
3. Review — validate, preview as a learner, correct missing fields.
4. Publish & Assign — confirmation from a verified admin, immutable revision, assign to approved users.

## Planned headless APIs (not deployed)
- `POST /api/admin/courses` — create draft
- `PUT /api/admin/courses/:id/draft` — revise
- `POST /api/admin/media/upload-intent` — scoped resumable upload
- `POST /api/admin/courses/:id/submit-review` — review
- `POST /api/admin/courses/:id/publish` — human authorization required
- `POST /api/admin/enrollments` — assign verified profiles

These endpoints are **design contracts only**. They must not exist as open write APIs. Add server-side roles, idempotency keys, ownership checks, RLS and audit trails first.

## Course publishing protections
Agents may draft but may not publish directly, issue certificates, or access arbitrary learners. Never expose service-role or storage signing secrets to bots. Publishing must version the course so existing completions remain verifiable.
