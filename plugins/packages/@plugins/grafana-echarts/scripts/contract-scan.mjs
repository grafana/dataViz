// The `fixtures.11` scan of `sync-contract.mjs`: no secret, internal host or private URL in a copied file.
// It is a module of its own, so `contract-scan.test.mjs` can test it with no `gh` call.

/**
 * The `fixtures.11` checks. Each one has a type that the report names; the report never shows the value.
 * Public hosts and the loopback host (a fixture records `grafanaUrl` of a local Grafana) are allowed.
 */
const SECRET_CHECKS = [
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['Grafana token', /\bgl(c|sa)_[A-Za-z0-9+/=_-]{20,}/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{30,}/],
  ['AWS key', /\bAKIA[0-9A-Z]{16}\b/],
  ['auth header', /"(authorization|x-api-key|cookie)"\s*:/i],
  ['bearer token', /\bBearer\s+[A-Za-z0-9._~+/-]{16,}/],
  ['password', /"(password|passwd|secret|apiKey|api_key|token)"\s*:\s*"[^"]+"/i],
  ['credentials in URL', /[a-z]+:\/\/[^/\s"@]+:[^/\s"@]+@/i],
  ['internal host', /\b[a-z0-9.-]+\.(grafana-ops\.net|grafana-dev\.net|internal|svc\.cluster\.local|local)\b/i],
  ['private IP', /\b(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)\b/],
];

/**
 * The URLs that a copied file can have. The host ends at an optional port and then `/`, `?`, `#` or the end, so a
 * longer host (`grafana.com.evil.io`, `grafana.com-evil.io`) or a user part (`grafana.com@evil.io`) does not match.
 */
const ALLOWED_URL =
  /^(https:\/\/((www\.)?grafana\.com|github\.com|json-schema\.org|echarts\.apache\.org|example\.(com|org))|http:\/\/(localhost|127\.0\.0\.1))(:\d+)?(?=[/?#]|$)/;

const URL_PATTERN = /https?:\/\/[^\s"'<>)\\]+/g;

export const isAllowedUrl = (url) => ALLOWED_URL.test(url);

/** The problems of each file, as `<file>: <type>`. An empty list means that the files can be written. */
export function scanContractFiles(contents) {
  const hits = [];
  for (const [file, text] of contents) {
    for (const [type, pattern] of SECRET_CHECKS) {
      if (pattern.test(text)) {
        hits.push(`${file}: ${type}`);
      }
    }
    if ((text.match(URL_PATTERN) ?? []).some((url) => !isAllowedUrl(url))) {
      hits.push(`${file}: URL that is not on the allowed list`);
    }
  }
  return hits;
}
