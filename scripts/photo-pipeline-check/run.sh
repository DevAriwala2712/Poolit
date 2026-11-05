#!/usr/bin/env bash
# Runs the product photo pipeline through a real Chromium: synthetic phone
# photos (12 MP landscape and portrait, 50 MP, a tiny one, a transparent PNG),
# a browser that cannot encode WebP, and the whole upload flow against a fake
# store. Needs Playwright with Chromium installed (not a project dependency).
#
#   scripts/photo-pipeline-check/run.sh
set -euo pipefail
cd "$(dirname "$0")"
OUT="$(mktemp -d)"
../../frontend/node_modules/.bin/rolldown entry.ts --format iife --name photo -o "$OUT/bundle.js" >/dev/null
NODE_PATH="${NODE_PATH:-$(npm root -g)}" node check.cjs "$OUT/bundle.js"
