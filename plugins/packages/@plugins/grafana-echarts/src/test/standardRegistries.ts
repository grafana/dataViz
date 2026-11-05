// Fills the standard registries before a test loads a `module.tsx`. See `lib/grafana/registries/standardRegistries`.
// Import this file before a `module.tsx` in a test that builds the plugin options, for example with
// `getPanelOptionsWithDefaults`.
import { fillStandardRegistries } from 'lib/grafana/registries/standardRegistries';

fillStandardRegistries();
