import { EntranceScreen } from "@/components/brand/entrance-screen";

export default function Entrance() {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  return <EntranceScreen configured={configured} />;
}
