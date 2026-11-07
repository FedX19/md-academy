import Image from "next/image";
import { ArrowRight } from "lucide-react";

/** Uses the same logo, footer, spacing and compact typography as the Academy entry. */
export function AuthTransitionScreen({ error }: { error?: string | null }) {
  return (
    <main className="entrance academy-entrance">
      <div className="academy-entry-content">
        <div className="academy-entry-logo-wrap">
          <Image
            className="academy-entry-logo"
            src="/brand/md-academy.svg"
            alt="MD Academy"
            width={600}
            height={550}
            priority
          />
        </div>
        <h1 className="academy-entry-sr-only">MD Academy sign-in</h1>
        {error ? (
          <>
            <p className="academy-entry-tagline" role="status">Unable to sign in</p>
            <p className="academy-entry-unavailable" role="alert">{error}</p>
            <a className="academy-entry-button" href="/auth/start">
              Try again <ArrowRight aria-hidden="true" />
            </a>
          </>
        ) : (
          <p className="academy-entry-tagline" role="status">Signing you in…</p>
        )}
      </div>
      <a
        className="academy-entry-footer"
        href="https://unite-hq.com"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Powered by UniteHQ"
      >
        <span>Powered by</span>
        <Image src="/brand/unitehq-logo.svg" width={130} height={46} alt="UniteHQ" unoptimized />
      </a>
    </main>
  );
}
