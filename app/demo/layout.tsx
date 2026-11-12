import { redirect } from "next/navigation";

// Retire public sample screens for the production Academy launch.
export default function DemoLayout({children}: {children: React.ReactNode}) {
  void children;
  redirect("/school");
}
