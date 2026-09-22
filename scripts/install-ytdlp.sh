#!/bin/sh
set -eu

YTDLP_VERSION=2026.08.19
YTDLP_SHA256=1fa6733c37ea6fb51c99ad8fe785e7b7e5f3246c9b980230329d4fb72ed8d4d6

install_root=${1:-.tools}
bin_dir="$install_root/bin"
yt_dlp="$bin_dir/yt-dlp"

mkdir -p "$bin_dir"

download() {
  url=$1
  destination=$2
  checksum=$3

  if [ -f "$destination" ] && printf '%s  %s\n' "$checksum" "$destination" | sha256sum -c - >/dev/null 2>&1; then
    return
  fi

  temporary="$destination.tmp"
  rm -f "$temporary"
  curl --fail --location --silent --show-error "$url" --output "$temporary"
  printf '%s  %s\n' "$checksum" "$temporary" | sha256sum -c - >/dev/null
  mv "$temporary" "$destination"
}

download \
  "https://github.com/yt-dlp/yt-dlp/releases/download/$YTDLP_VERSION/yt-dlp" \
  "$yt_dlp" \
  "$YTDLP_SHA256"

chmod 0755 "$yt_dlp"
"$yt_dlp" --version >/dev/null
