#!/usr/bin/env bash
# Turns release-please's outputs into the release workflow's build matrix:
# one entry per plugin released in this run, with what building it needs.
#
# Checks every package in the config first, released or not: each needs a
# `component` that some build target's plugin id matches. The workflow also
# runs it before release-please (with no releases), so a config mistake fails
# before a tag and a release exist that no later run would build.
#
# release-please reports each release under its package path
# (`<path>--tag_name`, `<path>--sha`, `<path>--version`). The package's
# `component` in the release-please config is the plugin id, which matches
# that plugin's entry in discover-plugins' targets.
#
# Env: RELEASE_OUTPUTS (release-please-action's outputs, as JSON), CONFIG
# (release-please config file), TARGETS (discover-plugins' targets),
# GITHUB_OUTPUT (gets releases=<JSON array of {id, tag, sha, version, dir,
# pkg, script}>).
set -euo pipefail
# shellcheck source=SCRIPTDIR/annotations.sh
source "$(dirname "$0")/annotations.sh"

for path in $(jq -r '.packages | keys[]' "$CONFIG"); do
	id="$(jq -r --arg path "$path" '.packages[$path].component // ""' "$CONFIG")"
	if [ -z "$id" ]; then
		echo "::error file=$(escape_property "$CONFIG")::$(escape_message "release-please package '$path' has no component (plugin id)")"
		exit 1
	fi
	if ! jq -e --arg id "$id" 'any(.id == $id)' <<<"$TARGETS" >/dev/null; then
		echo "::error file=$(escape_property "$CONFIG")::$(escape_message "release-please component '$id' matches no plugin that a package builds")"
		exit 1
	fi
done

paths_released="$(jq -c '.paths_released // "[]" | fromjson' <<<"$RELEASE_OUTPUTS")"
releases='[]'
for path in $(jq -r '.[]' <<<"$paths_released"); do
	id="$(jq -r --arg path "$path" '.packages[$path].component' "$CONFIG")"
	target="$(jq -c --arg id "$id" 'map(select(.id == $id)) | first' <<<"$TARGETS")"
	release="$(jq -c --arg path "$path" '{
		tag: .["\($path)--tag_name"],
		sha: .["\($path)--sha"],
		version: .["\($path)--version"]
	}' <<<"$RELEASE_OUTPUTS")"
	releases="$(jq -c --argjson release "$release" --argjson target "$target" \
		'. + [{id: $target.id} + $release + ($target | {dir, pkg, script})]' <<<"$releases")"
done

echo "Releases to build: $releases"
echo "releases=$releases" >>"$GITHUB_OUTPUT"
