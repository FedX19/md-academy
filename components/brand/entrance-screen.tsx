import Image from "next/image";
import { ArrowRight } from "lucide-react";

type EntranceScreenProps = { configured: boolean };

/** Identical MDC app-entrance proportions for both Academy entry points. */
export function EntranceScreen({ configured }: EntranceScreenProps) {
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
        <h1 className="academy-entry-sr-only">MD Academy coaching school</h1>
        <p className="academy-entry-tagline">Learn the coaching system.</p>
        {configured ? (
          <a className="academy-entry-button" href="/api/auth/start">
            Enter MD Academy <ArrowRight aria-hidden="true" />
          </a>
        ) : (
          <p className="academy-entry-unavailable" role="status">
            MD Academy sign-in will open when your domain is connected.
          </p>
        )}
      </div>
      <a className="academy-entry-footer" href="https://unite-hq.com" target="_blank" rel="noopener noreferrer" aria-label="Powered by UniteHQ">
        <span>Powered by</span>
        <Image src="/brand/unitehq-logo.svg" width={130} height={46} alt="UniteHQ" unoptimized />
      </a>
    </main>
  );
}
