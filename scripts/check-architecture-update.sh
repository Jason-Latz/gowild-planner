#!/usr/bin/env bash
set -euo pipefail

BASE_REF=${1:-origin/main}
HEAD_REF=${2:-HEAD}

CHANGED=$(git diff --name-only "${BASE_REF}...${HEAD_REF}")

if [[ -z "${CHANGED}" ]]; then
  echo "No changed files detected."
  exit 0
fi

ARCH_CHANGED=false
IMPACTED_CHANGED=false

while IFS= read -r file; do
  [[ -z "${file}" ]] && continue

  if [[ "${file}" == "architecture.md" ]]; then
    ARCH_CHANGED=true
  fi

  if [[ "${file}" == src/* ]] || [[ "${file}" == prisma/* ]] || [[ "${file}" == next.config.ts ]] || [[ "${file}" == package.json ]] || [[ "${file}" == vercel.json ]] || [[ "${file}" == AGENTS.md ]]; then
    IMPACTED_CHANGED=true
  fi
done <<< "${CHANGED}"

if [[ "${IMPACTED_CHANGED}" == true && "${ARCH_CHANGED}" != true ]]; then
  echo "architecture.md must be updated when architecture-impacting files change."
  echo "Changed files:"
  echo "${CHANGED}"
  exit 1
fi

echo "Architecture update check passed."
