#!/usr/bin/env bash
#
# Global HL7 FHIR Learning Lab — Zero-Docker Local Dev Runner (Host Bun)
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOCAL_TS="${ROOT_DIR}/scripts/local.ts"

if ! command -v bun >/dev/null 2>&1; then
    echo "❌ Bun runtime tidak ditemukan di PATH." >&2
    echo "Silakan instal Bun: https://bun.sh" >&2
    exit 1
fi

if [[ ! -f "${LOCAL_TS}" ]]; then
    echo "❌ File target tidak ditemukan di checkout: ${LOCAL_TS}" >&2
    exit 1
fi

cd "${ROOT_DIR}"
exec bun "${LOCAL_TS}" "$@"
