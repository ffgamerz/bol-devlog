#!/usr/bin/env python3
"""One-off check: can this Mac read the 5-hour and weekly Claude usage percent? Prints only percentages and reset times, never the token."""
import json, subprocess, sys

r = subprocess.run(['security', 'find-generic-password', '-s', 'Claude Code-credentials', '-w'], capture_output=True, text=True, timeout=30)
if r.returncode != 0:
    sys.exit(f'No Claude Code login found in the keychain (code {r.returncode}).')
try:
    c = json.loads(r.stdout)
    o = c.get('claudeAiOauth', c)
    tok = o['accessToken']
except Exception as e:
    sys.exit(f'Login data has an unexpected shape ({type(e).__name__}).')
print('login found · plan:', o.get('subscriptionType'), '· token expires (ms):', o.get('expiresAt'))

# curl uses macOS's own certificates (this Mac's Python often has none); the header goes in via stdin so the token never shows in `ps`
cfg = f'header = "Authorization: Bearer {tok}"\nheader = "anthropic-beta: oauth-2025-04-20"\nheader = "User-Agent: claude-code/usage-check"\n'
p = subprocess.run(['curl', '-sS', '-m', '20', '-w', '\n%{http_code}', '-K', '-', 'https://api.anthropic.com/api/oauth/usage'], input=cfg, capture_output=True, text=True)
if p.returncode != 0:
    sys.exit('curl failed: ' + p.stderr.strip()[:200])
body, _, code = p.stdout.rpartition('\n')
if code != '200':
    sys.exit(f'Usage endpoint answered HTTP {code}: {body[:200]}')
print(json.dumps(json.loads(body), indent=1)[:2000])
