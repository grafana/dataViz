#!/usr/bin/env bash
# Runs grafana/plugin-validator-cli on a packaged plugin zip and its source,
# and exits with the validator's status, so findings at error level fail.
#
# Adapted from the plugin-validator step of grafana/plugin-ci-workflows
# ci.yml: the same image, arguments and default config. Differences: the
# workspace is mounted read-only rather than copied into the container (the
# copy is only needed under act on macOS), and clamav is skipped the same way.
#
# Usage: validate.sh <plugin-source-dir> <zip>
# Env: VALIDATOR_VERSION (image tag, e.g. v0.49.11), SOURCE_VERSION (optional:
# the version to put in the copied source's package.json, for a package whose
# package.json does not carry this plugin's version, e.g. echarts building
# grafana-relations-panel, whose version lives in src/modules/relations).
set -euo pipefail

source_dir="${1:?usage: validate.sh <plugin-source-dir> <zip>}"
zip="${2:?usage: validate.sh <plugin-source-dir> <zip>}"

# The validator reads the source next to the zip. node_modules is left out,
# or some analyzers would scan every dependency.
workspace="$(mktemp -d)"
trap 'rm -rf "$workspace"' EXIT
tar -C "$source_dir" --exclude=./node_modules -cf - . | tar -C "$workspace" -xf -
# The validator fails when the source package.json version differs from the
# zip's plugin.json version.
if [ -n "${SOURCE_VERSION:-}" ]; then
	jq --arg version "$SOURCE_VERSION" '.version = $version' "$workspace/package.json" >"$workspace/package.json.new"
	mv "$workspace/package.json.new" "$workspace/package.json"
fi
mkdir -p "$workspace/dist-artifacts"
cp "$zip" "$workspace/dist-artifacts/"
cp "$(dirname "$0")/config.yaml" "$workspace/.plugin-validator.yaml"

docker run --rm --pull=always --platform=linux/amd64 \
	-e SKIP_CLAMAV=1 \
	-v "$workspace:/workspace:ro" \
	"grafana/plugin-validator-cli:$VALIDATOR_VERSION" \
	-ghaOutput \
	-config=/workspace/.plugin-validator.yaml \
	-sourceCodeUri=file:///workspace \
	"/workspace/dist-artifacts/$(basename "$zip")"
