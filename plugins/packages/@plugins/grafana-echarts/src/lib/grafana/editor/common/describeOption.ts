/**
 * Set the description of a previously-registered option by its `path`.
 *
 * Grafana's shared builders (`commonOptionsBuilder.addLegendOptions`, `addHideFrom`, …) register
 * controls without descriptions. Tools such as Grafana Assistant learn a panel only from these strings,
 * so a panel can fill them in after the fact. `getItems()` returns the live editor array.
 *
 * No-op when the path isn't present.
 */
export function describeOption(
  builder: { getItems(): Array<{ path: string; description?: string }> },
  path: string,
  description: string
): void {
  const item = builder.getItems().find((candidate) => candidate.path === path);
  if (item) {
    item.description = description;
  }
}
