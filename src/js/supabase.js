import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.2";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

export const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

export async function getUser() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}

export async function ensureProfile(user) {
  if (!supabase || !user) return;
  const username = (user.user_metadata?.user_name || user.email?.split("@")[0] || "traveler")
    .toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
  await supabase.from("profiles").upsert({
    id: user.id,
    username,
    display_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Traveler",
    avatar_url: user.user_metadata?.avatar_url || null
  }, { onConflict: "id", ignoreDuplicates: true });
}
