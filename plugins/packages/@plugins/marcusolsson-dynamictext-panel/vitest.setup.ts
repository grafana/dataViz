import '@testing-library/jest-dom/vitest';
import { beforeEach, vi } from 'vitest';

// jsdom lacks ResizeObserver, which @grafana/ui components (e.g. AutoSizer) use.
class ResizeObserverStub {
  observe() {
    /* empty */
  }
  unobserve() {
    /* empty */
  }
  disconnect() {
    /* empty */
  }
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

// Some hooks/utilities fetch external resources; default to an empty JSON
// response and reset the implementation before every test (parity with the
// plugin's original jest-setup).
const fetchMock = () => Promise.resolve({ json: () => Promise.resolve({}) });
vi.stubGlobal('fetch', vi.fn(fetchMock));

beforeEach(() => {
  vi.mocked(fetch).mockImplementation(fetchMock as never);
});
