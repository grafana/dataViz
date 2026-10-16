# Derived nodes take the filter gate of the whole panel

## Status

Open. Found on 2026-10-16 while building the span-metrics showcase dashboard
(`relations-showcase-spans` on ops, version 3).

## Release impact

This is a post-release task. A dashboard can avoid it: set `filterable: false` on the whole panel.

## What happens

A node that only edges declare (no node query) has no field of its own. The tooltip then decides
whether it offers filter buttons from `endpointsFilterable`:

```ts
// src/lib/echarts/relations/tooltip/marks.ts
endpointsFilterable: data.links.some((link) => link.field?.config.filterable === true),
```

So if **one** edge in the panel is filterable, **every** derived node is filterable. An override
that sets `filterable: false` on some edges does not remove the buttons from the nodes at the ends
of those edges.

## Why it matters

Ad hoc filters apply to every query on the data source. Some keys break other panels:

- On the showcase, the outcome sankey is `service → span_kind → status_code`. A `span_kind` filter
  empties every panel that hard-codes `SPAN_KIND_SERVER`. A `status_code="STATUS_CODE_ERROR"`
  filter makes every error ratio 100%.
- The dashboard wanted only the `service` nodes to make filters. With the panel-wide gate, it had to
  set `filterable: false` on the whole panel.

## Expected

A derived node is filterable only when at least one edge that **touches it** is filterable. The
incidence map (`toNodeFilterLabels` in the same file) already walks each node's edges, so it can
record the gate per node.

## Check

- A unit test in `src/lib/echarts/relations/tooltip/filters.test.ts`: two edge fields, one
  filterable. Only the nodes at the ends of the filterable edge offer a button.
- On the showcase: move `filterable: false` from the panel defaults of panel 3 to an override on
  `/^SPAN_KIND_.*-->STATUS_CODE_/` and `/-->SPAN_KIND_/`. Then the service nodes offer a filter,
  and the span kind and status nodes do not.
