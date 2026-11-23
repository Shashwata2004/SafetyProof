import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Config } from "./api";

let browserClient: SupabaseClient | null = null;
let browserClientKey = "";

export function getSupabaseBrowserClient(config: Config): SupabaseClient {
  const key = `${config.supabase_url}|${config.publishable_key}`;
  if (!browserClient || browserClientKey !== key) {
    browserClient = createClient(config.supabase_url, config.publishable_key);
    browserClientKey = key;
  }
  return browserClient;
}
