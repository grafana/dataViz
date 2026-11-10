// The test App of the Renderer sandbox test (`tests-renderer/`). Not shipped.
// It stands in for the App of mcp-grafana: `webpack.renderer-harness.config.ts` bundles it with the contract peers and
// the built Renderer (`dist-renderer/renderer.js`), as `delivery.1` says the App build adds the Renderer to `app.html`.
// The page gives the viz spec in `<script type="application/json" id="viz-spec">`, the harness options in
// `<script type="application/json" id="harness-options">`, and reads the messages.
import { cacheStore } from 'react-inlinesvg';
import icons from '../../dist-renderer/icons.json';
import { render, specVersions, version } from '../../dist-renderer/renderer.js';

// `renderer.15`: before `render`, fill the icon cache of the `@grafana/ui` of the App from `icons.json`.
// `renderer.16`: the key is the URL that `Icon` requests. With no `window.__grafana_public_path__`, `Icon` requests
// `public/build/img/icons/<dir>/<name>.svg`.
// https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/Icon/utils.ts
for (const [key, content] of Object.entries(icons)) {
  cacheStore.set(`public/build/img/icons/${key}.svg`, { content, status: 'loaded' });
}

const post = (message) => parent.postMessage(message, '*');
// The test compares the exports of the built bundle with its manifest (`delivery.2`).
post({ type: 'module', version, specVersions });
const spec = JSON.parse(document.getElementById('viz-spec').textContent);
const options = JSON.parse(document.getElementById('harness-options').textContent);
// After the first state, `idle` comes when the iframe has no work left in its queue: the effects of the first draw
// have run, and so have their requests and CSP reports.
// https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback
let drawn = false;
const handle = render(document.getElementById('root'), spec, {
  onState: (state) => {
    post({ type: 'state', state });
    if (!drawn) {
      drawn = true;
      requestIdleCallback(() => post({ type: 'idle' }));
    }
  },
  ...(options.onRefresh === false ? {} : { onRefresh: (request) => post({ type: 'refresh', request }) }),
});
// The test sends `{ type: 'setRefreshed', ok, error }` to drive a refresh result, and `{ type: 'ping', id }` to wait
// until the work of an interaction is done (`pong` comes in the same way as `idle`).
addEventListener('message', (event) => {
  if (event.data && event.data.type === 'setRefreshed') {
    handle.setRefreshed(event.data.ok, event.data.error);
  }
  if (event.data && event.data.type === 'ping') {
    requestIdleCallback(() => post({ type: 'pong', id: event.data.id }));
  }
});
