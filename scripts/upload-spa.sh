#!/usr/bin/env bash

set -euo pipefail

: "${SPA_STORAGE_ACCOUNT_NAME:?SPA_STORAGE_ACCOUNT_NAME is required}"
: "${SPA_UPLOAD_GROUP:?SPA_UPLOAD_GROUP is required}"

readonly dist_dir="${SPA_DIST_DIR:-dist/public}"
readonly container="\$web"
readonly immutable_cache='public, max-age=31536000, immutable'
readonly shell_cache='no-cache, must-revalidate'
readonly index_cache='no-cache, no-store, must-revalidate'

content_type_for() {
  case "$1" in
    *.avif) printf '%s\n' 'image/avif' ;;
    *.css) printf '%s\n' 'text/css; charset=utf-8' ;;
    *.gif) printf '%s\n' 'image/gif' ;;
    *.html) printf '%s\n' 'text/html; charset=utf-8' ;;
    *.ico) printf '%s\n' 'image/x-icon' ;;
    *.jpeg | *.jpg) printf '%s\n' 'image/jpeg' ;;
    *.js | *.mjs) printf '%s\n' 'text/javascript; charset=utf-8' ;;
    *.json | *.map) printf '%s\n' 'application/json; charset=utf-8' ;;
    *.mp3) printf '%s\n' 'audio/mpeg' ;;
    *.mp4) printf '%s\n' 'video/mp4' ;;
    *.ogg) printf '%s\n' 'audio/ogg' ;;
    *.pdf) printf '%s\n' 'application/pdf' ;;
    *.png) printf '%s\n' 'image/png' ;;
    *.svg) printf '%s\n' 'image/svg+xml' ;;
    *.txt) printf '%s\n' 'text/plain; charset=utf-8' ;;
    *.wasm) printf '%s\n' 'application/wasm' ;;
    *.wav) printf '%s\n' 'audio/wav' ;;
    *.webm) printf '%s\n' 'video/webm' ;;
    *.webmanifest) printf '%s\n' 'application/manifest+json' ;;
    *.webp) printf '%s\n' 'image/webp' ;;
    *.woff) printf '%s\n' 'font/woff' ;;
    *.woff2) printf '%s\n' 'font/woff2' ;;
    *.xml) printf '%s\n' 'application/xml; charset=utf-8' ;;
    *) printf '%s\n' 'application/octet-stream' ;;
  esac
}

upload_file() {
  local file="$1"
  local cache_control="$2"
  local blob_name="${file#"$dist_dir"/}"

  az storage blob upload \
    --account-name "$SPA_STORAGE_ACCOUNT_NAME" \
    --auth-mode login \
    --container-name "$container" \
    --name "$blob_name" \
    --file "$file" \
    --content-cache-control "$cache_control" \
    --content-type "$(content_type_for "$file")" \
    --overwrite true \
    --only-show-errors \
    --output none
}

test -f "$dist_dir/index.html"

case "$SPA_UPLOAD_GROUP" in
  immutable)
    test -d "$dist_dir/assets"
    uploaded=0
    while IFS= read -r -d '' file; do
      filename="${file##*/}"
      if [[ ! "$filename" =~ -[A-Za-z0-9_-]{8,}\.[^.]+$ ]]; then
        echo "Refusing immutable caching for non-hashed asset: $file" >&2
        exit 1
      fi
      upload_file "$file" "$immutable_cache"
      uploaded=$((uploaded + 1))
    done < <(find "$dist_dir/assets" -type f -print0 | sort -z)
    test "$uploaded" -gt 0
    ;;
  shell)
    while IFS= read -r -d '' file; do
      upload_file "$file" "$shell_cache"
    done < <(
      find "$dist_dir" -type f \
        ! -path "$dist_dir/assets/*" \
        ! -path "$dist_dir/index.html" \
        -print0 | sort -z
    )
    ;;
  index)
    upload_file "$dist_dir/index.html" "$index_cache"
    ;;
  *)
    echo "SPA_UPLOAD_GROUP must be immutable, shell, or index" >&2
    exit 1
    ;;
esac
