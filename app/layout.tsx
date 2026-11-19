import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MD Academy | Modern Day Coach",
  description: "First-principles player development education for authorized MDC coaches and parents.",
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  applicationName: "MD Academy",
  appleWebApp: { capable: true, title: "MD Academy", statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/md-academy-app-icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon-v2.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = { themeColor: "#08090b" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
