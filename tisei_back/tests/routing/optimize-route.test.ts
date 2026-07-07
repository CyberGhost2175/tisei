import { describe, expect, it } from 'vitest';
import { optimizeRouteOrder } from '../../src/modules/routing/routing.service.js';

describe('optimizeRouteOrder partners first', () => {
  const depot = { lat: 51.133, lon: 71.476 };

  it('visits partner points before regular ones', () => {
    const points = [
      { id: 'a', latitude: 51.2, longitude: 71.4, partnerEstablishmentId: null },
      { id: 'b', latitude: 51.14, longitude: 71.48, partnerEstablishmentId: 'p1' },
      { id: 'c', latitude: 51.15, longitude: 71.49, partnerEstablishmentId: 'p2' },
    ];

    const ordered = optimizeRouteOrder(points, depot.lat, depot.lon);
    const partnerIdx = ordered.map((p) => !!p.partnerEstablishmentId);
    const firstRegular = partnerIdx.indexOf(false);
    const lastPartner = partnerIdx.lastIndexOf(true);

    if (firstRegular >= 0 && lastPartner >= 0) {
      expect(lastPartner).toBeLessThan(firstRegular);
    }
    expect(ordered.filter((p) => p.partnerEstablishmentId).length).toBe(2);
  });
});
