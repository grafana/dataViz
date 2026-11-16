// The busy state of a refresh (`refresh.4` to `refresh.7`, `refresh.13`, `refresh.15`).
import { type RefreshRequest } from '@grafana/viz-contract/renderer-api';
import { LOG_PREFIX } from './log';
import { refreshMessage } from './messages';
import { REFRESH_TIMEOUT_MS } from './registry';

type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never;

/** A `RefreshRequest` with no `id`. `RefreshController.request` gives the id (`refresh.13`). */
export type RefreshCause = WithoutId<RefreshRequest>;

/**
 * The number of `onRefresh` calls of all handles. Each call gets the next number as its `id` (`refresh.13`). One
 * counter for the module, so a late result for an earlier handle of the same `el` is not taken for a new request.
 */
let requestCount = 0;

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
  /** The `id` of the last `RefreshRequest` of this controller. */
  private lastId: string | undefined;

  constructor(
    private readonly onRefresh: (request: RefreshRequest) => void,
    private readonly onChange: (status: RefreshStatus) => void
  ) {}

  get current(): RefreshStatus {
    return this.status;
  }

  /** The user clicks Refresh or picks a time range (`refresh.2`, `refresh.3`). Busy refreshes do nothing. */
  request(cause: RefreshCause): void {
    if (this.status.busy) {
      return;
    }
    requestCount++;
    const id = String(requestCount);
    this.lastId = id;
    this.set({ busy: true });
    this.timer = setTimeout(() => this.finish(refreshMessage('refresh-timeout')), REFRESH_TIMEOUT_MS);
    try {
      this.onRefresh({ id, ...cause });
    } catch (error) {
      // `refresh.7`: as `setRefreshed(<id>, false, <error message>)`.
      console.error(LOG_PREFIX, error);
      this.setRefreshed(id, false, error instanceof Error ? error.message : String(error));
    }
  }

  /** `setRefreshed` of the handle (`refresh.5`, `refresh.6`). Only the `id` of the last request has an effect. */
  setRefreshed(id: string, ok: boolean, error?: string): void {
    if (!this.status.busy || id !== this.lastId) {
      return;
    }
    if (ok) {
      this.finish(undefined);
    } else {
      this.finish(error ? refreshMessage('refresh-failed', { error }) : refreshMessage('refresh-failed-no-detail'));
    }
  }

  /** `update` of the handle: the busy state ends, and a refresh message goes (`refresh.5`, `refresh.15`). */
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
