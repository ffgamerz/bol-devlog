#!/usr/bin/env bash
# Dev log client (curl only). Env: DEVLOG_KEY (required), DEVLOG_URL (default https://grokbot-ai-log.pages.dev).
#   devlog.sh task-start "Name" --usage X [--repo R]   prints the task id
#   devlog.sh step "msg" --id ID [--repo R]
#   devlog.sh task-end --usage Y --id ID
set -euo pipefail
URL="${DEVLOG_URL:-https://grokbot-ai-log.pages.dev}"
: "${DEVLOG_KEY:?DEVLOG_KEY is not set}"

cmd="${1:-}"; [ -n "$cmd" ] || { sed -n '2,6p' "$0" | sed 's/^# \{0,1\}//' >&2; exit 2; }
shift
text=""; usage=""; repo=""; id=""
if [ "$cmd" != task-end ] && [ $# -gt 0 ] && [ "${1#--}" = "$1" ]; then text="$1"; shift; fi
while [ $# -gt 0 ]; do
  case "$1" in
    --usage) usage="${2:?--usage needs a value}"; shift 2 ;;
    --repo)  repo="${2:?--repo needs a value}"; shift 2 ;;
    --id)    id="${2:?--id needs a value}"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

[[ -z "$usage" || "$usage" =~ ^[0-9]+(\.[0-9]+)?$ ]] || { echo '--usage must be a number' >&2; exit 2; }
[[ -z "$id" || "$id" =~ ^[A-Za-z0-9]+$ ]] || { echo '--id looks wrong' >&2; exit 2; }
esc() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | awk 'BEGIN{ORS="\\n"} {print}' | sed 's/\\n$//'; }
json="{\"type\":\"$cmd\""
case "$cmd" in
  task-start) [ -n "$text" ] || { echo 'task-start needs a name' >&2; exit 2; }; json="$json,\"name\":\"$(esc "$text")\"" ;;
  step)       [ -n "$text" ] && [ -n "$id" ] || { echo 'step needs "msg" and --id' >&2; exit 2; }; json="$json,\"id\":\"$id\",\"msg\":\"$(esc "$text")\"" ;;
  task-end)   [ -n "$id" ] || { echo 'task-end needs --id' >&2; exit 2; }; json="$json,\"id\":\"$id\"" ;;
  *) echo "Unknown command: $cmd" >&2; exit 2 ;;
esac
[ -z "$usage" ] || json="$json,\"usage\":$usage"
[ -z "$repo" ] || json="$json,\"repo\":\"$(esc "$repo")\""
json="$json}"

res=$(curl -sS -m 20 -w '\n%{http_code}' -X POST "$URL/api/devlog/ingest" -H "Authorization: Bearer $DEVLOG_KEY" -H 'Content-Type: application/json' --data "$json")
code="${res##*$'\n'}"; body="${res%$'\n'*}"
if [ "$code" != 200 ]; then echo "devlog: HTTP $code: $body" >&2; exit 1; fi
if [ "$cmd" = task-start ]; then printf '%s\n' "$body" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p'; fi
