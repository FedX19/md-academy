# MD Academy

Standalone Modern Day Coach learning application, designed to launch from UniteHQ next to Fundy Ball, MD Arcade, and MD Live.

## Phase 1
Brand foundation, responsive course interface, and Grok-friendly course documents. No real coach data or proprietary lessons should be committed until repository visibility is reviewed.

## Ownership
- Learner app and secure integrations: MD Academy application team.
- Course authoring and future admin builder: Grok bots, isolated under `content/courses/` and `components/admin/`.
- Publishing: a verified human admin, never an unrestricted bot.

## Safety
- The repo was **public** when scaffolding began.
- Never commit Supabase service keys, learner data, protected videos, or internal course scripts.
- Course SSO and membership gates will be implemented independently of the sample preview.
- Use short-lived, server-verified course-specific enrollments and private Supabase media.

See the evolving implementation and Grok content contracts in this repository.
