import { createContext } from 'react';
import { type PlacedAnnotationDraft } from '../hooks/useAnnotationGestures';

/**
 * An owner of the "Add annotation" form that is not the Grafana dashboard. With a host, the chart shows the Add
 * annotation UI with no `PanelContext.canAddAnnotations`, gives each draft to the host, and shows no editor of its
 * own. The functions must be stable.
 */
export interface AnnotationHost {
  /** The start time of the open form in epoch ms, or `null` with no form. */
  time: number | null;
  /** The user asks for a form at this point or range. */
  open: (draft: PlacedAnnotationDraft) => void;
  /** The window x of `time` on the chart: the open form moves to it. */
  place: (x: number) => void;
}

/**
 * The annotation host. The standalone renderer gives one when the App can save an annotation; the Grafana panel
 * gives none.
 * https://react.dev/reference/react/createContext
 */
export const AnnotationHostContext = createContext<AnnotationHost | undefined>(undefined);
