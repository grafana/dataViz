#!/usr/bin/env bash
# Turns release-please's outputs into the release workflow's matrices: one
# entry per release made in this run, with what building and attaching it
# needs.
#
# Checks every package in the config first, released or not: each needs a
# `component` that is the id of a plugin build target or of a non-plugin
# release (plugin-ci.json `releases`). The workflow also runs it before
# release-please (with no releases), so a config mistake fails before a tag
# and a release exist that no later run would build.
#
# release-please reports each release under its package path
# (`<path>--tag_name`, `<path>--sha`, `<path>--version`). The root path `.` is
# the exception: its outputs have no prefix (`tag_name`, `sha`, `version`).
# The package's `component` in the release-please config is the id, which
# matches that entry in discover-plugins' targets or artifacts.
#
# Env: RELEASE_OUTPUTS (release-please-action's outputs, as JSON), CONFIG
# (release-please config file), TARGETS (discover-plugins' targets), ARTIFACTS
# (discover-plugins' artifacts; optional), GITHUB_OUTPUT. It gets three JSON
# arrays of {id, kind, tag, sha, version, dir, pkg, script, dist,
# package_json, files, notes}:
#   releases   every release, for the attach job
#   plugins    those with kind "plugin": built, signed and zipped
#   artifacts  those with kind "artifact": built and checked by `script`
# `files` is what the attach job uploads from the build's artifact, one glob
# per line. `notes` is the file it appends to the release notes, or empty.
# `dist` and `package_json` are empty for a plugin.
set -euo pipefail
# shellcheck source=SCRIPTDIR/annotations.sh
source "$(dirname "$0")/annotations.sh"

ARTIFACTS="${ARTIFACTS:-[]}"
if [ -z "$ARTIFACTS" ]; then
	ARTIFACTS='[]'
fi

# Prints the plugin target or the non-plugin release with this id, with its
# kind, or nothing.
find_entry() {
	jq -c --arg id "$1" --argjson artifacts "$ARTIFACTS" '
		(map(select(.id == $id) | {kind: "plugin", id, dir, pkg, script, dist: "", package_json: ""})
		+ ($artifacts | map(select(.id == $id) | {kind: "artifact", id, dir, pkg, script, dist, package_json: (.package_json // "")})))
		| first // empty' <<<"$TARGETS"
}

for path in $(jq -r '.packages | keys[]' "$CONFIG"); do
	id="$(jq -r --arg path "$path" '.packages[$path].component // ""' "$CONFIG")"
	if [ -z "$id" ]; then
		echo "::error file=$(escape_property "$CONFIG")::$(escape_message "release-please package '$path' has no component (plugin id)")"
		exit 1
	fi
	if [ -z "$(find_entry "$id")" ]; then
		echo "::error file=$(escape_property "$CONFIG")::$(escape_message "release-please component '$id' matches no plugin that a package builds, and no plugin-ci.json release")"
		exit 1
	fi
done

paths_released="$(jq -c '.paths_released // "[]" | fromjson' <<<"$RELEASE_OUTPUTS")"
releases='[]'
for path in $(jq -r '.[]' <<<"$paths_released"); do
	id="$(jq -r --arg path "$path" '.packages[$path].component' "$CONFIG")"
	entry="$(find_entry "$id")"
	# release-please-action's setPathOutput: no prefix for the root path.
	prefix="$path--"
	if [ "$path" = . ]; then
		prefix=''
	fi
	release="$(jq -c --arg prefix "$prefix" '{
		tag: .["\($prefix)tag_name"],
		sha: .["\($prefix)sha"],
		version: .["\($prefix)version"]
	}' <<<"$RELEASE_OUTPUTS")"
	# A release with no tag or commit would build the default branch and attach to nothing.
	if ! jq -e 'all(.[]; type == "string" and length > 0)' <<<"$release" >/dev/null; then
		echo "::error file=$(escape_property "$CONFIG")::$(escape_message "release-please released '$path' but its outputs have no tag_name, sha or version")"
		exit 1
	fi
	releases="$(jq -c --argjson release "$release" --argjson entry "$entry" '
		. + [$entry + $release + (
			if $entry.kind == "plugin"
			then {files: "release-assets/*.zip\nrelease-assets/*.zip.sha1", notes: ""}
			else {files: "release-assets/files/*", notes: "release-assets/notes/release-notes.md"}
			end)]' <<<"$releases")"
done

echo "Releases to build: $releases"
{
	echo "releases=$releases"
	echo "plugins=$(jq -c 'map(select(.kind == "plugin"))' <<<"$releases")"
	echo "artifacts=$(jq -c 'map(select(.kind == "artifact"))' <<<"$releases")"
} >>"$GITHUB_OUTPUT"
