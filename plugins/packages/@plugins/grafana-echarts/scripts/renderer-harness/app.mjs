// The test App of the Renderer sandbox test (`tests-renderer/`). Not shipped.
// It stands in for the App of mcp-grafana: `webpack.renderer-harness.config.ts` bundles it with the contract peers and
// the built Renderer (`dist-renderer/renderer.js`), as `delivery.1` says the App build adds the Renderer to `app.html`.
// The page gives the viz spec in `<script type="application/json" id="viz-spec">` and reads the messages.
import { render, specVersions, version } from '../../dist-renderer/renderer.js';

const post = (message) => parent.postMessage(message, '*');
// The test compares the exports of the built bundle with its manifest (`delivery.2`).
post({ type: 'module', version, specVersions });
const spec = JSON.parse(document.getElementById('viz-spec').textContent);
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
  onRefresh: (request) => post({ type: 'refresh', request }),
});
// The test sends `{ type: 'setRefreshed', ok, error }` to drive a refresh result.
addEventListener('message', (event) => {
  if (event.data && event.data.type === 'setRefreshed') {
    handle.setRefreshed(event.data.ok, event.data.error);
  }
});
