#!/usr/bin/env bash
set -euo pipefail

# The operations service uses Prisma + SQLite. The persistent disk is mounted
# before the service starts, so db push safely initializes/updates the schema
# on the persisted database file.
npm run prisma:migrate
exec npm start -- -p "${PORT:-10000}"
