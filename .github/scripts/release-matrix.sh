#!/usr/bin/env bash
# Turns release-please's outputs into the release workflow's build matrix:
# one entry per plugin released in this run, with what building it needs.
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

paths_released="$(jq -c '.paths_released // "[]" | fromjson' <<<"$RELEASE_OUTPUTS")"
releases='[]'
for path in $(jq -r '.[]' <<<"$paths_released"); do
	id="$(jq -r --arg path "$path" '.packages[$path].component // ""' "$CONFIG")"
	if [ -z "$id" ]; then
		echo "::error file=$(escape_property "$CONFIG")::$(escape_message "release-please released '$path', which has no component (plugin id) in the config")"
		exit 1
	fi
	target="$(jq -c --arg id "$id" 'map(select(.id == $id)) | first // empty' <<<"$TARGETS")"
	if [ -z "$target" ]; then
		echo "::error file=$(escape_property "$CONFIG")::$(escape_message "release-please released '$id', but no package builds a plugin with that id")"
		exit 1
	fi
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
