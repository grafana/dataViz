import type { DashboardPage } from '@grafana/plugin-e2e';
import type { Page } from '@playwright/test';

/** One override rule of a panel's field config. */
export interface OverrideJson {
  matcher: { id: string; options?: unknown };
  properties: Array<{ id: string; value?: unknown }>;
}

/** One panel of a dashboard JSON. Only the keys that the tests read are typed. */
export interface PanelJson {
  id: number;
  options?: Record<string, unknown>;
  fieldConfig?: { defaults?: Record<string, unknown>; overrides?: OverrideJson[] };
  targets?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface CopyArgs {
  /** File name relative to `provisioning/dashboards/`. */
  fileName: string;
  /** Id of the panel to copy. The copy contains only this panel. */
  panelId: number;
  /** Changes the copied panel before the save, for an option that the provisioned panel does not set. */
  change?: (panel: PanelJson) => void;
}

/** A panel to copy, and the number of nodes that it draws. */
export interface PanelFixture extends CopyArgs {
  nodes: number;
}

export interface DashboardJson {
  title?: string;
  version?: number;
  panels?: PanelJson[];
  [key: string]: unknown;
}

/** A saved dashboard copy that a test can change, save and reload. */
export interface SavedCopy {
  uid: string;
  panelId: string;
  /** Reads the panel back from the saved dashboard JSON, not from the page. */
  readSavedPanel: () => Promise<PanelJson>;
  /** The version of the saved dashboard. A save through the UI increments it. */
  readSavedVersion: () => Promise<number>;
}

/** The centre of one node, in page pixels. */
export interface NodePoint {
  x: number;
  y: number;
}

/** A mouse movement, in page pixels. */
export interface DragVector {
  dx: number;
  dy: number;
}

/** The thresholds that `findNodes` sends into the page. */
export interface InkThresholds {
  coreRadiusPx: number;
  opaqueAlpha: number;
}

/** The test arguments that the scenarios use. */
export interface ScenarioArgs {
  page: Page;
  copyPanel: (args: CopyArgs) => Promise<SavedCopy>;
  gotoDashboardPage: (args: { uid: string }) => Promise<DashboardPage>;
}
