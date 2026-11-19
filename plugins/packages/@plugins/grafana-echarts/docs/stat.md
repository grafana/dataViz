# Use the ECharts Stat panel

ECharts Stat shows one large value for each series, with its name and a sparkline. It is the Grafana
[Stat panel](https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/stat/) on an ECharts
canvas. It has the options of the Stat panel, with the same names and the same defaults.

The panel is part of the ECharts app plugin. It is not a standalone plugin.

## Data requirements

The panel needs one number field or more. Each number field gives one value.

- A time series query gives one value for each series: the last value that is not null. The other values of
  the series draw as the sparkline.
- A table query gives one value for each number field. Set **Show** to **All values** for one value for each
  row.
- A query that streams, for example from a Grafana Live channel, updates the values with each new row.

If the data has no number field, the panel shows a message and no value. If you set the **No value** standard
option, the panel shows that text as the message.

## Get started

1. Add a panel to a dashboard, and select **ECharts Stat** as the visualization.
2. Write a query that returns a number field.
3. In **Value options**, select the **Calculation** that makes one value from each series.
4. In **Standard options**, set the **Unit**. In **Thresholds**, set the colors of the values.

To change a Stat panel into an ECharts Stat panel, select **ECharts Stat** in the visualization picker. The
panel keeps the options, the field options and the overrides of the Stat panel. A change from a different
panel, for example Gauge, keeps the calculation and the orientation.

## Options

### Value options

| Option      | Function                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------ |
| Show        | **Calculate** gives one value for each field. **All values** gives one value for each row. |
| Calculation | The reducer that makes the value of a field, for example **Last \*** or **Mean**.          |
| Limit       | The largest number of rows that **All values** shows. The default is 25.                   |
| Fields      | The fields that the panel shows. The default is all number fields.                         |

### Stat styles

| Option                    | Function                                                                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Orientation               | **Auto** puts the values in a grid. **Horizontal** puts them one below the other. **Vertical** puts them side by side.                          |
| Text mode                 | The text of each value: the value, the name, the value and the name, or no text. **Auto** shows the name when the panel has two values or more. |
| Wide layout               | With **On**, a wide value has its name at the left and its value at the right. It shows for the text mode **Value and name**.                   |
| Color mode                | **Value** colors the text. **Background Gradient** and **Background Solid** color the cell. **None** uses the text color of the theme.          |
| Graph mode                | **Area** draws the sparkline. **None** draws no sparkline.                                                                                      |
| Text alignment            | **Auto** puts the text at the left of the cell. **Center** puts it at the center.                                                               |
| Show percent change       | Shows the change from the first value to the last value of the series, in percent. It shows when **Show** is **Calculate**.                     |
| Percent change color mode | **Standard** is green for an increase and red for a decrease. **Inverted** is the opposite. **Same as Value** uses the color of the value.      |

### Text size

**Title**, **Value** and **Percent change** set the font size of each text in pixels. With no size, the panel
fits the name and the value to the cell.

A name with a set size that is wider than its cell is cut, with an ellipsis.

### Standard options, thresholds, value mappings and overrides

The panel uses the Grafana field options: unit, decimals, min, max, display name, color scheme, thresholds,
value mappings and data links. You can set an override for each of them.

The default color scheme is **From thresholds**, as in the Stat panel.

## Data links

Add data links in the **Data links** field option.

- A value with one link shows the pointer cursor. A click opens the link.
- A value with two links or more shows the menu cursor. A click opens a menu with the links.

You cannot open a link with the keyboard.

## Many values

The panel has no limit for the number of values. The cells get smaller as the number of values increases, and
a small cell draws no sparkline. A panel with 200 values draws in one ECharts series.

## Assistive tools

The chart is one image for a screen reader. Its text is the name and the value of each cell, with the percent
change when the panel shows one, for example "cpu: 72%, change 106%; memory: 65%".

## Differences from the Stat panel

- The panel has no presets.
- A value has no browser tooltip. The Stat panel shows the title of a link, or the name that the text mode
  hides, as a tooltip.
- You cannot move to a value with the keyboard, and a screen reader reads all values as one text.
- With no value, the panel shows a message, and not the "No value" text as a large value.
- The sparkline has a gap only for a null value. The Stat panel also makes a gap where rows are missing.
- The colors in the middle of a background gradient differ a little from the Stat panel.

The [parity document](../src/modules/stat/parity.md) has the full list, with the test for each option.

## Examples

The [stat basics dashboard](../provisioning/dashboards/stat/stat-basics.json) has one row for each option.
Each row has the ECharts Stat panel at the left and the Stat panel at the right, with the same data and
options. Run `pnpm run server` to open it in a local Grafana.
