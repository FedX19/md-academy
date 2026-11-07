"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Award, Printer, ArrowLeft } from "lucide-react";
import { academyRequest } from "@/lib/academy-client";

type Certificate = { course_title: string; learner_name: string; issued_at: string; verification_code: string };
export function PrintCertificate() {
  const params = useSearchParams();
  const code = params.get("code");
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!code) { setError("Certificate code missing."); return; }
      try {
        const { certificate } = await academyRequest<{ certificate: Certificate }>(
          "/api/academy/certificates?code=" + encodeURIComponent(code)
        );
        if (!cancelled) setCertificate(certificate);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Certificate unavailable.");
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [code]);
  return <main className="certificate-page">
    <nav className="certificate-actions">
      <Link href="/school"><ArrowLeft size={18}/> Back to Academy</Link>
      {certificate ? <button type="button" onClick={() => window.print()}><Printer size={18}/> Print or save as PDF</button> : null}
    </nav>
    {error ? <p role="alert">{error} <Link href="/auth/start">Sign in again</Link></p> : null}
    {!certificate && !error ? <p role="status">Loading your certificate…</p> : null}
    {certificate ? <article className="certificate-paper" aria-label="MD Academy course completion certificate">
      <Image src="/brand/md-academy.svg" width={200} height={185} alt="MD Academy" priority />
      <div className="certificate-rule"/>
      <div className="certificate-kicker">MODERN DAY COACH EDUCATION</div>
      <h1>Certificate of Completion</h1>
      <p>This certifies that</p>
      <h2>{certificate.learner_name}</h2>
      <p>has completed the MD Academy learning course</p>
      <h3>{certificate.course_title}</h3>
      <div className="certificate-bottom">
        <span><Award size={23}/> MD Academy · Internal Coach Education</span>
        <span>Issued {new Date(certificate.issued_at).toLocaleDateString()}</span>
      </div>
      <small>Verification code: {certificate.verification_code}</small>
    </article> : null}
  </main>;
}
