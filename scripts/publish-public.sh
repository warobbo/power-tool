#!/usr/bin/env bash
# Copy the allowlist into public/ for the static publish directory.
# Dotfiles and .cursor/ are never copied, so the host catch-all can 301 them.
set -eu
root="$(cd "$(dirname "$0")/.." && pwd)"
list="$root/scripts/published-files.txt"
dest_root="$root/public"
rm -rf "$dest_root"
mkdir -p "$dest_root"

expected=""
while IFS= read -r rel || [ -n "$rel" ]; do
  case "$rel" in
    ""|\#*) continue ;;
  esac
  case "$rel" in
    .*|*/.*)
      echo "refusing hidden publish path: $rel" >&2
      exit 1
      ;;
  esac
  src="$root/$rel"
  if [ ! -f "$src" ]; then
    echo "missing source file: $rel" >&2
    exit 1
  fi
  mkdir -p "$dest_root/$(dirname "$rel")"
  cp "$src" "$dest_root/$rel"
  expected="${expected}${rel}"$'\n'
done < "$list"

actual=""
while IFS= read -r file; do
  [ -n "$file" ] || continue
  rel="${file#"$dest_root"/}"
  case "$rel" in
    .*|*/.*)
      echo "hidden path leaked into public/: $rel" >&2
      exit 1
      ;;
  esac
  actual="${actual}${rel}"$'\n'
done < <(find "$dest_root" -type f | sort)

expected="$(printf '%s' "$expected" | sort)"
actual="$(printf '%s' "$actual" | sort)"
if [ "$expected" != "$actual" ]; then
  echo "public/ does not match scripts/published-files.txt" >&2
  echo "expected:" >&2
  printf '%s\n' "$expected" >&2
  echo "actual:" >&2
  printf '%s\n' "$actual" >&2
  exit 1
fi
