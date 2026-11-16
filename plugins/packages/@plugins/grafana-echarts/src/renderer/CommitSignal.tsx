import { useEffect } from 'react';
import { type Prepared } from './prepare';

interface Props {
  prepared: Prepared;
  /** Called with `prepared` in the effects of the commit that shows it. */
  onCommit: (prepared: Prepared) => void;
}

/**
 * Tells the handle that React committed the view of `prepared`. It must be before the chart in the tree: React runs
 * the effects of a commit in one synchronous pass, an earlier sibling first, and the chart calls `setOption` in an
 * effect. So the call comes immediately before the chart draws `prepared`, and no ECharts event comes between them.
 * https://react.dev/reference/react/useEffect
 */
export const CommitSignal = ({ prepared, onCommit }: Props) => {
  useEffect(() => onCommit(prepared), [prepared, onCommit]);
  return null;
};
