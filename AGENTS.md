# BOL Dev log — notes for AI agents

## What this is
Private dev log for Azman's bots and Claude sessions. React + Vite front end, Cloudflare Pages Functions in `functions/` (ingest API at `/api/devlog/ingest`). Uses the same Supabase backend and logins as bol-studio.

## Where it lives
- Live: https://bol-devlog.pages.dev (Cloudflare Pages project **bol-devlog**, direct upload — pushing to GitHub does NOT deploy).
- Git: https://github.com/ffgamerz/bol-devlog (branch `main`). Local folder is still named `~/web/grokbot-ai-log` on purpose (Claude hook paths use it).
- The old project `grokbot-ai-log` was deleted after a phishing flag. Never use Grok / xAI / SpaceX names or branding anywhere in this project.

## Before deploying
```
npm test        # vitest, must pass
npm run build   # tsc + vite -> dist/
```

## Deploy
```
npx wrangler pages deploy dist --project-name bol-devlog --branch main
```
Then send a Dev log step line like `Deploy bol-devlog <commit>` (deploys are not collected automatically).

## Secrets
Set as Pages secrets only (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `DEVLOG_INGEST_KEYS`, `CLAUDE_INGEST_KEY`). Local copies live in `~/web/secrets/` (chmod 600). Never commit `.env`, `.dev.vars`, keys or print secret values. Adding a bot key: add it to `DEVLOG_INGEST_KEYS`, redeploy, store the key in `~/web/secrets`.
