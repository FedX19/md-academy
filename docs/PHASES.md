# MD Academy build gates

1. Branded app, PWA, responsive learner dashboard and sample preview — implemented.
2. UniteHQ single-use, PKCE, Academy-enrollment-gated sign-in — code implemented, domain/env live check pending.
3. Supabase RLS course schema, private media, resuming progress — implemented; real uploaded video test pending.
4. Grok-friendly admin APIs for course content, quiz questions, private video uploads and assignments — implemented; Grok UI owned separately.
5. Server-side assessments, immutable completion snapshots and print-ready internal certificates — implemented; real test course pending.
6. UniteHQ Platform tile next to MD Arcade, MD Live and Fundy Ball — implemented **behind environment flag**. Must remain off until Academy domain and real SSO check.
7. Security and launch QA — GitHub CI, database access checks; full device/playback production checks pending.

Do not claim a coach-ready launch until an enrolled coach completes one video, a quiz and a certificate on the configured canonical domain, and a revoked coach is denied access.
