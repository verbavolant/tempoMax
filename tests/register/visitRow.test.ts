import { describe, expect, it } from 'vitest';
import type { Visit } from '../../src/model/visit';
import { REGISTER_HEADER, REGISTER_ID_COLUMN_INDEX, visitToRow } from '../../src/register/visitRow';

const position = (latitude: number, longitude: number) => ({ latitude, longitude, accuracyMeters: 10 });

const closed: Visit = {
  schemaVersion: 1,
  id: 'v-1',
  clientId: 'c-1',
  checkIn: { at: '2026-10-31T09:05:00+01:00', position: position(45.4642, 9.19) },
  checkOut: { at: '2026-10-31T11:35:29+01:00', position: position(45.4643, 9.1901) },
  note: '',
  audio: [],
};

describe('visitToRow', () => {
  it('compila tutte le colonne di una visita chiusa', () => {
    expect(visitToRow(closed, 'Villa Rossi')).toEqual([
      '31/10/2026',
      '09:05',
      '11:35',
      150,
      'Villa Rossi',
      'https://www.google.com/maps/search/?api=1&query=45.4642%2C9.19',
      'https://www.google.com/maps/search/?api=1&query=45.4643%2C9.1901',
      'v-1',
    ]);
  });

  it('lascia vuote fine, durata e mappa finale per una visita in corso', () => {
    expect(visitToRow({ ...closed, checkOut: null }, 'Villa Rossi')).toEqual([
      '31/10/2026',
      '09:05',
      '',
      '',
      'Villa Rossi',
      'https://www.google.com/maps/search/?api=1&query=45.4642%2C9.19',
      '',
      'v-1',
    ]);
  });

  it('senza cliente né posizioni lascia le celle vuote', () => {
    const bare: Visit = {
      ...closed,
      clientId: null,
      checkIn: { ...closed.checkIn, position: null },
      checkOut: { at: '2026-10-31T09:05:40+01:00', position: null },
    };
    expect(visitToRow(bare, null)).toEqual(['31/10/2026', '09:05', '09:05', 1, '', '', '', 'v-1']);
  });

  it("l'ID è nella colonna indicata da REGISTER_ID_COLUMN_INDEX", () => {
    expect(REGISTER_HEADER[REGISTER_ID_COLUMN_INDEX]).toBe('ID visita');
    expect(visitToRow(closed, null)[REGISTER_ID_COLUMN_INDEX]).toBe('v-1');
    expect(visitToRow(closed, null)).toHaveLength(REGISTER_HEADER.length);
  });
});
