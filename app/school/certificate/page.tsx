import { Suspense } from "react";
import { PrintCertificate } from "@/components/print-certificate";
export default function CertificatePage() {
  return <Suspense fallback={<main>Loading certificate…</main>}><PrintCertificate /></Suspense>;
}
