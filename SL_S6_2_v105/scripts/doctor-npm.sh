#!/usr/bin/env bash
set -euo pipefail

TARGET_PATH="@typescript-eslint%2feslint-plugin"
TARGET_DEFAULT="https://registry.npmjs.org/${TARGET_PATH}"
REGISTRY="${NPM_REGISTRY_URL:-${npm_config_registry:-https://registry.npmjs.org/}}"
TARGET_CURRENT="${REGISTRY%/}/${TARGET_PATH}"

say() { printf '%s\n' "$*"; }
try_head() {
  local url="$1"
  local mode="$2"
  if [[ "$mode" == "no-proxy" ]]; then
    HTTPS_PROXY= HTTP_PROXY= https_proxy= http_proxy= \
      curl -sS -I --max-time 8 "$url" | sed -n '1,3p' || return 1
  else
    curl -sS -I --max-time 8 "$url" | sed -n '1,3p' || return 1
  fi
}

say "[doctor-npm] npm registry reachability check"
say "- Current npm registry: ${REGISTRY}"
say "- Proxy env: HTTP_PROXY=${HTTP_PROXY:-<unset>} HTTPS_PROXY=${HTTPS_PROXY:-<unset>}"

say ""
say "[1/3] Check current registry via current proxy settings"
if out=$(try_head "$TARGET_CURRENT" proxy 2>&1); then
  say "$out"
  say "PASS: current registry appears reachable with current proxy settings."
  exit 0
else
  say "$out"
  say "WARN: current registry not reachable with proxy settings."
fi

say ""
say "[2/3] Check default npmjs registry via proxy"
if out=$(try_head "$TARGET_DEFAULT" proxy 2>&1); then
  say "$out"
  say "PASS: npmjs reachable via proxy."
else
  say "$out"
  say "WARN: npmjs also blocked via proxy (often CONNECT 403)."
fi

say ""
say "[3/3] Check npmjs registry without proxy"
if out=$(try_head "$TARGET_DEFAULT" no-proxy 2>&1); then
  say "$out"
  say "PASS: direct network works. You may temporarily unset proxy for npm commands."
  say "Example: HTTPS_PROXY= HTTP_PROXY= npm install"
else
  say "$out"
  say "WARN: direct network also unavailable from this environment."
fi

say ""
say "Action items:"
say "1) Provide an internal npm mirror and set NPM_REGISTRY_URL before install."
say "   Example: NPM_REGISTRY_URL=https://<internal-registry>/ npm install"
say "2) Or ask network admins to allow CONNECT to registry.npmjs.org:443."
say "3) For CI, prefer injecting NPM_REGISTRY_URL and auth token as env vars."
