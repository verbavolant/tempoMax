import { describe, expect, it } from 'vitest';
import type { Client } from '../../src/model/client';
import { type Visit, startVisit } from '../../src/model/visit';
import { mergeVisits, orderClientsByDistance } from '../../src/ui/visits';

const here = { latitude: 45.4642, longitude: 9.19 };
const client = (name: string, latitudeOffset?: number): Client => ({
  id: name,
  name,
  radiusMeters: 200,
  createdAt: '2026-10-31T09:00:00+01:00',
  ...(latitudeOffset !== undefined && { location: { latitude: here.latitude + latitudeOffset, longitude: here.longitude } }),
});

describe('orderClientsByDistance', () => {
  const near = client('Vicino', 0.001);
  const far = client('Lontano', 0.01);
  const noLocation = client('Anna');

  it('mette prima i più vicini e in fondo quelli senza posizione', () => {
    expect(orderClientsByDistance([noLocation, far, near], here).map((c) => c.name)).toEqual(['Vicino', 'Lontano', 'Anna']);
  });

  it('senza posizione di riferimento ordina alfabeticamente', () => {
    expect(orderClientsByDistance([near, far, noLocation], null).map((c) => c.name)).toEqual(['Anna', 'Lontano', 'Vicino']);
  });
});

describe('mergeVisits', () => {
  const visitAt = (id: string, at: string): Visit => ({ ...startVisit(at, null), id });

  it('preferisce la versione locale e ordina dalla più recente', () => {
    const old = visitAt('a', '2026-10-30T09:00:00+01:00');
    const onDrive = visitAt('b', '2026-10-31T09:00:00+01:00');
    const localNewer = { ...onDrive, clientId: 'c-1' };
    const onlyLocal = visitAt('c', '2026-10-31T15:00:00+01:00');
    expect(mergeVisits([old, onDrive], [localNewer, onlyLocal], 20)).toEqual([onlyLocal, localNewer, old]);
  });

  it('rispetta il limite', () => {
    const visits = ['01', '02', '03'].map((day) => visitAt(day, `2026-10-${day}T09:00:00+01:00`));
    expect(mergeVisits(visits, [], 2).map((visit) => visit.id)).toEqual(['03', '02']);
  });
});
