import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * A client that bypasses row-level security. Server-side only, never in a
 * component that ships to the browser.
 *
 * There is one legitimate use in this app: notifications. `profiles_read_own`
 * means a guest cannot read the host's email address, and nor should they — but
 * something has to look it up to tell the host a request arrived. That lookup
 * happens here, in code the member never sees, and nothing read through this
 * client is ever returned to the caller.
 *
 * Returns null when the service key is not configured, so a development setup
 * without one degrades to "no email sent" rather than crashing a request.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
