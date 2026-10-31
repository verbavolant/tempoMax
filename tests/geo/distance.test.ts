import { describe, expect, it } from 'vitest';
import {
  EARTH_MEAN_RADIUS_METERS,
  distanceMeters,
  findClientAtPosition,
  findNearestClient,
} from '../../src/geo/distance';
import type { Client } from '../../src/model/client';

describe('distanceMeters', () => {
  it('riproduce il valore di riferimento Rosetta Code BNA → LAX, riscalato sul raggio GRS80', () => {
    // https://rosettacode.org/wiki/Haversine_formula: con R = 6371,0 km la distanza è
    // 2886,44444283798329974715782394574671655 km. La distanza è proporzionale a R, quindi si riscala.
    const referenceKmAtRadius6371 = 2886.4444428379834;
    const expectedMeters = referenceKmAtRadius6371 * 1000 * (EARTH_MEAN_RADIUS_METERS / 6_371_000);
    const bna = { latitude: 36.12, longitude: -86.67 };
    const lax = { latitude: 33.94, longitude: -118.4 };
    expect(distanceMeters(bna, lax)).toBeCloseTo(expectedMeters, 3);
  });

  it('un grado lungo un meridiano vale R·π/180', () => {
    const expected = (EARTH_MEAN_RADIUS_METERS * Math.PI) / 180;
    expect(distanceMeters({ latitude: 45, longitude: 9 }, { latitude: 46, longitude: 9 })).toBeCloseTo(expected, 6);
  });

  it('i punti antipodali distano mezza circonferenza', () => {
    const expected = EARTH_MEAN_RADIUS_METERS * Math.PI;
    expect(distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 180 })).toBeCloseTo(expected, 3);
  });

  it('è zero sullo stesso punto e simmetrica', () => {
    const villa = { latitude: 45.4642, longitude: 9.19 };
    const garden = { latitude: 45.4651, longitude: 9.1912 };
    expect(distanceMeters(villa, villa)).toBe(0);
    expect(distanceMeters(villa, garden)).toBeCloseTo(distanceMeters(garden, villa), 9);
  });

  it('attraversa l’antimeridiano senza fare il giro lungo', () => {
    const expected = (EARTH_MEAN_RADIUS_METERS * Math.PI) / 180;
    expect(distanceMeters({ latitude: 0, longitude: 179.5 }, { latitude: 0, longitude: -179.5 })).toBeCloseTo(
      expected,
      3,
    );
  });
});

describe('findNearestClient', () => {
  const client = (id: string, location?: Client['location']): Client => ({
    id,
    name: id,
    radiusMeters: 150,
    createdAt: '2026-10-30T09:00:00+01:00',
    ...(location && { location }),
  });
  const here = { latitude: 45.4642, longitude: 9.19 };

  it('sceglie il cliente più vicino e ne riporta la distanza', () => {
    const near = client('vicino', { latitude: 45.4643, longitude: 9.19 });
    const far = client('lontano', { latitude: 45.5, longitude: 9.19 });
    const nearest = findNearestClient(here, [far, near]);
    expect(nearest?.client).toBe(near);
    expect(nearest?.distanceMeters).toBeCloseTo(distanceMeters(here, { latitude: 45.4643, longitude: 9.19 }), 9);
  });

  it('ignora i clienti senza posizione', () => {
    const located = client('con-posizione', { latitude: 45.6, longitude: 9.19 });
    expect(findNearestClient(here, [client('senza-posizione'), located])?.client).toBe(located);
  });

  it('restituisce null se nessun cliente ha una posizione', () => {
    expect(findNearestClient(here, [client('a'), client('b')])).toBeNull();
    expect(findNearestClient(here, [])).toBeNull();
  });
});

describe('findClientAtPosition', () => {
  const here = { latitude: 45.4642, longitude: 9.19 };
  // 0,001° di latitudine ≈ 111 m (R·π/180 / 1000).
  const north = (degrees: number) => ({ latitude: here.latitude + degrees, longitude: here.longitude });
  const client = (id: string, radiusMeters: number, location?: Client['location']): Client => ({
    id,
    name: id,
    radiusMeters,
    createdAt: '2026-10-30T09:00:00+01:00',
    ...(location && { location }),
  });

  it('riconosce il cliente se la posizione è entro il raggio', () => {
    const villa = client('villa', 150, north(0.001));
    expect(findClientAtPosition(here, [villa])).toBe(villa);
  });

  it('nessun cliente se la posizione è fuori dal raggio', () => {
    expect(findClientAtPosition(here, [client('villa', 100, north(0.001))])).toBeNull();
  });

  it('preferisce un cliente più lontano che contiene la posizione a uno più vicino che non la contiene', () => {
    const nearSmall = client('vicino-piccolo', 50, north(0.001));
    const farLarge = client('lontano-grande', 500, north(-0.003));
    expect(findClientAtPosition(here, [nearSmall, farLarge])).toBe(farLarge);
  });

  it('tra più clienti che contengono la posizione sceglie il più vicino', () => {
    const near = client('vicino', 300, north(0.001));
    const far = client('lontano', 300, north(0.002));
    expect(findClientAtPosition(here, [far, near])).toBe(near);
  });

  it('ignora i clienti senza posizione', () => {
    expect(findClientAtPosition(here, [client('senza', 10_000)])).toBeNull();
  });
});
