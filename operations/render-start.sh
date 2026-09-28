#!/usr/bin/env bash
set -euo pipefail

exec ./node_modules/.bin/next start \
  --hostname 0.0.0.0 \
  --port "${PORT:-10000}"
