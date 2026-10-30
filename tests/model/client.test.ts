import { describe, expect, it } from 'vitest';
import { type ClientsDocument, parseClientsDocument } from '../../src/model/client';

const completeDocument: ClientsDocument = {
  schemaVersion: 1,
  clients: [
    {
      id: 'c-1',
      name: 'Villa Rossi',
      address: 'Via dei Tigli 4',
      location: { latitude: 45.4642, longitude: 9.19 },
      radiusMeters: 150,
      notes: 'Cancello sul retro',
      createdAt: '2026-10-30T09:00:00+01:00',
    },
    {
      id: 'c-2',
      name: 'Condominio Verde',
      radiusMeters: 200,
      createdAt: '2026-10-30T10:00:00+01:00',
    },
  ],
};

describe('parseClientsDocument', () => {
  it('sopravvive al round-trip JSON senza aggiungere campi', () => {
    const parsed = parseClientsDocument(JSON.parse(JSON.stringify(completeDocument)));
    expect(parsed).toStrictEqual(completeDocument);
    expect(Object.keys(parsed.clients[1] ?? {})).toEqual(['id', 'name', 'radiusMeters', 'createdAt']);
  });

  it('controlla prima la versione dello schema', () => {
    expect(() => parseClientsDocument({ schemaVersion: 2, clients: 'non valido' })).toThrow(
      'clienti.schemaVersion: atteso uno tra 1',
    );
  });

  it('indica il percorso del campo non valido', () => {
    const invalid = structuredClone(completeDocument);
    invalid.clients[0]!.location = { latitude: 91, longitude: 9.19 };
    expect(() => parseClientsDocument(invalid)).toThrow('clienti.clients[0].location.latitude');
  });

  it('rifiuta un nome vuoto', () => {
    const invalid = structuredClone(completeDocument);
    invalid.clients[1]!.name = '   ';
    expect(() => parseClientsDocument(invalid)).toThrow('clienti.clients[1].name: stringa vuota');
  });

  it('rifiuta un raggio nullo', () => {
    const invalid = structuredClone(completeDocument);
    invalid.clients[1]!.radiusMeters = 0;
    expect(() => parseClientsDocument(invalid)).toThrow('clienti.clients[1].radiusMeters');
  });

  it('rifiuta id duplicati', () => {
    const invalid = structuredClone(completeDocument);
    invalid.clients[1]!.id = 'c-1';
    expect(() => parseClientsDocument(invalid)).toThrow('id duplicato "c-1"');
  });
});
