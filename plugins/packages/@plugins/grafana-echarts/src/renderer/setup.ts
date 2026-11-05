// Runs before any panel module loads (`panels.ts` imports this file first): the option builders of each
// `module.tsx` need the standard registries.
import { fillStandardRegistries } from 'lib/grafana/registries/standardRegistries';

fillStandardRegistries();
