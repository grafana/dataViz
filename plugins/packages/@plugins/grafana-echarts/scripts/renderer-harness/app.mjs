// The test App of the Renderer sandbox test (`tests-renderer/`). Not shipped.
// It plays the App of mcp-grafana: `webpack.renderer-harness.config.ts` bundles it with the contract peers and the
// built Renderer (`dist-renderer/renderer.js`), as the App build adds the Renderer to `app.html` (`delivery.1`).
// The page gives the viz spec in `<script type="application/json" id="viz-spec">` and reads the messages.
import { render, specVersions, version } from '../../dist-renderer/renderer.js';

const post = (message) => parent.postMessage(message, '*');
// The test compares the exports of the built bundle with its manifest (`delivery.2`).
post({ type: 'module', version, specVersions });
const spec = JSON.parse(document.getElementById('viz-spec').textContent);
const handle = render(document.getElementById('root'), spec, {
  onState: (state) => post({ type: 'state', state }),
  onRefresh: (request) => post({ type: 'refresh', request }),
});
// The test sends `{ type: 'setRefreshed', ok, error }` to drive a refresh result.
addEventListener('message', (event) => {
  if (event.data && event.data.type === 'setRefreshed') {
    handle.setRefreshed(event.data.ok, event.data.error);
  }
});
