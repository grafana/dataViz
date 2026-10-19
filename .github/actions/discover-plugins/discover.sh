#!/usr/bin/env bash
# Prints the CI view of every plugin package under <root> as one compact JSON
# object:
#   {"targets": [{dir, pkg, id, script, plugin_json}],
#    "e2e":     [{dir, pkg, url, grafana_dependency, id, script, plugin_json, compose}]}
#
# targets: what each package publishes. A package declares them in
# plugin-ci.json `targets`; without that it has one implicit target, its
# src/plugin.json id built by its `build` script.
#
# e2e: one entry per package (not per target) with both an `e2e` script and a
# playwright.config.ts. Its suite tests what the compose file mounts. By default
# that is docker-compose.yaml with the `build` output, and the Grafana versions
# come from src/plugin.json. plugin-ci.json `e2e.target` names one of the
# package's targets to build and take the versions from instead, and
# `e2e.compose` names the compose file. `id` is that target's id, or empty for
# the default. `url` is `e2e.url`, default http://127.0.0.1:3000.
#
# With <base-sha>, both lists keep only packages with a file changed since
# that commit, unless a shared file changed, in which case nothing is filtered.
# Shared means any path under plugins/ but outside <root> (lockfile, .shared/,
# turbo.json, ...), or one of shared_paths below.
#
# Env: SHARED_PATHS (optional, one per line): files only the calling workflow
# runs, such as the workflow itself and its scripts, so a change to them
# re-runs that workflow for every package and leaves other workflows alone.
#
# Every error is reported (as a GitHub annotation) before exiting 1.
set -euo pipefail
shopt -s nullglob # must precede the glob, or `set -u` sees the literal pattern

root="${1:?usage: discover.sh <root> [<base-sha>]}"
# Without a trailing slash, so package dirs ("$root/<name>") match changed paths.
root="${root%/}"
base="${2:-}"
packages_prefix="$root/"
default_e2e_url='http://127.0.0.1:3000'

# Outside plugins/, a change to any of these can affect every package: what
# every caller runs, plus the caller's own SHARED_PATHS. Inside plugins/ the
# rule is inverted (see affects_every_package): everything not under <root>
# counts, so a new build-affecting file there needs no entry. Entries ending
# in / match everything below them.
shared_paths=".github/actions/discover-plugins/
.github/actions/setup-workspace/
.github/scripts/build-target.sh
.github/scripts/annotations.sh
${SHARED_PATHS:-}"

targets='[]'
e2e='[]'
failed=0

# escape_message / escape_property: values from a PR's plugin-ci.json or
# package.json must not be able to start another workflow command.
# shellcheck source=SCRIPTDIR/../../scripts/annotations.sh
source "$(dirname "$0")/../../scripts/annotations.sh"

error() {
	echo "::error file=$(escape_property "$1")::$(escape_message "$2")" >&2
	failed=1
}

for pkg_json in "$root"/*/package.json; do
	dir="$(dirname "$pkg_json")"
	pkg="$(jq -r '.name // ""' "$pkg_json")"
	if [ -z "$pkg" ]; then
		error "$pkg_json" "has no name, so pnpm --filter cannot select it"
		continue
	fi
	manifest="$dir/plugin-ci.json"
	config='{}'
	if [ -f "$manifest" ]; then
		if ! config="$(jq -c '.' "$manifest" 2>/dev/null)"; then
			error "$manifest" "is not valid JSON"
			continue
		fi
		if [ "$(jq -r 'type' <<<"$config")" != object ]; then
			error "$manifest" "must be a JSON object, like {\"targets\": [...]}"
			continue
		fi
		if jq -e 'has("e2e")' <<<"$config" >/dev/null; then
			if [ "$(jq -r '.e2e | type' <<<"$config")" != object ]; then
				error "$manifest" "e2e must be an object, like {\"url\": \"http://127.0.0.1:3000\"}"
				continue
			fi
			if ! jq -e '(.e2e | has("url") | not) or (.e2e.url | type == "string" and test("^https?://"))' <<<"$config" >/dev/null; then
				error "$manifest" "e2e.url must be an http:// or https:// URL"
				continue
			fi
			if ! jq -e '(.e2e | has("target") | not) or (.e2e.target | type == "string")' <<<"$config" >/dev/null; then
				error "$manifest" "e2e.target must be the id of one of this package's targets"
				continue
			fi
			# Passed to `docker compose -f` in the package directory: a plain relative path, no `..`.
			if ! jq -e '(.e2e | has("compose") | not) or (.e2e.compose | type == "string" and test("^[A-Za-z0-9_][A-Za-z0-9._/-]*$") and (test("(^|/)\\.\\.(/|$)") | not))' <<<"$config" >/dev/null; then
				error "$manifest" "e2e.compose must be a relative path to a compose file in the package, like docker-compose.yaml"
				continue
			fi
		fi
	fi

	if jq -e 'has("targets")' <<<"$config" >/dev/null; then
		declared="$(jq -c '.targets' <<<"$config")"
		if ! jq -e 'type == "array" and length > 0' <<<"$declared" >/dev/null; then
			error "$manifest" "targets must be a non-empty array"
			declared='[]'
		fi
		source_file="$manifest"
	else
		root_id="$(jq -r '.id // ""' "$dir/src/plugin.json" 2>/dev/null || true)"
		if [ -z "$root_id" ]; then
			error "$pkg_json" "no plugin-ci.json targets and no id in src/plugin.json, so this package has no build target"
			declared='[]'
		else
			declared="$(jq -nc --arg id "$root_id" '[{id: $id, script: "build", pluginJson: "src/plugin.json"}]')"
		fi
		source_file="$pkg_json"
	fi

	# Indexed rather than read from @tsv: bash's `read` collapses consecutive
	# tabs, which would shift fields when one is empty.
	count="$(jq 'length' <<<"$declared")"
	for ((i = 0; i < count; i++)); do
		if [ "$(jq -r ".[$i] | type" <<<"$declared")" != object ]; then
			error "$source_file" "targets[$i] must be an object with id, script and pluginJson"
			continue
		fi
		id="$(jq -r ".[$i].id // \"\"" <<<"$declared")"
		script="$(jq -r ".[$i].script // \"\"" <<<"$declared")"
		plugin_json="$(jq -r ".[$i].pluginJson // \"\"" <<<"$declared")"

		if [[ ! "$id" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
			error "$source_file" "target id '$id' must match ^[a-z0-9][a-z0-9-]*\$"
			continue
		fi
		# turbo and `pnpm --filter` both exit 0 on a missing script, so a typo
		# here would otherwise build nothing and pass.
		if ! jq -e --arg s "$script" '(.scripts // {}) | has($s)' "$pkg_json" >/dev/null; then
			error "$source_file" "target $id: script '$script' is not in $pkg_json"
			continue
		fi
		if [ ! -f "$dir/$plugin_json" ]; then
			error "$source_file" "target $id: pluginJson '$plugin_json' does not exist"
			continue
		fi
		actual_id="$(jq -r '.id // ""' "$dir/$plugin_json")"
		if [ "$actual_id" != "$id" ]; then
			error "$source_file" "target $id: $plugin_json has id '$actual_id'"
			continue
		fi
		if jq -e --arg id "$id" 'any(.[]; .id == $id)' <<<"$targets" >/dev/null; then
			error "$source_file" "target id $id is declared more than once"
			continue
		fi

		targets="$(jq -c --arg dir "$dir" --arg pkg "$pkg" --arg id "$id" --arg script "$script" --arg pj "$plugin_json" \
			'. + [{dir: $dir, pkg: $pkg, id: $id, script: $script, plugin_json: $pj}]' <<<"$targets")"
	done

	has_script="$(jq -r '(.scripts // {}) | has("e2e")' "$pkg_json")"
	has_config=false
	if [ -f "$dir/playwright.config.ts" ]; then
		has_config=true
	fi
	if [ "$has_script" = true ] && [ "$has_config" = true ]; then
		url="$(jq -r --arg d "$default_e2e_url" '.e2e.url // $d' <<<"$config")"
		compose="$(jq -r '.e2e.compose // "docker-compose.yaml"' <<<"$config")"
		e2e_script=build
		e2e_plugin_json=src/plugin.json
		e2e_target="$(jq -r '.e2e.target // ""' <<<"$config")"
		if [ -n "$e2e_target" ]; then
			# Only a target that passed validation above is in $targets.
			selected="$(jq -c --arg dir "$dir" --arg id "$e2e_target" 'map(select(.dir == $dir and .id == $id)) | first // empty' <<<"$targets")"
			if [ -z "$selected" ]; then
				error "$manifest" "e2e.target '$e2e_target' is not one of this package's targets"
				continue
			fi
			e2e_script="$(jq -r '.script' <<<"$selected")"
			e2e_plugin_json="$(jq -r '.plugin_json' <<<"$selected")"
		fi
		# Only a declared compose file is checked: the default keeps the behavior from before e2e.compose.
		if jq -e '.e2e.compose? // empty' <<<"$config" >/dev/null && [ ! -f "$dir/$compose" ]; then
			error "$manifest" "e2e.compose '$compose' does not exist"
			continue
		fi
		range="$(jq -r '.dependencies.grafanaDependency // ""' "$dir/$e2e_plugin_json" 2>/dev/null || true)"
		if [ -z "$range" ]; then
			error "$dir/$e2e_plugin_json" "has an e2e suite but no dependencies.grafanaDependency to pick Grafana versions from"
		else
			e2e="$(jq -c --arg dir "$dir" --arg pkg "$pkg" --arg url "$url" --arg range "$range" \
				--arg id "$e2e_target" --arg script "$e2e_script" --arg pj "$e2e_plugin_json" --arg compose "$compose" \
				'. + [{dir: $dir, pkg: $pkg, url: $url, grafana_dependency: $range, id: $id, script: $script, plugin_json: $pj, compose: $compose}]' <<<"$e2e")"
		fi
	elif [ "$has_script" = true ]; then
		error "$pkg_json" "has an e2e script but no playwright.config.ts"
	elif [ "$has_config" = true ]; then
		error "$dir/playwright.config.ts" "exists but $pkg_json has no e2e script"
	fi
done

[ "$failed" -eq 0 ] || exit 1

# True if a changed path can affect every package, not only the one it is in.
affects_every_package() {
	local path="$1" shared
	case "$path" in
	"$packages_prefix"*) return 1 ;; # inside a single plugin package
	plugins/*) return 0 ;;           # anything else under plugins/
	esac
	while IFS= read -r shared; do
		if [ -z "$shared" ]; then
			continue
		fi
		if [ "$path" = "$shared" ] || [[ "$shared" == */ && "$path" == "$shared"* ]]; then
			return 0
		fi
	done <<<"$shared_paths"
	return 1
}

if [ -n "$base" ]; then
	# --no-renames: a file moved between packages must list its old path too,
	# or the package it left would look unchanged. core.quotePath=false: git
	# otherwise wraps non-ASCII paths in quotes, so they would match nothing.
	if changed="$(git -c core.quotePath=false diff --no-renames --name-only "$base" HEAD 2>/dev/null)"; then
		filter=true
		changed_dirs='[]'
		while IFS= read -r path; do
			if [ -z "$path" ]; then
				continue
			fi
			if affects_every_package "$path"; then
				filter=false
				break
			fi
			if [[ "$path" == "$packages_prefix"* ]]; then
				# plugins/packages/@plugins/<name>/... -> plugins/packages/@plugins/<name>
				rest="${path#"$packages_prefix"}"
				changed_dirs="$(jq -c --arg d "$packages_prefix${rest%%/*}" '. + [$d]' <<<"$changed_dirs")"
			fi
		done <<<"$changed"

		if [ "$filter" = true ]; then
			keep='map(select(.dir | IN($dirs[])))'
			targets="$(jq -c --argjson dirs "$changed_dirs" "$keep" <<<"$targets")"
			e2e="$(jq -c --argjson dirs "$changed_dirs" "$keep" <<<"$e2e")"
		fi
	else
		echo "::warning::cannot diff against $base, so every package is selected" >&2
	fi
fi

jq -nc --argjson t "$targets" --argjson e "$e2e" '{targets: $t, e2e: $e}'
