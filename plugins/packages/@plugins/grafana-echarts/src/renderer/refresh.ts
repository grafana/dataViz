// The busy state of a refresh (`refresh.4` to `refresh.7`).
import { type RefreshRequest } from '@grafana/viz-contract/renderer-api';
import { LOG_PREFIX } from './log';
import { refreshMessage } from './messages';
import { REFRESH_TIMEOUT_MS } from './registry';

export interface RefreshStatus {
  /** True after a call of `onRefresh`, until its result (`refresh.4`). */
  busy: boolean;
  /** The text of a failed refresh (`refresh.5`). It stays until the next refresh or `update`. */
  message?: string;
}

export class RefreshController {
  /** `busy` is true while the last `onRefresh` call has no result. Only that call gets a result (`refresh.6`). */
  private status: RefreshStatus = { busy: false };
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly onRefresh: (request: RefreshRequest) => void,
    private readonly onChange: (status: RefreshStatus) => void
  ) {}

  get current(): RefreshStatus {
    return this.status;
  }

  /** The user clicks Refresh or picks a time range (`refresh.2`, `refresh.3`). Busy refreshes do nothing. */
  request(request: RefreshRequest): void {
    if (this.status.busy) {
      return;
    }
    this.set({ busy: true });
    this.timer = setTimeout(() => this.finish(refreshMessage('refresh-timeout')), REFRESH_TIMEOUT_MS);
    try {
      this.onRefresh(request);
    } catch (error) {
      // `refresh.7`: as `setRefreshed(false, <error message>)`.
      console.error(LOG_PREFIX, error);
      this.setRefreshed(false, error instanceof Error ? error.message : String(error));
    }
  }

  /** `setRefreshed` of the handle (`refresh.5`, `refresh.6`). */
  setRefreshed(ok: boolean, error?: string): void {
    if (!this.status.busy) {
      return;
    }
    if (ok) {
      this.finish(undefined);
    } else {
      this.finish(error ? refreshMessage('refresh-failed', { error }) : refreshMessage('refresh-failed-no-detail'));
    }
  }

  /** `update` of the handle: the busy state ends, and an old message goes (`refresh.5`). */
  updated(): void {
    if (this.status.busy || this.status.message !== undefined) {
      this.finish(undefined);
    }
  }

  /** Stops the timer (`renderer.5`). */
  dispose(): void {
    clearTimeout(this.timer);
  }

  private finish(message: string | undefined): void {
    clearTimeout(this.timer);
    this.set({ busy: false, message });
  }

  private set(status: RefreshStatus): void {
    this.status = status;
    this.onChange(status);
  }
}
