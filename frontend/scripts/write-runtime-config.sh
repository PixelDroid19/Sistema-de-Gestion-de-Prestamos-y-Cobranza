#!/bin/sh
set -eu

OUTPUT_DIR="${1:-dist}"
mkdir -p "$OUTPUT_DIR"

API_BASE_URL="${VITE_API_BASE_URL:-}"

if [ -z "$API_BASE_URL" ]; then
  API_BASE_URL="${VITE_API_URL:-}"
fi

if [ -z "$API_BASE_URL" ] && [ -n "${RAILWAY_SERVICE_BACKEND_URL:-}" ]; then
  API_BASE_URL="https://${RAILWAY_SERVICE_BACKEND_URL}/api"
fi

if [ -n "$API_BASE_URL" ]; then
  case "$API_BASE_URL" in
    http://*|https://*|/*)
      ;;
    *)
      API_BASE_URL="https://${API_BASE_URL}"
      ;;
  esac
fi

ESCAPED_VALUE='null'
if [ -n "$API_BASE_URL" ]; then
  SAFE_VALUE=$(printf '%s' "$API_BASE_URL" | sed 's/\\/\\\\/g; s/"/\\"/g')
  ESCAPED_VALUE="\"$SAFE_VALUE\""
fi

cat > "$OUTPUT_DIR/runtime-config.js" <<EOF
window.__APP_CONFIG__ = Object.freeze({
  apiBaseUrl: $ESCAPED_VALUE,
});
EOF
