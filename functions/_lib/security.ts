// Ported from bol-affiliate functions/_lib/security.ts (bol-studio origins added).
// Shared security helpers for Pages Functions (not a route: no onRequest export).

export interface AuthEnv {
    SUPABASE_URL: string
    SUPABASE_SERVICE_KEY: string
    BOT_API_KEY?: string
}

const ALLOWED_ORIGINS = new Set([
    'https://bol-affiliate.pages.dev',
    'https://bol-studio.pages.dev',
    'https://grokbot-ai-log.pages.dev',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:8788',
])

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function corsHeaders(request: Request, methods: string): Record<string, string> {
    const origin = request.headers.get('Origin') || ''
    const h: Record<string, string> = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Methods': methods,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Bot-Key',
        'Vary': 'Origin',
        'Cache-Control': 'no-store',
    }
    // Preview deployments: <hash>.bol-affiliate.pages.dev
    if (ALLOWED_ORIGINS.has(origin) || /^https:\/\/[a-z0-9-]+\.(bol-affiliate|bol-studio|grokbot-ai-log)\.pages\.dev$/.test(origin)) {
        h['Access-Control-Allow-Origin'] = origin
    }
    return h
}

export function json(body: unknown, status: number, headers: Record<string, string>): Response {
    return new Response(JSON.stringify(body), { status, headers })
}

/** Constant-time string compare. */
export function safeEqual(a: string, b: string): boolean {
    const enc = new TextEncoder()
    const x = enc.encode(a), y = enc.encode(b)
    let diff = x.length ^ y.length
    for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
    return diff === 0
}

export type Caller = { kind: 'bot' } | { kind: 'admin'; userId: string }

/**
 * Accepts either X-Bot-Key == BOT_API_KEY, or a Supabase access token (Authorization: Bearer)
 * belonging to a user whose profiles.is_admin = true. Returns null when unauthorised.
 */
export async function authenticate(request: Request, env: AuthEnv): Promise<Caller | null> {
    const botKey = request.headers.get('X-Bot-Key')
    if (botKey) {
        if (env.BOT_API_KEY && env.BOT_API_KEY.length >= 32 && safeEqual(botKey, env.BOT_API_KEY)) return { kind: 'bot' }
        return null
    }
    const auth = request.headers.get('Authorization') || ''
    const m = auth.match(/^Bearer\s+(\S+)$/i)
    if (!m || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return null
    const token = m[1]
    try {
        const userResp = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
            headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}` },
        })
        if (!userResp.ok) return null
        const user = await userResp.json() as { id?: string }
        if (!user?.id || !UUID_RE.test(user.id)) return null
        const profResp = await fetch(
            `${env.SUPABASE_URL}/rest/v1/profiles?select=is_admin&id=eq.${user.id}&limit=1`,
            { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } },
        )
        if (!profResp.ok) return null
        const rows = await profResp.json() as Array<{ is_admin: boolean | null }>
        return rows?.[0]?.is_admin === true ? { kind: 'admin', userId: user.id } : null
    } catch {
        return null
    }
}

/**
 * Best-effort fixed-window rate limit, per isolate (Workers isolates are not shared,
 * so this only slows bursts; use Cloudflare WAF rate-limiting rules for a hard limit).
 */
const buckets = new Map<string, { start: number; count: number }>()
export function rateLimited(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now()
    const b = buckets.get(key)
    if (!b || now - b.start > windowMs) {
        buckets.set(key, { start: now, count: 1 })
        if (buckets.size > 1000) for (const [k, v] of buckets) if (now - v.start > windowMs) buckets.delete(k)
        return false
    }
    b.count++
    return b.count > limit
}

export function callerKey(caller: Caller, request: Request): string {
    return caller.kind === 'admin' ? `u:${caller.userId}` : `bot:${request.headers.get('CF-Connecting-IP') || ''}`
}
