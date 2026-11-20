# Temporary time range selector

This directory owns the renderer's standalone time range selection UI until the upstream package exports it.

Source: [grafana/grafana PR #138415](https://github.com/grafana/grafana/pull/138415), revision
`b231896a5c7d9de5a5569e09650ea38b9962e66e`, under `packages/grafana-ui/src/`.
The source package uses the Apache-2.0 license. The renderer package uses the same license.

`TimeRangeSelector` is the renamed `DateTimePickers/TimeRangePicker/TimePickerContent`.
Its local calendar, range, and timezone helpers come from the same revision. `options.ts` and `utils.ts`
come from `DateTimePickers`; `floating.ts` comes from `utils`; `getModalStyles.ts` comes from
`components/Modal`; `mixins.ts` retains only `getFocusStyles` from `themes/mixins.ts`.
Public UI components come from the pinned `@grafana/ui` package.

Local changes:

- Default quick ranges belong to the selector.
- The picker shell omits backward, forward, zoom, and Grafana time-sync controls.
- The renderer opts into compact tabs and hides history and timezone/fiscal-year controls.
- Storage failures do not prevent range selection.
- Clipboard input is checked before use.
- Imports and formatting use the renderer toolchain.

Track adoption in [dataViz #296](https://github.com/grafana/dataviz/issues/296).
Replace this directory with `TimeRangeSelector` and `TimeRangeSelectorProps` from `@grafana/ui/unstable`
after [grafana #138503](https://github.com/grafana/grafana/issues/138503) and the compact picker changes
are published, targeting 13.4. Check the actual package contents before removing this copy.
Keep the renderer trigger and popover shell, and retain the interaction tests during the cutover.
