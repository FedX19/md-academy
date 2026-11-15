import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "MD Academy — Modern Day Coach",
    short_name: "MD Academy",
    description: "The online coaching school for modern player development.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#08090b",
    theme_color: "#08090b",
    icons: [
      { src: "/icons/md-academy-192-v2.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/md-academy-512-v2.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/md-academy-maskable-512-v2.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/brand/md-academy-app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
