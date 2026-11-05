import { createContext } from 'react';

/**
 * Tells a host that the panel shows its own error view in place of the chart: the message when the view shows,
 * and `null` when the view goes. The Renderer (`src/renderer/`) gives the `panel-error` state from it (viz contract
 * 1.0.0, `state.5`).
 */
export type PanelErrorSignal = (message: string | null) => void;

/** The signal of the host. Grafana gives no signal, so the default does nothing. */
export const PanelErrorContext = createContext<PanelErrorSignal>(() => {});
