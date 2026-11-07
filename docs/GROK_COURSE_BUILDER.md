# MD Academy: Grok bot authoring contract (API v1)

**Owner split:** Grok builds the admin UI and prepares course content. The app team owns enrollment security, private video delivery, assessments, and certificates. Course publishing and learner enrollment require a verified administrator; editor bots cannot self-publish.

## Authentication
- Sign in via the UniteHQ PKCE flow on the canonical Academy domain.
- All protected APIs accept the current Supabase access JWT as `Authorization: Bearer <jwt>`.
- **Never embed a service-role key, temporary signed video URL, or browser token in course JSON, Git, bot prompts, logs or screenshots.**
- Public GitHub repository: only placeholder/sample content belongs in `content/` until the repo is made private.

## Course Builder's simple steps

1. **Course setup:** `POST /api/academy/admin/courses` with `{"slug":"coach-foundations","title":"MDC Coach Foundations","summary":"Core coaching standards","audience":"mdc-coach"}`. Draft returned with `course.id`. `PATCH` same endpoint to edit with `id`, `title`, `summary`, `slug`, `audience`, `status` ("draft"/"review" only).
2. **Modules:** `POST /api/academy/admin/content` with `{"kind":"module","courseId":"<uuid>","title":"The Winning Way","sortOrder":0}`. Return `module.id`.
3. **Video:** `POST /api/academy/admin/media` with `{"courseId":"<uuid>","mimeType":"video/mp4"}`. Use the returned `bucket` and `path` in the existing signed-in Supabase Storage client to **upload directly to the private bucket**, never through Vercel. Maximum 300 MiB, MP4/WebM only. Register every clip before upload.
4. **Lessons:** `POST /api/academy/admin/content` with `{"kind":"lesson","moduleId":"<uuid>","title":"Throwing Strikes","summary":"How we teach command","type":"video","durationSeconds":360,"mediaAssetId":"<asset-uuid>","sortOrder":0}`. Types: `video`, `article`, `quiz`. `PATCH` `/api/academy/admin/content` with `kind`, `id`, and editable fields. `DELETE` for draft/review lessons or modules (planned; do not assume enabled until verified).
5. **Quiz questions:** `POST /api/academy/admin/questions` with `{"lessonId":"<uuid>","prompt":"Which is the priority?","choices":["Throw strikes","Avoid contact"],"correctIndex":0,"sortOrder":0}`. Optional `explanation`. `GET /api/academy/admin/questions?lessonId=<uuid>` for editing. `PATCH` and `DELETE` supported for draft/review.
6. **Preview and review:** `GET /api/academy/admin/courses`. The admin UI must preview all lesson types and request human approval.
7. **Publish:** `POST /api/academy/admin/publish` with `{"courseId":"<uuid>"}`. **Verified Academy admin only.** Database checks for lessons, real uploaded videos, and quiz questions. Published content is frozen until versioning is implemented.
8. **Enroll a coach:** `POST /api/academy/admin/enrollments` with `{"courseId":"<uuid>","email":"coach@example.com"}`. **Admin only.** Alternatively pass a verified UniteHQ user UUID as `userId`. To revoke: `PATCH` with `{"courseId":"<uuid>","email":"coach@example.com","status":"revoked"}`. Revocation blocks SSO course access and new playback links.

## Learner APIs (not admin tooling)
- `GET /api/academy/me`, `GET /api/academy/courses`, `GET|PUT /api/academy/progress`
- `POST /api/academy/playback` returns a short-lived private signed URL
- `GET /api/academy/quiz?lessonId=<uuid>` strips answer keys; `POST` answers server-graded
- `GET|POST /api/academy/certificates` issue only after all required lessons completed and quizzes passed

## Bot guardrails
- Work inside `components/admin/`, authoring JSON, and the explicitly documented endpoints. Do not edit auth, RLS, Supabase migrations, role checks, or publishing RPCs.
- No automatic production publishing or enrollment; human approval required.
- Use unique 0-based `sortOrder` within each parent; two bots writing the same order get a conflict and should reload.
- Keep media references as opaque UUIDs. Use the existing session JWT to upload directly from the admin's browser; do not share the JWT with external agents.
- Course data in `content/examples/` is not live. The authoritative published course lives in Supabase.
- The domain and Academy-specific SSO environment variables must be set before testing real learning access.

**Certificates:** once videos and assessments are complete, the learner can issue an internal MDC completion certificate and print/save it as a PDF from the school. Certificate snapshots remain stable if a course is updated later.
