#!/usr/bin/env bash
# Builds one plugin package's script: its workspace dependencies first, then
# the script itself, with any extra arguments passed through to it (e.g.
# webpack's --profile --json). With ID set, also checks that dist/plugin.json
# is that plugin, so a build that quietly produced a different one fails. With
# VERSION set too, also checks its info.version, so a release build fails if it
# did not take the version that was tagged.
#
# Env: PKG (package name), SCRIPT (package.json script), DIR (repo-root-relative
# package dir), ID (expected plugin id; optional), VERSION (expected
# info.version; optional, needs ID), GITHUB_WORKSPACE (repo root).
# Run from plugins/, where pnpm resolves the workspace.
set -euo pipefail
# shellcheck source=SCRIPTDIR/annotations.sh
source "$(dirname "$0")/annotations.sh"

# `^...` builds the package's workspace dependencies but not the package
# itself; exits 0 when it has none. --summarize keeps these cache entries
# when root CI prunes the turbo cache.
pnpm turbo run build --filter "$PKG^..." --summarize
pnpm --filter "$PKG" run "$SCRIPT" "$@"

if [ -z "${ID:-}" ]; then
	exit 0
fi

dist_json="$GITHUB_WORKSPACE/$DIR/dist/plugin.json"
if [ ! -f "$dist_json" ]; then
	echo "::error file=$(escape_property "$DIR/package.json")::$(escape_message "$PKG script '$SCRIPT' wrote no dist/plugin.json, expected '$ID'")"
	exit 1
fi
built="$(jq -r '.id // ""' "$dist_json")"
if [ "$built" != "$ID" ]; then
	echo "::error file=$(escape_property "$DIR/dist/plugin.json")::$(escape_message "$PKG script '$SCRIPT' built '$built', expected '$ID'")"
	exit 1
fi

if [ -z "${VERSION:-}" ]; then
	exit 0
fi
built_version="$(jq -r '.info.version // ""' "$dist_json")"
if [ "$built_version" != "$VERSION" ]; then
	echo "::error file=$(escape_property "$DIR/dist/plugin.json")::$(escape_message "$PKG script '$SCRIPT' built $ID version '$built_version', expected '$VERSION'")"
	exit 1
fi
