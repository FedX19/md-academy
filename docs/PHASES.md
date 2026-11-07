# MD Academy build gates

1. **Foundation:** branded entrance, sample dashboard, course catalog and lesson preview, bot draft validator. In progress.
2. **Identity:** Academy-specific UniteHQ PKCE exchange, server verified Academy roles and assignments.
3. **Learner persistence:** isolated Supabase academy tables, private media bucket, RLS, per-lesson resumable progress.
4. **Admin builder:** Grok-built course UI and validated headless API, protected uploads, admin approval.
5. **Assessments:** server-graded quizzes, attempt limits, immutable certificates.
6. **Platform:** Academy tile next to MD Arcade, MD Live, Fundy Ball; canonical domain and login checks.
7. **Hardening:** real iOS/Android playback, mobile usability, revocation tests, budget/performance monitoring.

NO production Supabase migrations, passwordless SSO routes, private media serving, payments or certificates have been activated in phase 1.
