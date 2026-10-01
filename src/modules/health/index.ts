import type { HttpModule } from '../../shared/http/http-module.ts';
import { createHealthRouter, registerHealthOpenApi } from './http/health.router.ts';

const basePath = '/health';

export function createHealthModule(): HttpModule {
  return {
    basePath,
    router: createHealthRouter(),
    registerOpenApi: (registry) => {
      registerHealthOpenApi(registry, basePath);
    },
  };
}
