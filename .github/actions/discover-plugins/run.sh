#!/usr/bin/env bash
# The action's entry point: picks the base commit for `changed-only`, runs
# discover.sh, and writes its lists to $GITHUB_OUTPUT as `targets`, `e2e` and
# `artifacts`.
#
# Env: ROOT, CHANGED_ONLY ('true' to filter), PR_BASE
# (github.event.pull_request.base.sha), PR_HEAD
# (github.event.pull_request.head.sha), PUSH_BEFORE (github.event.before),
# ACTION_PATH (directory holding discover.sh), GITHUB_OUTPUT. SHARED_PATHS is
# read by discover.sh itself.
set -euo pipefail

base=''
# Logged with the base, so a run that selects every package says why.
source='changed-only is off'
if [ "$CHANGED_ONLY" = true ]; then
	base="${PR_BASE:-$PUSH_BEFORE}"
	if [ -n "$PR_BASE" ]; then
		source='PR base'
	else
		source='push before'
	fi
	# A pull_request checkout is GitHub's test merge of the PR head into the
	# base branch as it is now, but PR_BASE can be an older base commit. Diffing
	# from PR_BASE then also counts everything merged to the base branch since,
	# and one lockfile bump there selects every package. The merge's first
	# parent is the base it was made from, so the diff is only the PR's changes.
	if [ -n "$PR_BASE" ] && [ -n "${PR_HEAD:-}" ] &&
		[ "$(git rev-parse -q --verify 'HEAD^2' 2>/dev/null)" = "$PR_HEAD" ]; then
		base="$(git rev-parse 'HEAD^1')"
		source='test merge first parent'
	fi
	# A push that creates a branch has an all-zero `before`.
	if [[ "$base" =~ ^0+$ ]]; then
		base=''
	fi
	if [ -z "$base" ]; then
		source='no usable base'
	fi
fi
echo "changed-only base: ${base:-none, every package selected} ($source)"

# An empty base is the same as none: discover.sh then filters nothing.
result="$(bash "$ACTION_PATH/discover.sh" "$ROOT" "$base")"
jq . <<<"$result"
{
	echo "targets=$(jq -c '.targets' <<<"$result")"
	echo "e2e=$(jq -c '.e2e' <<<"$result")"
	echo "artifacts=$(jq -c '.artifacts // []' <<<"$result")"
} >>"$GITHUB_OUTPUT"
