# Grokbot AI log

The Dev log page from BOL Studio as its own project. Same Supabase backend and logins. Cloudflare Pages project `grokbot-ai-log`
(https://grokbot-ai-log.pages.dev), Vite + React, Pages Functions in `functions/`.

```bash
cp .env.example .env.local   # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (same as bol-studio)
npm run dev                  # Node >= 22.12
npm run build && npx wrangler pages deploy dist --project-name grokbot-ai-log --branch main --commit-dirty=true
```

Pages secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `DEVLOG_INGEST_KEYS` (and `SRT_WORKER_KEY` only if the old collector still posts here).

## Bots write Dev log entries over HTTPS

`POST /api/devlog/ingest` with `Authorization: Bearer <bot key>`. The bot name comes from the key, so one bot can't log as another.
Entries go into the `devlog` bucket (`state.json`), the same data `/api/devlog` serves, so the page shows them straight away.
Limits: 60 requests/minute per bot, text up to 500 characters, usage 0-100. Secret-looking strings are redacted.
The old box collector replaces the whole snapshot on every push, so stop it once bots use this endpoint.

### Add a bot key

`DEVLOG_INGEST_KEYS` is a comma-separated list of `botname:key` (bot name: letters, digits, `_`, `-`; key: at least 32 characters).
`wrangler pages secret put` overwrites the whole value, so include the bots you already have:

```bash
KEY=$(openssl rand -hex 24)   # give this to the bot; do not commit it
echo "Technical:$KEY,Existing:oldkey" | npx wrangler pages secret put DEVLOG_INGEST_KEYS --project-name grokbot-ai-log
```

The new key works from the next deployment (redeploy after changing the secret).

### curl

```bash
U=https://grokbot-ai-log.pages.dev/api/devlog/ingest; H="Authorization: Bearer $DEVLOG_KEY"
curl -sS -X POST $U -H "$H" -d '{"type":"task-start","name":"Fix login","usage":13.7,"repo":"bol-studio"}'   # {"data":{"id":"t1a2b3c"}}
curl -sS -X POST $U -H "$H" -d '{"type":"step","id":"t1a2b3c","msg":"Wrote the test"}'
curl -sS -X POST $U -H "$H" -d '{"type":"task-end","id":"t1a2b3c","usage":13.9}'
```

Errors come back as `{"error":"..."}`: 400 bad input, 401 bad key, 403 task belongs to another bot, 429 rate limit.

### Client script

`scripts/devlog.sh` (curl only; reads `DEVLOG_KEY` and optional `DEVLOG_URL`):

```bash
ID=$(scripts/devlog.sh task-start "Fix login" --usage 13.7 --repo bol-studio)
scripts/devlog.sh step "Wrote the test" --id "$ID"
scripts/devlog.sh task-end --usage 13.9 --id "$ID"
```

## Claude log (`/claude`)

Which Claude Code session or project used the most of the plan limits. Same limits cover claude.ai chats, but those can't be attributed
(no hooks, no token data): they only show up as a rise in the account percent.

- `scripts/claude-hook.py` is a Claude Code hook (SessionStart, Stop, SessionEnd). It reads token totals from the session transcript (counts only),
  reads the 5-hour / weekly percent from Claude's usage endpoint (login token from the macOS keychain, never printed or stored), and POSTs to
  `/api/claude/ingest`. Unofficial endpoint: if it changes, the hook logs the error to `~/.cache/claude-log/hook.log` and carries on.
- Data: private Storage bucket `devlog-claude` (`state.json`). Read by the page through `GET /api/claude` (admin login).
- Attribution: the account-wide percent that rose since the previous report is credited to the session that reports it, so overlapping
  sessions are approximate. The first report ever credits nothing; a new window counts from 0.
- Secret: Pages `CLAUDE_INGEST_KEY` (32+ chars). The same key goes in `~/.config/claude-log/env` as `CLAUDE_INGEST_KEY=...` (chmod 600).

Setup on the Mac:

```bash
KEY=$(openssl rand -hex 24); mkdir -p ~/.config/claude-log
printf 'CLAUDE_INGEST_KEY=%s\n' "$KEY" > ~/.config/claude-log/env && chmod 600 ~/.config/claude-log/env
printf '%s' "$KEY" | npx wrangler pages secret put CLAUDE_INGEST_KEY --project-name grokbot-ai-log
```

Then add the hooks to `~/.claude/settings.json` (command: `python3 /Users/azmanrazali/web/grokbot-ai-log/scripts/claude-hook.py`).
Check a run without sending: `echo '{"hook_event_name":"Stop","session_id":"x","transcript_path":"<a .jsonl>","cwd":"."}' | python3 scripts/claude-hook.py --dry`.
