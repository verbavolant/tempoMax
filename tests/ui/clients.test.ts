import { describe, expect, it } from 'vitest';
import type { Client } from '../../src/model/client';
import { orderClientsForList } from '../../src/ui/clients';

const client = (name: string): Client => ({ id: name, name, radiusMeters: 200, createdAt: '2026-10-31T09:00:00+01:00' });

describe('orderClientsForList', () => {
  const anna = client('Anna');
  const bruno = client('bruno');
  const zeta = client('Zeta');
  const eva = client('Èva');

  it('ordina alfabeticamente in italiano, senza distinguere maiuscole e accenti', () => {
    expect(orderClientsForList([zeta, eva, bruno, anna], null).map((c) => c.name)).toEqual(['Anna', 'bruno', 'Èva', 'Zeta']);
  });

  it('mette in cima il cliente presso cui ci si trova', () => {
    expect(orderClientsForList([anna, bruno, zeta], zeta).map((c) => c.name)).toEqual(['Zeta', 'Anna', 'bruno']);
  });

  it('non modifica la lista originale', () => {
    const original = [zeta, anna];
    orderClientsForList(original, null);
    expect(original).toEqual([zeta, anna]);
  });
});
