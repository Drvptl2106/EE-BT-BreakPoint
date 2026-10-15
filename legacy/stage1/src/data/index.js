// The ONE place that decides which data implementation the app uses.
// Stage 2 adds `case 'api'` here and nothing else in the app changes.

import { assertDataLayer } from './contract.js';
import { createFakeDataLayer } from './fakeData.js';
import { createStorage } from './storage.js';

export function createDataLayer(config) {
  switch (config.backend) {
    case 'fake':
      return assertDataLayer(createFakeDataLayer({ storage: createStorage(), config }));
    default:
      throw new Error(`Unknown backend "${config.backend}". The hosted one arrives in Stage 2.`);
  }
}
