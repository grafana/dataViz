# Derived nodes ignore "Classic palette (by series name)"

## Status

Open. Found on 2026-10-16 on the span-metrics showcase dashboard (`relations-showcase-spans` on ops,
version 4).

## Release impact

This is a post-release task. Colors are still distinct. They only fail to match other panels.

## What happens

A node that only edges declare (no node query) gets its color from its position in the node list:

```ts
// src/lib/echarts/relations/converters/readNodes.ts
export function fillPaletteColors(nodes: RelationNode[], theme: GrafanaTheme2): void {
  nodes.forEach((node, index) => {
    if (node.color == null) {
      node.color = getPaletteColorByIndex(index, theme);
    }
  });
}
```

The panel's field color mode does not reach this code. With `color.mode: "palette-classic-by-name"`,
the time series panels color `cortex-gateway` from a hash of its name, but the sankey and graph
panels color it from its index. The same service has different colors on one dashboard. The index
also changes when the data changes, so a node can change color between refreshes.

Edges are not affected on their own: a palette mode leaves edge color to the endpoint node
(`edgeColorOf` in `markRead.ts`), so edges follow whatever color the node gets.

## Expected

When the edge fields use a by-name palette mode, a derived node gets the color that Grafana core gives a
series with the same display name. Use Grafana's own calculator, not a copy of its hash:
`getFieldColorModeForField` / `fieldColorModeRegistry.get(mode).getCalculator(field, theme)` with a field
whose `state.displayName` is the node name.
Docs: https://grafana.com/docs/grafana/latest/panels-visualizations/configure-standard-options/#color-scheme

Open questions:

- Which field's mode decides? Edge fields can have different overrides. Proposal: the mode of the panel
  defaults, read from any edge field before overrides, or the first edge that touches the node.
- A thresholds or fixed mode on the edges (for example the p95-per-hop graph, panel 111) must keep the
  current index palette for nodes.

## Check

- Unit test next to `readNodes.ts`: with `palette-classic-by-name`, node `cortex-gateway` gets the same
  color as a core time series field named `cortex-gateway`, whatever its index.
- On the showcase: `cortex-gateway` has one color in panels 105–107, 2, 3 and 110.
