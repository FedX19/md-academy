import { EntranceScreen } from "@/components/brand/entrance-screen";

export default function SignIn() {
  const configured = Boolean(
    process.env.ACADEMY_ORIGIN &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  return <EntranceScreen configured={configured} />;
}
