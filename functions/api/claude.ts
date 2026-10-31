// GET /api/claude — the Claude log for the page (Supabase login with profiles.is_admin).
import { authenticate, callerKey, corsHeaders, json, rateLimited } from '../_lib/security'
import { readClaude } from '../_lib/claudeStore'

type Env = { SUPABASE_URL: string; SUPABASE_SERVICE_KEY: string }
export const onRequest = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  const headers = corsHeaders(request, 'GET, OPTIONS')
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return json({ error: 'Server not configured' }, 500, headers)
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405, headers)
  try {
    const caller = await authenticate(request, env)
    if (!caller || caller.kind !== 'admin') return json({ error: 'Unauthorized' }, 401, headers)
    if (rateLimited('claude:' + callerKey(caller, request), 90, 60_000)) return json({ error: 'Too many requests' }, 429, headers)
    return json({ data: await readClaude(env) }, 200, headers)
  } catch (e) { return json({ error: (e as Error).message }, 502, headers) }
}
