# State timeline editor option parity

Compares the ECharts **State timeline** module ([module.tsx](./module.tsx)), rendering
`seriesType: custom`, against core Grafana's **State timeline** panel
([`public/app/plugins/panel/state-timeline/module.tsx`](https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/state-timeline/module.tsx)).

The panel draws each state as one bar of an ECharts `custom` series, after the ECharts "Gantt of
Airport Flights" example. The frame format is in
[data-plane/timeline.md](../../../data-plane/timeline.md). The option paths and defaults are core's,
so a panel switched from core keeps its settings.

## Coverage columns

- **Regression test**: `canvas:` names a case in the [canvas snapshot suite][canvas] (recorded draw
  calls). `integration:` names a case in the [integration suite][integration], which compares
  renders. `unit:` names a data prep, option or tooltip test. `—` means no test.
- **Demo panel**: the ECharts panel in the [core parity dashboard][db-parity], which puts core's
  panel on the left and this panel on the right with the same data. Live links assume
  `docker compose up` on the default `GRAFANA_PORT` (`http://localhost:3001`).

## Panel options

| Core Grafana option             | ECharts equivalent                                                                                   | Status        | Regression test                                                                                                                                                                        | Demo panel                                     |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Merge equal consecutive values  | `mergeValues`, default on                                                                            | Supported     | [integration: draws more bars with mergeValues off than on][integration], [unit: draws one segment per row when mergeValues is off][prepare]                                           | [parity dashboard][db-parity] · [#5][live-5]   |
| Show values (Auto/Always/Never) | `showValue`, default Auto                                                                            | Supported     | [integration: draws no text with showValue never][integration], [integration: draws text on a one-character bar with showValue always, but not auto][integration]                      | [parity dashboard][db-parity] · [#3][live-3]   |
| Align values                    | `alignValue`, default left. Left text sticks to the grid edge                                        | Supported     | [canvas: left][canvas], [canvas: center][canvas], [canvas: right][canvas], [unit: sticks left text to the visible grid edge, and counts only the visible width][options]               | [parity dashboard][db-parity] · [#3][live-3]   |
| Row height                      | `rowHeight`, default 0.9. One lane fills the full height                                             | Supported     | [integration: draws shorter bars with a lower rowHeight][integration], [integration: fills the full height with a single lane, whatever the rowHeight][integration]                    | [parity dashboard][db-parity] · [#13][live-13] |
| Page size (enable pagination)   | —                                                                                                    | Not supported | —                                                                                                                                                                                      | —                                              |
| Legend                          | Read-only `VizLegend`: threshold steps, or state colours                                             | Supported     | [unit: lists each state with its mapped colour][prepare], [unit: lists threshold steps in threshold colour mode][prepare], [unit: has no items in a continuous colour mode][prepare]   | [parity dashboard][db-parity] · [#7][live-7]   |
| Tooltip mode                    | Single, All and Hidden. All lists each lane at the hovered time. Sort and hide zeros are not applied | Partial       | [unit: shows start - end, the lane value with its swatch, and the duration][tooltip] · [integration: lists the state of each lane at the hovered time in the All tooltip][tooltip-int] | [parity dashboard][db-parity] · [#5][live-5]   |
| Annotations                     | —                                                                                                    | Not supported | —                                                                                                                                                                                      | —                                              |

## Field options

| Core Grafana option   | ECharts equivalent                                                                 | Status        | Regression test                                                                                                                          | Demo panel                                     |
| --------------------- | ---------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Line width            | `custom.lineWidth`, default 0. Border inside the bar                               | Supported     | [canvas: line width 1][canvas]                                                                                                           | [parity dashboard][db-parity] · [#3][live-3]   |
| Fill opacity          | `custom.fillOpacity`, default 70                                                   | Supported     | [unit: names lanes by display name and applies fillOpacity to the value colour][prepare]                                                 | [parity dashboard][db-parity] · [#3][live-3]   |
| Color scheme          | Grafana `field.display`, default `continuous-GrYlRd`                               | Supported     | [canvas: string states with value mappings][canvas], [canvas: numbers merged by threshold step][canvas]                                  | [parity dashboard][db-parity] · [#9][live-9]   |
| Value mappings        | Grafana `field.display`; mapped `null`/`NaN` draw a bar                            | Supported     | [canvas: boolean states][canvas], [unit: draws a mapped null as a bar][prepare]                                                          | [parity dashboard][db-parity] · [#15][live-15] |
| Thresholds            | Grafana `field.display`; merged by step                                            | Supported     | [unit: merges numbers in threshold colour mode by threshold step][prepare]                                                               | [parity dashboard][db-parity] · [#11][live-11] |
| Connect null values   | `custom.spanNulls`: Never, Always or a threshold, as core's `nullToUndefThreshold` | Supported     | [canvas: connect null values always][canvas], [integration: closes the gap of a null with Connect null values][integration]              | [parity dashboard][db-parity] · [#25][live-25] |
| Disconnect values     | `custom.insertNulls`: Grafana `applyNullInsertThreshold`                           | Supported     | [canvas: disconnect values over 15 minutes][canvas], [integration: adds gaps with Disconnect values under the row interval][integration] | [parity dashboard][db-parity] · [#27][live-27] |
| Axis placement, width | —                                                                                  | Not supported | —                                                                                                                                        | —                                              |
| Hide in area          | —                                                                                  | Not supported | —                                                                                                                                        | —                                              |

## Data shapes

| Shape                            | Status    | Regression test                                                                                                                                                                                   | Demo panel                                     |
| -------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Nulls draw gaps                  | Supported | [integration: draws a gap for a null][integration]                                                                                                                                                | [parity dashboard][db-parity] · [#3][live-3]   |
| Several frames, joined on time   | Supported | [unit: joins frames with NULL_RETAIN: a state continues over rows of other frames][prepare]                                                                                                       | [parity dashboard][db-parity] · [#5][live-5]   |
| Start and end time fields        | Supported | [canvas: start and end time fields][canvas], [integration: runs the last state of a lane to the end of the time range][integration], [unit: joins frames with start and end time fields][prepare] | [parity dashboard][db-parity] · [#17][live-17] |
| Enums after Convert field type   | Supported | —                                                                                                                                                                                                 | [parity dashboard][db-parity] · [#19][live-19] |
| No time field, or no value field | Supported | [unit: errors with no time fields][prepare], [unit: requires a number, string, or boolean value][prepare]                                                                                         | —                                              |

## Differences from core

- **X axis ticks.** ECharts puts fewer ticks on the time axis than core (hourly against every 30
  minutes on a 6 h range). All the time-axis families share this.
- **Hover.** Core lightens the hovered bar. This panel does not.
- **Data outside the time range.** Core shows "Data outside time range" and a "Zoom to data"
  button. This panel shows an empty plot.
- **Tooltip duration with `mergeValues` off.** Core measures to the next _different_ state. This
  panel measures to the end of the hovered bar.
- **Density.** With 64 lanes of 1000 unmerged states, the first render takes about 2.9 s of long
  tasks against 272 ms for core, and a hover costs up to about 100 ms. Core draws one path per
  colour. This panel draws one element per bar, but it does not draw a 1 px bar that the next bar
  of its lane covers. Thus a lane has at most about one element per pixel. See the "Dense lanes"
  panels of `timeline-core-parity`.

[canvas]: ../../lib/components/timeline.canvas.test.tsx
[integration]: ../../lib/components/timeline.integration.test.tsx
[prepare]: ../../lib/grafana/timeline/prepareTimeline.test.ts
[options]: ../../lib/echarts/options/timeline.test.ts
[tooltip]: ../../lib/echarts/tooltip/timeline.test.ts
[tooltip-int]: ../../lib/components/timeline-tooltip.integration.test.tsx
[db-parity]: ../../../provisioning/dashboards/timeline/timeline-core-parity.json
[live-3]: http://localhost:3001/d/echarts-state-timeline-parity?viewPanel=3
[live-5]: http://localhost:3001/d/echarts-state-timeline-parity?viewPanel=5
[live-7]: http://localhost:3001/d/echarts-state-timeline-parity?viewPanel=7
[live-9]: http://localhost:3001/d/echarts-state-timeline-parity?viewPanel=9
[live-11]: http://localhost:3001/d/echarts-state-timeline-parity?viewPanel=11
[live-13]: http://localhost:3001/d/echarts-state-timeline-parity?viewPanel=13
[live-15]: http://localhost:3001/d/echarts-state-timeline-parity?viewPanel=15
[live-25]: http://localhost:3001/d/echarts-state-timeline-parity?viewPanel=25
[live-27]: http://localhost:3001/d/echarts-state-timeline-parity?viewPanel=27
[live-17]: http://localhost:3001/d/echarts-state-timeline-parity?viewPanel=17
[live-19]: http://localhost:3001/d/echarts-state-timeline-parity?viewPanel=19
