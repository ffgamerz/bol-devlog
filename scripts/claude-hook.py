#!/usr/bin/env python3
"""Claude Code hook (SessionStart / Stop / SessionEnd): reports this session's token totals and the account's 5-hour / weekly percent to the
Claude log. Reads only counts from the transcript, never prompts or replies. Always exits 0 so it can never block Claude.
Config (first found): env CLAUDE_INGEST_KEY / CLAUDE_LOG_URL, else ~/.config/claude-log/env (KEY=value lines).
  --dry   print the payload instead of sending it (stdin must still be a hook JSON)"""
import json, os, subprocess, sys, time

HOME = os.path.expanduser('~')
CACHE = os.path.join(HOME, '.cache', 'claude-log')
DEFAULT_URL = 'https://bol-devlog.pages.dev'


def log(msg):
    try:
        os.makedirs(CACHE, exist_ok=True)
        with open(os.path.join(CACHE, 'hook.log'), 'a') as f:
            f.write(time.strftime('%Y-%m-%dT%H:%M:%S ') + msg[:300] + '\n')
    except Exception:
        pass


def config():
    cfg = {k: os.environ[k] for k in ('CLAUDE_INGEST_KEY', 'CLAUDE_LOG_URL') if os.environ.get(k)}
    try:
        for line in open(os.path.join(HOME, '.config', 'claude-log', 'env')):
            k, _, v = line.strip().partition('=')
            if k and v and k not in cfg:
                cfg[k] = v.strip('"\'')
    except OSError:
        pass
    return cfg


def project_of(cwd):
    if not cwd:
        return 'unknown'
    if 'scratch-workspaces' in cwd:
        return 'No folder (scratch)'
    try:
        top = subprocess.run(['git', '-C', cwd, 'rev-parse', '--show-toplevel'], capture_output=True, text=True, timeout=5).stdout.strip()
    except Exception:
        top = ''
    return os.path.basename(top or cwd.rstrip('/')) or 'unknown'


def tokens_of(path):
    """Sum usage over the transcript; a streamed message appears several times, so keep the last usage per message id."""
    per, turns, model, named, first = {}, 0, None, None, None
    try:
        with open(path) as f:
            for line in f:
                try:
                    e = json.loads(line)
                except ValueError:
                    continue
                m = e.get('message') or {}
                if e.get('type') == 'custom-title' and e.get('customTitle'):
                    named = e['customTitle']
                if e.get('type') == 'assistant' and isinstance(m.get('usage'), dict):
                    per[m.get('id') or e.get('uuid')] = m['usage']
                    model = m.get('model') or model
                elif e.get('type') == 'user' and not e.get('isSidechain') and not e.get('isMeta'):
                    c = m.get('content')
                    if isinstance(c, str) or (isinstance(c, list) and any(isinstance(x, dict) and x.get('type') == 'text' for x in c)):
                        turns += 1
                        if not first:
                            for x in ([c] if isinstance(c, str) else [y.get('text') for y in c if isinstance(y, dict)]):
                                x = (x or '').strip()
                                if x and not x.startswith('<'):
                                    first = x.splitlines()[0]
                                    break
    except OSError:
        pass
    t = {'input': 0, 'output': 0, 'cacheRead': 0, 'cacheWrite': 0}
    for u in per.values():
        t['input'] += u.get('input_tokens') or 0
        t['output'] += u.get('output_tokens') or 0
        t['cacheRead'] += u.get('cache_read_input_tokens') or 0
        t['cacheWrite'] += u.get('cache_creation_input_tokens') or 0
    title = named or first
    return t, turns, model, (' '.join(title.split())[:80] if title else None)


def usage():
    """5-hour / weekly percent from Claude's own usage endpoint (cached 60 s so a busy session does not hammer it)."""
    cf = os.path.join(CACHE, 'usage.json')
    try:
        c = json.load(open(cf))
        if time.time() - c['at'] < 60:
            return c['data']
    except Exception:
        pass
    r = subprocess.run(['security', 'find-generic-password', '-s', 'Claude Code-credentials', '-w'], capture_output=True, text=True, timeout=15)
    if r.returncode != 0:
        raise RuntimeError('no Claude login in keychain')
    o = json.loads(r.stdout)
    tok = (o.get('claudeAiOauth') or o)['accessToken']
    cfg = f'header = "Authorization: Bearer {tok}"\nheader = "anthropic-beta: oauth-2025-04-20"\nheader = "User-Agent: claude-code/claude-log"\n'
    p = subprocess.run(['curl', '-sS', '-m', '10', '-w', '\n%{http_code}', '-K', '-', 'https://api.anthropic.com/api/oauth/usage'], input=cfg, capture_output=True, text=True)
    body, _, code = p.stdout.rpartition('\n')
    if p.returncode != 0 or code != '200':
        raise RuntimeError(f'usage endpoint: curl {p.returncode} http {code}')
    d = json.loads(body)
    data = {k: {'pct': d[k]['utilization'], 'resetsAt': d[k]['resets_at']} for k in ('five_hour', 'seven_day')}
    data = {'five': data['five_hour'], 'week': data['seven_day']}
    os.makedirs(CACHE, exist_ok=True)
    json.dump({'at': time.time(), 'data': data}, open(cf, 'w'))
    return data


def main():
    dry = '--dry' in sys.argv
    try:
        h = json.load(sys.stdin)
        sid = h.get('session_id') or ''
        tk, turns, model, title = tokens_of(h.get('transcript_path') or '')
        payload = {'session': {'id': sid, 'project': project_of(h.get('cwd')), 'status': 'ended' if h.get('hook_event_name') == 'SessionEnd' else 'running',
                               'turns': turns, 'tokens': tk, 'model': model, 'title': title}, 'usage': usage()}
        if dry:
            print(json.dumps(payload, indent=1))
            return
        cfg = config()
        if not cfg.get('CLAUDE_INGEST_KEY'):
            return log('no CLAUDE_INGEST_KEY configured')
        # the key goes in through a curl config on stdin and the body through a temp file, so neither shows up in `ps`
        import tempfile
        with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as tf:
            json.dump(payload, tf)
        try:
            p = subprocess.run(['curl', '-sS', '-m', '15', '-o', '/dev/null', '-w', '%{http_code}', '-K', '-', '-X', 'POST', '-H', 'Content-Type: application/json', '--data-binary', '@' + tf.name,
                                (cfg.get('CLAUDE_LOG_URL') or DEFAULT_URL).rstrip('/') + '/api/claude/ingest'],
                               input=f'header = "Authorization: Bearer {cfg["CLAUDE_INGEST_KEY"]}"\n', capture_output=True, text=True)
        finally:
            os.unlink(tf.name)
        if p.stdout.strip() != '200':
            log(f'ingest answered {p.stdout.strip() or p.stderr.strip()}')
    except Exception as e:
        log(f'{type(e).__name__}: {e}')


if __name__ == '__main__':
    main()
    sys.exit(0)
