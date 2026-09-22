#!/usr/bin/env bash

set -euo pipefail

: "${SMOKE_BASE_URL:?SMOKE_BASE_URL is required}"

readonly expected_index="${SPA_EXPECTED_INDEX:-dist/public/index.html}"
readonly max_attempts=60
readonly retry_delay_seconds=10

test -f "$expected_index"

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

fetch() {
  local path="$1"
  local name="$2"

  curl \
    --compressed \
    --dump-header "$work_dir/$name.headers" \
    --fail \
    --location \
    --output "$work_dir/$name.body" \
    --show-error \
    --silent \
    "${SMOKE_BASE_URL}${path}"
}

content_type() {
  grep --ignore-case '^content-type:' "$1" |
    tail -n 1 |
    cut -d: -f2- |
    tr -d '\r' |
    xargs
}

check_release() {
  local root_type
  local deep_link_type
  local health_type
  local session_type

  fetch '/' root || return 1
  root_type="$(content_type "$work_dir/root.headers")" || return 1
  [[ "$root_type" == text/html* ]] || {
    echo "Root returned unexpected content type: $root_type"
    return 1
  }
  cmp --silent "$expected_index" "$work_dir/root.body" || {
    echo 'Root HTML does not match the released index.html'
    return 1
  }

  fetch '/sign-in' deep-link || return 1
  deep_link_type="$(content_type "$work_dir/deep-link.headers")" || return 1
  [[ "$deep_link_type" == text/html* ]] || {
    echo "Deep link returned unexpected content type: $deep_link_type"
    return 1
  }
  cmp --silent "$expected_index" "$work_dir/deep-link.body" || {
    echo 'Deep-link HTML does not match the released index.html'
    return 1
  }

  fetch '/healthz' health || return 1
  health_type="$(content_type "$work_dir/health.headers")" || return 1
  [[ "$health_type" == text/plain* ]] || {
    echo "Health check returned unexpected content type: $health_type"
    return 1
  }
  [[ "$(cat "$work_dir/health.body")" == 'OK' ]] || {
    echo 'Health check returned an unexpected body'
    return 1
  }

  fetch '/api/auth/session' session || return 1
  session_type="$(content_type "$work_dir/session.headers")" || return 1
  [[ "$session_type" == application/json* ]] || {
    echo "Session check returned unexpected content type: $session_type"
    return 1
  }
  node -e "
    const response = JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'));
    if (response.authenticated !== false) process.exit(1);
  " "$work_dir/session.body" || {
    echo 'Session check did not return the unauthenticated JSON contract'
    return 1
  }
}

for attempt in $(seq 1 "$max_attempts"); do
  if failure="$(check_release 2>&1)"; then
    echo "Production routing smoke checks passed for $SMOKE_BASE_URL"
    exit 0
  fi

  if [[ "$attempt" -eq "$max_attempts" ]]; then
    echo "Production routing smoke checks failed after $max_attempts attempts" >&2
    printf '%s\n' "$failure" >&2
    exit 1
  fi

  sleep "$retry_delay_seconds"
done
