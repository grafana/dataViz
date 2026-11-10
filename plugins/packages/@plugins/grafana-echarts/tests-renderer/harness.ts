// The page of the Renderer sandbox test: the test App in `<iframe sandbox="allow-scripts" srcdoc>` with the default
// content security policy of MCP Apps (`renderer.6`).
import { expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * The CSP that a Host MUST use when the resource declares no `ui.csp` ("Restrictive Default"), plus the directives
 * that the Sandbox adds (`object-src`, `frame-src`, `base-uri`).
 * https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx
 */
export const MCP_APPS_DEFAULT_CSP = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "media-src 'self' data:",
  "connect-src 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

const PACKAGE_DIR = path.join(__dirname, '..');
const app = () => fs.readFileSync(path.join(PACKAGE_DIR, 'dist-renderer-harness', 'app.js'), 'utf8');

// The Jest tests read the fixture sets with the same functions.
export { fixtureSets, fixtureSpec, fixtureState } from '../src/test/rendererFixtures';

/**
 * Code in a `<script>` element: a `</script` in it would end the element. The escapes are legal in a JS string and in
 * a regular expression with no `u` or `v` flag, which is where the App bundle has them. With `u` or `v`, `\/` is legal
 * but `\!` is not: `/<\!--/u` throws "Invalid escape". If the bundle gets one, the App script does not parse, and the
 * `error` probe (which runs first, in its own script) reports the `SyntaxError`, so the sandbox tests fail.
 */
const scriptText = (text: string) => text.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

/** JSON in a `<script>` element. `<` replaces each `<`, because `\!` is not a JSON escape. */
const scriptJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

/** The probes run first: CSP violations, errors, and a `localStorage` read (`renderer.8`). */
const PROBES = `
const post = (message) => parent.postMessage(message, '*');
addEventListener('securitypolicyviolation', (e) =>
  post({ type: 'csp', directive: e.effectiveDirective, blocked: e.blockedURI, sample: e.sample }));
addEventListener('error', (e) => post({ type: 'error', message: String(e.message) }));
addEventListener('unhandledrejection', (e) => post({ type: 'error', message: String(e.reason) }));
try { localStorage.getItem('probe'); post({ type: 'storage', readable: true }); }
catch (e) { post({ type: 'storage', readable: false, name: e.name }); }
`;

/** The outer page: it records the messages of the iframe in `window.messages`. */
export function harnessPage(spec: unknown, size = { width: 640, height: 400 }): string {
  const inner = `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${MCP_APPS_DEFAULT_CSP}">
<style>html,body{margin:0}#root{width:${size.width}px;height:${size.height}px}</style></head>
<body><div id="root"></div>
<script>${scriptText(PROBES)}</script>
<script type="application/json" id="viz-spec">${scriptJson(spec)}</script>
<script>${scriptText(app())}</script></body></html>`;
  const srcdoc = inner.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">
<script>window.messages = []; addEventListener('message', (e) => window.messages.push(e.data));</script>
<iframe id="app" sandbox="allow-scripts" style="border:0;width:${size.width}px;height:${size.height}px" srcdoc="${srcdoc}"></iframe>
</body></html>`;
}

export type Message = { type: string; [key: string]: unknown };

/**
 * The page has a real https URL, as the sandbox proxy of a Host has, so a relative URL in the iframe resolves to a
 * request (with `setContent`, it resolves against `about:blank` and fails with no request and no CSP report).
 */
export const HOST_URL = 'https://sandbox.host.test/';

/**
 * Draws `spec`, records every request but the page (and blocks it), and waits for `idle` from the App: the first
 * `onState` and the work that it queued are done. A timer that the Renderer sets for later is not included.
 */
export async function draw(page: Page, spec: unknown) {
  const requests: string[] = [];
  const html = harnessPage(spec);
  await page.route('**/*', (route) => {
    if (route.request().url() === HOST_URL) {
      return route.fulfill({ contentType: 'text/html; charset=utf-8', body: html });
    }
    requests.push(route.request().url());
    return route.abort();
  });
  await page.goto(HOST_URL);
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { messages: Message[] }).messages.some((m) => m.type === 'idle'))
    )
    .toBe(true);
  const messages: Message[] = await page.evaluate(() => (window as unknown as { messages: Message[] }).messages);
  const of = (type: string) => messages.filter((m) => m.type === type);
  return { requests, messages, of, states: of('state').map((m) => m.state) };
}
