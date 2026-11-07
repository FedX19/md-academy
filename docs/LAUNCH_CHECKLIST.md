# MD Academy launch checklist

These are configuration and verification steps, NOT a claim of completed launch.

## 1. Domain (owner)
Purchase/verify a suitable domain. In the **md-academy** Vercel project, add it in Settings → Domains and apply the DNS records Vercel supplies. Wait for HTTPS verification.

## 2. Vercel environment (owner, because the connected Vercel tool has no project-env write permission)

**md-academy** Vercel project (Production):
- `ACADEMY_ORIGIN` = `https://<verified-domain>` (no trailing slash)
- `NEXT_PUBLIC_SUPABASE_URL` = `https://xkubmjogdwsywdlpvydt.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = enabled **publishable/anon** key from that Supabase project's Settings → API Keys. Never use the service_role secret.

**unitehq** Vercel project (Production):
- `ACADEMY_ORIGIN` = same canonical `https://<verified-domain>`
- `NEXT_PUBLIC_MD_ACADEMY_ORIGIN` = same canonical `https://<verified-domain>`
- `NEXT_PUBLIC_MD_ACADEMY_ENABLED` = `true` **ONLY after steps 3–4 pass**.

Changes to NEXT_PUBLIC variables require a new deployment; batch with the validated production release instead of repeated builds.

## 3. Production validation (before visible Platform tile)
- Confirm new Academy app deployed at canonical domain.
- Start at `/api/auth/start` and complete the same single-use UniteHQ PKCE flow as MD Live.
- Verify platform admin entry, coach with explicit active enrollment, and denial to an ordinary unassigned UniteHQ member.
- Verify logged-out users cannot read private lessons, signed media, quiz answers, attempts or certificates.
- Upload one short MP4 directly to the `md-academy-private` bucket via authorized admin; publish a small test course; verify iPhone/Android/desktop start, seek, pause, resume, and 20-second progress saves.
- Grade a quiz, check incorrect answers do not pass, issue and print a real completion certificate.
- Revoke the test enrollment and verify no new playback signatures are issued.
- Confirm role and publish changes are logged appropriately in operational audit trails.

## 4. Go live
- Only after the checks, enable the UniteHQ Platform tile and perform one controlled production deployment.
- Check Vercel production deployment logs/analytics and failure count. Keep preview builds disabled.
- Grok bots own the admin course-builder UI, using documented REST endpoints; do not allow them to bypass review/publish gates.

## Pending
Domain and environment variables are intentionally not included in source control.
