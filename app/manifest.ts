import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
 return {
  id: "/", name: "MD Academy — Modern Day Coach", short_name: "MD Academy",
  description: "The online coaching school for modern player development.",
  start_url: "/", scope: "/", display: "standalone",
  background_color: "#08090b", theme_color: "#08090b",
  icons: [{ src: "/brand/md-academy.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }]
 };
}
