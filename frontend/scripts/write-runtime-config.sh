#!/bin/sh
set -eu

OUTPUT_DIR="${1:-dist}"
mkdir -p "$OUTPUT_DIR"

normalize_api_base_url() {
  VALUE="$1"
  while [ "${VALUE%/}" != "$VALUE" ]; do
    VALUE="${VALUE%/}"
  done
  printf '%s' "$VALUE"
}

with_api_path() {
  VALUE=$(normalize_api_base_url "$1")
  case "$VALUE" in
    */api)
      printf '%s' "$VALUE"
      ;;
    *)
      printf '%s/api' "$VALUE"
      ;;
  esac
}

reject_api_path_env() {
  KEY="$1"
  VALUE=$(normalize_api_base_url "$2")
  case "$VALUE" in
    */api)
      echo "$KEY must be the backend origin, without /api. Use VITE_API_BASE_URL only when a full API base path is required." >&2
      exit 1
      ;;
  esac
}

API_BASE_URL=""

if [ -n "${VITE_API_BASE_URL:-}" ]; then
  API_BASE_URL=$(normalize_api_base_url "$VITE_API_BASE_URL")
fi

if [ -z "$API_BASE_URL" ]; then
  if [ -n "${VITE_API_URL:-}" ]; then
    reject_api_path_env "VITE_API_URL" "$VITE_API_URL"
    API_BASE_URL=$(with_api_path "$VITE_API_URL")
  fi
fi

if [ -z "$API_BASE_URL" ] && [ -n "${RAILWAY_SERVICE_BACKEND_URL:-}" ]; then
  API_BASE_URL=$(with_api_path "https://${RAILWAY_SERVICE_BACKEND_URL}")
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
