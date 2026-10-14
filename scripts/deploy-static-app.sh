#!/usr/bin/env bash
# Upload dist/ to an existing static.app site.
# Replaces designmodo/static-app-deploy-action, whose node-fetch upload fails
# with "Cannot follow redirect with body being a readable stream" whenever the
# static.app API answers with a redirect. curl re-sends the file instead.
#
# Env: STATIC_APP_API_KEY (secret), STATIC_APP_PID (site PID), BUILD_DIR (default dist)
set -euo pipefail

API_URL="${STATIC_APP_API_URL:-https://api.static.app/v1/sites/zip}"
BUILD_DIR="${BUILD_DIR:-dist}"
: "${STATIC_APP_API_KEY:?STATIC_APP_API_KEY is not set}"
: "${STATIC_APP_PID:?STATIC_APP_PID is not set}"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
(cd "$BUILD_DIR" && zip -qr "$tmp/site.zip" . -x '.DS_Store')
echo "📦 Archive: $(wc -c < "$tmp/site.zip" | tr -d ' ') bytes"

url="$API_URL"
code=""
for attempt in 1 2 3 4 5 6; do
  echo "🚀 POST $url"
  code="$(curl -sS -o "$tmp/body" -D "$tmp/headers" -w '%{http_code}' \
    --retry 2 --retry-delay 5 --max-time 300 \
    -X POST "$url" \
    -H "Authorization: Bearer $STATIC_APP_API_KEY" \
    -H "Accept: application/json" \
    -F "archive=@$tmp/site.zip;type=application/zip" \
    -F "pid=$STATIC_APP_PID")" || code="000"

  case "$code" in
    301|302|303|307|308)
      loc="$(grep -i '^location:' "$tmp/headers" | tail -1 | cut -d' ' -f2- | tr -d '\r')"
      case "$loc" in
        /*) loc="$(echo "$url" | cut -d/ -f1-3)$loc" ;;
      esac
      host="$(echo "$loc" | cut -d/ -f3 | cut -d: -f1)"
      echo "↪️  HTTP $code redirect to $loc"
      # Never send the API key anywhere except static.app.
      if [[ "$host" != "static.app" && "$host" != *.static.app ]]; then
        echo "::error::static.app API redirected to unexpected host '$host' – not following."
        exit 1
      fi
      url="$loc"
      continue
      ;;
    5??|000)
      echo "⚠️  HTTP $code, retrying in 15s (attempt $attempt)"
      sleep 15
      continue
      ;;
  esac
  break
done

echo "HTTP $code"
head -c 1500 "$tmp/body"; echo

if [[ ! "$code" =~ ^2 ]]; then
  echo "::error::static.app deploy failed with HTTP $code (see response above)."
  exit 1
fi
# A 200 HTML page (e.g. a login page after a redirect) is not a successful deploy.
if ! grep -q '^[[:space:]]*[{[]' "$tmp/body"; then
  echo "::error::static.app returned a non-JSON response – the API key may be invalid or the API moved."
  exit 1
fi
echo "✅ Deployed to static.app (site $STATIC_APP_PID)"
