#!/usr/bin/env bash
# Print the CHANGELOG.md section body for a given version, heading excluded.
# Used by the release workflow to populate GitHub Release notes.
#
#   scripts/extract-changelog.sh 0.1.12
#
# Matches a "## [0.1.12]" heading (Keep a Changelog format) and prints every
# line up to — but not including — the next "## " heading.
set -euo pipefail

version="${1:?usage: extract-changelog.sh <version>}"

cd "$(dirname "$0")/.."

awk -v ver="$version" '
  index($0, "## [" ver "]") == 1 { capture = 1; next }
  capture && /^## / { exit }
  capture { print }
' CHANGELOG.md
