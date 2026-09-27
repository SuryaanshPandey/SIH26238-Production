#!/usr/bin/env bash
set -euo pipefail

exec npm start -- -p "${PORT:-10000}"
