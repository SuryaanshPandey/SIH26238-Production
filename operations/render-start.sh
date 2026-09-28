#!/usr/bin/env bash
set -euo pipefail

# Prisma Client is generated during the Render build.
# Database schema synchronization should NOT happen during every
# runtime/cold start. Doing prisma db push here makes Render Free
# cold starts unnecessarily slow.
#
# Start Next.js directly instead of "npm start" so the npm "prestart"
# lifecycle hook does not regenerate Prisma Client once more.

exec ./node_modules/.bin/next start \
  --hostname 0.0.0.0 \
  --port "${PORT:-10000}"
