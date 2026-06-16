import { redirect } from "next/navigation";

import { GoWildDashboard } from "@/components/gowild-dashboard";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { hasSupabaseConfig } from "@/lib/env";

export default async function Home() {
  // When Supabase is configured (deployed/prod), require a real session and
  // pass the verified email down; the dashboard then relies on the session
  // cookie rather than the x-user-email dev shim.
  if (hasSupabaseConfig()) {
    const supabase = await createSupabaseServerClient();
    const user = supabase ? (await supabase.auth.getUser()).data.user : null;

    if (!user?.email) {
      redirect("/login");
    }

    return <GoWildDashboard mode="session" initialEmail={user.email} />;
  }

  // Local development without Supabase: header-shim mode (only works when
  // ALLOW_HEADER_AUTH=true; otherwise requests resolve to the demo user).
  return <GoWildDashboard mode="dev" initialEmail={null} />;
}
