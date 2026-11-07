# MD Academy — agent contract

## Agent ownership
- ChatGPT/app developers: learner experience, identity, course access, progress, branding, testing.
- Grok bots: course authoring, JSON draft metadata, and the eventual admin builder under `components/admin/`.
- Never let a bot edit shared authentication or RLS policies without a separate review.

## Grok authoring flow
1. Copy `content/examples/coach-foundations.json` and use `lib/course-contract.mjs` as the source schema.
2. Work in `content/courses/`, one JSON document per course.
3. `node scripts/validate-course.mjs <file>` must pass before PR.
4. Use registered media asset IDs, never signed URLs, raw tokens, Supabase keys, or private MP4 content.
5. Bots submit draft PRs; only verified human Academy admins approve publishing.

## Safety
- Repo was PUBLIC when work began. Do not commit proprietary training material or secrets.
- Never infer Academy enrollment from an ordinary MDC membership.
- Academy SSO must be one-time PKCE on a fixed canonical origin. No free-form return URLs.
- Store learner progress only after secure server authorization and RLS are implemented.
- Separate UniteHQ changes and migrations into reviewed coordinated PRs.
- No extra Vercel builds for every microcommit.
