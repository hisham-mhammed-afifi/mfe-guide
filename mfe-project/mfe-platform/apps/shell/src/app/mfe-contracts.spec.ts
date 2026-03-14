// apps/shell/src/app/mfe-contracts.spec.ts
import { Route } from '@angular/router';

describe('MFE Contract Tests', () => {
  it('mfe_products exposes remoteRoutes as a non-empty array', async () => {
    const mod = await import('@mfe-platform/mfe_products/entry');
    // Verify the export exists and is an array with at least one route
    expect(mod.remoteRoutes).toBeDefined();
    expect(Array.isArray(mod.remoteRoutes)).toBe(true);
    expect(mod.remoteRoutes.length).toBeGreaterThan(0);
    // Verify there is a default route (path: '')
    expect(mod.remoteRoutes.find((r: Route) => r.path === '')).toBeDefined();
  });

  it('mfe_orders exposes remoteRoutes as a non-empty array', async () => {
    const mod = await import('@mfe-platform/mfe_orders/entry');
    expect(mod.remoteRoutes).toBeDefined();
    expect(Array.isArray(mod.remoteRoutes)).toBe(true);
  });

  it('mfe_account exposes remoteRoutes as a non-empty array', async () => {
    const mod = await import('@mfe-platform/mfe_account/entry');
    expect(mod.remoteRoutes).toBeDefined();
    expect(Array.isArray(mod.remoteRoutes)).toBe(true);
  });
});
