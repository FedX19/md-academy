# MD Academy

Modern Day Coach's standalone black-and-orange online coaching school. Launched from **UniteHQ → Platform** next to MD Arcade and MD Live.

## State

- Learner app, video resume, private signed Supabase Storage playback, RLS, progress, server-graded quizzes, and printable internal certificates are implemented on the Academy integration branch.
- Admin course-authoring REST APIs are available for Grok's future course-builder UI. Publishing and course enrollment are limited to verified human administrators.
- Real coaches are only able to enter after Academy-specific enrollment; a generic UniteHQ subscription is not access.
- **Domain, per-project Vercel environment variables, and end-to-end live-device testing are required before enabling the UniteHQ tile.** No placeholder videos or fake certificates are production learning.
- The repository is PUBLIC. Do not commit proprietary course videos, private training scripts, Supabase service keys, or learner data.

## Developer quick start

`npm ci`, `npm run test`, `npm run lint`, `npm run typecheck`, `npm run build`.

Use `.env.example` and [launch checklist](docs/LAUNCH_CHECKLIST.md) for environment setup.
Grok agents: read [authoring contract](docs/GROK_COURSE_BUILDER.md) and `AGENTS.md`.

## Ownership and rollout

- Course builder UI: Grok, limited to `components/admin/` and documented endpoints.
- Academy learner and server security: protected app code and Supabase migrations.
- Course publishing: explicit verified admin approval.
- Vercel preview deployments are disabled to limit spend. Validate by GitHub Actions and perform only necessary production deployments.
