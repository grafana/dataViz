# ECharts Relations panel for Grafana

ECharts Relations displays connected data as an interactive graph, Sankey diagram, or chord diagram. You can use it for service maps, dependency graphs, network traffic, and weighted flows.

![Graph, Sankey, chord, and time network presets](/public/plugins/%PLUGIN_ID%/img/relations-presets.png)

## Features

- You can select graph, Sankey, or chord in one panel.
- Presets provide starting points for service maps, circular networks, weighted flows, mutual relations, and time networks.
- Grafana field configuration controls value mappings, thresholds, data links, tooltips, legends, and colors.
- Panel configuration controls graph layouts, labels, edge styles, zoom, pan, and adjacency highlighting.
- The time slider displays ranged data at one timestamp.

![Time slider with graph, Sankey, and chord panels](/public/plugins/%PLUGIN_ID%/img/relations-timeline.png)

## Requirements

The panel requires Grafana 13.2.0 or later.

The panel reads wide data frames. Each numeric edge field defines one edge and needs labels that identify its source and target.

Grafana can convert supported row-based data before the panel reads it. This feature is experimental in Grafana 13.3. Enable `grafana.panelPluginTransformations` to use it.

## Get started

1. Add an ECharts Relations panel to a dashboard.
2. Open Presets and select a preset.
3. Query one numeric field for each edge.
4. Add source and target labels to each edge field.
5. Use field configuration to set units, colors, links, and value mappings.

The panel recognizes `source` and `target`, `client` and `server`, `src` and `dst`, or `from` and `to` as endpoint labels.

## Documentation

- [Data source guide](https://github.com/grafana/dataViz/blob/main/plugins/packages/@plugins/grafana-echarts/docs/relations-data-sources.md)
- [Data format reference](https://github.com/grafana/dataViz/blob/main/plugins/packages/@plugins/grafana-echarts/data-plane/graph-wide.md)
- [Report an issue](https://github.com/grafana/dataViz/issues)

## License

This plugin uses the [Apache License 2.0](https://github.com/grafana/dataViz/blob/main/plugins/packages/@plugins/grafana-echarts/LICENSE).
