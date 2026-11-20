// Local fixture server. The renderer stays inside the same opaque sandbox as an MCP App.
import { createServer } from 'node:http';
import { readFileSync, readdirSync, existsSync, watch } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const fixturesDir = join(dirname(require.resolve('@grafana/viz-contract/package.json')), 'fixtures');
const fixtures = readdirSync(fixturesDir).filter((name) => existsSync(join(fixturesDir, name, 'spec.json')));
const port = Number(process.env.PORT || 4174);
const escape = (text) => String(text).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const script = (text) => text.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const json = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');
let revision = 0;
let building = false;
let pending = false;
let error = '';
let bundle;
let child;
let stopped = false;

function run(task) {
  return new Promise((done, fail) => {
    child = spawn('pnpm', ['run', task], { cwd: packageDir, stdio: 'inherit' });
    child.once('error', fail);
    child.once('exit', (code) => (code === 0 ? done() : fail(new Error(`${task} failed (${code})`))));
  });
}

async function build() {
  if (stopped) return;
  if (building) {
    pending = true;
    return;
  }
  building = true;
  error = '';
  try {
    await run('build:renderer');
    await run('build:renderer-harness');
    bundle = readFileSync(join(packageDir, 'dist-renderer-harness/app.js'), 'utf8');
    revision++;
    console.log(`Renderer ready: http://127.0.0.1:${port} (build ${revision})`);
  } catch (reason) {
    error = String(reason);
    console.error(error);
  } finally {
    building = false;
    if (pending) {
      pending = false;
      void build();
    }
  }
}

function page(url) {
  const fixture = url.searchParams.get('fixture') || 'prometheus-line';
  if (!fixtures.includes(fixture)) return null;
  const theme = url.searchParams.get('theme') === 'light' ? 'light' : 'dark';
  const dimension = (key, fallback) => Math.max(240, Math.min(2400, Number(url.searchParams.get(key)) || fallback));
  const width = dimension('width', 960);
  const height = dimension('height', 600);
  const spec = { ...JSON.parse(readFileSync(join(fixturesDir, fixture, 'spec.json'), 'utf8')), theme };
  const inner = bundle
    ? `<!doctype html><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'">
<style>html,body{margin:0}#root{width:${width}px;height:${height}px}</style><div id="root"></div>
<script type="application/json" id="viz-spec">${json(spec)}</script>
<script type="application/json" id="harness-options">{"onRefresh":true,"onMessage":true}</script>
<script>${script(bundle)}</script>`
    : '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>Renderer development</title>
<style>body{font:14px system-ui;margin:20px;background:#eee;color:#222}form{display:flex;gap:12px;align-items:center;flex-wrap:wrap}input{width:70px}iframe{border:0;margin-top:16px;background:white}pre{white-space:pre-wrap}</style></head><body>
<form><label>Fixture <select name="fixture">${fixtures.map((name) => `<option ${name === fixture ? 'selected' : ''}>${escape(name)}</option>`).join('')}</select></label>
<label>Theme <select name="theme"><option ${theme === 'dark' ? 'selected' : ''}>dark</option><option ${theme === 'light' ? 'selected' : ''}>light</option></select></label>
<label>Width <input name="width" type="number" min="240" max="2400" value="${width}"></label>
<label>Height <input name="height" type="number" min="240" max="2400" value="${height}"></label><button>Apply</button></form>
<p id="status">${escape(error || (building ? 'Building…' : 'Ready'))}</p>
<p>Refresh requests are acknowledged with fixture data unchanged. This preview does not query a datasource.</p>
<iframe id="app" title="Renderer preview" sandbox="allow-scripts" width="${width}" height="${height}" srcdoc="${escape(inner)}"></iframe>
<pre id="messages"></pre><script>
const frame = document.getElementById('app');
addEventListener('message', event => {
  if (event.source !== frame.contentWindow) return;
  document.getElementById('messages').textContent = JSON.stringify(event.data, null, 2);
  if (event.data?.type === 'refresh') frame.contentWindow.postMessage({type:'setRefreshed',id:event.data.request.id,ok:true}, '*');
});
setInterval(async () => {
  try {
    const state = await (await fetch('/status')).json();
    document.getElementById('status').textContent = state.error || (state.building ? 'Building…' : 'Ready');
    if (state.revision !== ${revision}) location.reload();
  } catch { document.getElementById('status').textContent = 'Development server disconnected'; }
}, 1000);
</script></body></html>`;
}

const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  response.setHeader('Cache-Control', 'no-store');
  if (url.pathname === '/status') {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ revision, building, error }));
    return;
  }
  const html = url.pathname === '/' ? page(url) : null;
  response.writeHead(html ? 200 : 404, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(html || 'Not found');
});
let debounce;
const watchers = [
  'src',
  'scripts/renderer-harness',
  'webpack.renderer.config.ts',
  'webpack.renderer-harness.config.ts',
].map((name) =>
  watch(join(packageDir, name), { recursive: true }, () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => void build(), 250);
  })
);
function stop() {
  stopped = true;
  clearTimeout(debounce);
  watchers.forEach((watcher) => watcher.close());
  child?.kill('SIGTERM');
  server.close();
}
server.on('error', (reason) => {
  console.error(reason);
  stop();
  process.exitCode = 1;
});
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
server.listen(port, '127.0.0.1', () => {
  console.log(`Renderer development server: http://127.0.0.1:${port}`);
  void build();
});
