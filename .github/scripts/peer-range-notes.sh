#!/usr/bin/env bash
# Writes the peer dependency note of a non-plugin release: the
# peerDependencies of the built package.json that differ from the previous
# release. The attach job appends the file to the release notes, so a consumer
# sees a changed peer range before a sync. With no previous tag it lists
# every peer. A baseline tag pushed by hand counts as a previous tag. With no change, or no SOURCE, the file is empty and nothing is
# appended.
#
# The previous release is the tag with the same component and the highest
# version below TAG. TAG itself already exists at the built commit
# (release-please creates it), so it is left out. Needs the tags in the
# checkout (fetch-depth: 0).
#
# Env: TAG (the release tag, <component>/v<version>), SOURCE (repo-root-relative
# checked-in source of the built package.json, read at the previous tag; may be
# empty), BUILT (the built package.json), OUT (the notes file to write).
# Run from the repo root.
set -euo pipefail

mkdir -p "$(dirname "$OUT")"
: >"$OUT"
if [ -z "${SOURCE:-}" ]; then
	exit 0
fi

# Version order, so v0.10.0 is after v0.9.0. The line before TAG, or the last
# line when the checkout does not have TAG.
previous="$(git tag -l --sort=v:refname "${TAG%/v*}/v*" | awk -v tag="$TAG" '
	$0 == tag { found = 1; exit }
	{ last = $0 }
	END { print last }')"

new="$(jq -c '.peerDependencies // {}' "$BUILT")"
old='{}'
if [ -n "$previous" ] && source_json="$(git show "$previous:$SOURCE" 2>/dev/null)"; then
	old="$(jq -c '.peerDependencies // {}' <<<"$source_json")"
else
	previous=''
fi

lines="$(jq -rn --argjson old "$old" --argjson new "$new" --arg previous "$previous" '
	(($new | keys_unsorted) + (($old | keys_unsorted) - ($new | keys_unsorted)))[]
	| . as $name
	| select($old[$name] != $new[$name])
	| if $previous == "" then "- `\($name)` `\($new[$name])`"
	  else "- `\($name)`: `\($old[$name] // "not a peer")` → `\($new[$name] // "removed")`"
	  end')"
if [ -z "$lines" ]; then
	echo "Peer dependencies: no change since ${previous}"
	exit 0
fi

{
	echo '### Peer dependencies'
	echo
	if [ -n "$previous" ]; then
		echo "Changed since \`$previous\`:"
	else
		echo 'The App must give these packages:'
	fi
	echo
	echo "$lines"
} >"$OUT"
echo "Wrote $OUT:"
cat "$OUT"
