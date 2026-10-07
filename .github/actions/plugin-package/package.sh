#!/usr/bin/env bash
# Signs a built plugin and packages it as <id>-<version>.zip, with
# <zip>.sha1 and <zip>.md5 next to it. The zip holds one top-level <id>/
# folder, the layout Grafana and grafana.com expect. The dist folder itself is
# left as is: signing runs on a copy.
#
# Adapted from grafana/plugin-ci-workflows actions/internal/plugins/package
# (package.sh). Differences: only the universal zip (no plugin here has a
# backend, so there are no per-os/arch zips), @grafana/sign-plugin pinned
# instead of @latest, and the unsigned check moved here from the action.
#
# Usage: package.sh <dist-folder> <output-folder>
# Env: GRAFANA_ACCESS_POLICY_TOKEN (signs the plugin; empty means unsigned),
# ALLOW_UNSIGNED ('true' to package without a token), SIGNATURE_TYPE
# (default grafana), GITHUB_OUTPUT (optional; gets zip=<zip file name>).
set -euo pipefail

sign_plugin_version=3.3.3

dist="${1:?usage: package.sh <dist-folder> <output-folder>}"
output="${2:?usage: package.sh <dist-folder> <output-folder>}"

if [ ! -f "$dist/plugin.json" ]; then
	echo "::error::No plugin.json in '$dist'; build the plugin first."
	exit 1
fi
plugin_id="$(jq -r '.id // ""' "$dist/plugin.json")"
plugin_version="$(jq -r '.info.version // ""' "$dist/plugin.json")"
if [ -z "$plugin_id" ] || [ -z "$plugin_version" ]; then
	echo "::error::$dist/plugin.json is missing id or info.version."
	exit 1
fi

if [ -z "${GRAFANA_ACCESS_POLICY_TOKEN:-}" ]; then
	if [ "${ALLOW_UNSIGNED:-false}" != true ]; then
		echo "::error::No access policy token, and unsigned plugins are not allowed."
		exit 1
	fi
	echo "::warning::No access policy token; $plugin_id is packaged unsigned."
fi

mkdir -p "$output"
output="$(cd "$output" && pwd)"
zip_name="$plugin_id-$plugin_version.zip"

staging="$(mktemp -d)"
trap 'rm -rf "$staging"' EXIT
cp -R "$dist" "$staging/$plugin_id"

cd "$staging"
if [ -n "${GRAFANA_ACCESS_POLICY_TOKEN:-}" ]; then
	npx -y "@grafana/sign-plugin@$sign_plugin_version" --signatureType="${SIGNATURE_TYPE:-grafana}" --distDir "$plugin_id"
fi
zip -qr "$output/$zip_name" "$plugin_id"
sha1sum "$output/$zip_name" | cut -f1 -d' ' | tr -d '\n' >"$output/$zip_name.sha1"
md5sum "$output/$zip_name" | cut -f1 -d' ' | tr -d '\n' >"$output/$zip_name.md5"

echo "Packaged $output/$zip_name"
if [ -n "${GITHUB_OUTPUT:-}" ]; then
	echo "zip=$zip_name" >>"$GITHUB_OUTPUT"
fi
