#!/usr/bin/env bash
# Pack the extension into dist/gh-x-html-<version>.zip for Chrome Web Store upload.
set -euo pipefail

cd "$(dirname "$0")/.."

version=$(node -p "require('./manifest.json').version" 2>/dev/null \
  || python3 -c "import json; print(json.load(open('manifest.json'))['version'])")

out="dist/gh-x-html-${version}.zip"
mkdir -p dist
rm -f "$out"

zip -r "$out" \
  manifest.json \
  background.js \
  content.js \
  render.html \
  render.js \
  popup.html \
  popup.js \
  icons \
  LICENSE \
  -x "icons/icon.svg"

printf '\nbuilt %s (%s bytes)\n' "$out" "$(stat -c %s "$out")"
