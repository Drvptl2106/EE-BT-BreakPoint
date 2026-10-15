// The ONE place that decides which login implementation the app uses.
// Stage 3 adds the invite-only login here.

import { assertAuthLayer } from './contract.js';
import { createStubAuth } from './stubAuth.js';
import { createStorage } from '../data/storage.js';

export function createAuthLayer(config) {
  switch (config.auth) {
    case 'stub':
      return assertAuthLayer(createStubAuth({ storage: createStorage() }));
    default:
      throw new Error(`Unknown auth "${config.auth}". The real login arrives in Stage 3.`);
  }
}
