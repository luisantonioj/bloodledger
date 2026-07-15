#!/usr/bin/env bash
set -euo pipefail

readonly GITLEAKS_VERSION="8.30.1"
readonly GITLEAKS_IMAGE="ghcr.io/gitleaks/gitleaks:v${GITLEAKS_VERSION}"

repository_root="$(git rev-parse --show-toplevel)"
temporary_root="$(mktemp -d)"
trap 'rm -rf -- "$temporary_root"' EXIT

index_snapshot="$temporary_root/index"
candidate_snapshot="$temporary_root/candidate"
mkdir -p "$index_snapshot" "$candidate_snapshot"

git -C "$repository_root" checkout-index --all --prefix="$index_snapshot/"
git -C "$repository_root" ls-files --cached --others --exclude-standard -z \
  > "$temporary_root/candidate-files"
tar -C "$repository_root" --null --files-from="$temporary_root/candidate-files" -cf - \
  | tar -C "$candidate_snapshot" -xf -

docker run --rm "$GITLEAKS_IMAGE" version
resolved_digest="$(docker image inspect --format '{{index .RepoDigests 0}}' "$GITLEAKS_IMAGE")"
if [[ -z "$resolved_digest" || "$resolved_digest" == "<no value>" ]]; then
  echo "Gitleaks image digest is unavailable; refusing an unverifiable scan" >&2
  exit 1
fi
echo "Gitleaks image: $GITLEAKS_IMAGE"
echo "Resolved digest: $resolved_digest"

docker run --rm --volume "$repository_root:/repo:ro" "$GITLEAKS_IMAGE" \
  git --log-opts=--all --redact --no-banner /repo
docker run --rm --volume "$index_snapshot:/scan:ro" "$GITLEAKS_IMAGE" \
  dir --redact --no-banner /scan
docker run --rm --volume "$candidate_snapshot:/scan:ro" "$GITLEAKS_IMAGE" \
  dir --redact --no-banner /scan

echo "Gitleaks passed for Git history, the index, and tracked/candidate content"
