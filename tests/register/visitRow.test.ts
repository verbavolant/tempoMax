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
  device: null,
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
      '',
      '',
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
      '',
      '',
    ]);
  });

  it('senza cliente né posizioni lascia le celle vuote', () => {
    const bare: Visit = {
      ...closed,
      clientId: null,
      checkIn: { ...closed.checkIn, position: null },
      checkOut: { at: '2026-10-31T09:05:40+01:00', position: null },
    };
    expect(visitToRow(bare, null)).toEqual(['31/10/2026', '09:05', '09:05', 1, '', '', '', 'v-1', '', '']);
  });

  it("l'ID è nella colonna indicata da REGISTER_ID_COLUMN_INDEX", () => {
    expect(REGISTER_HEADER[REGISTER_ID_COLUMN_INDEX]).toBe('ID visita');
    expect(visitToRow(closed, null)[REGISTER_ID_COLUMN_INDEX]).toBe('v-1');
    expect(visitToRow(closed, null)).toHaveLength(REGISTER_HEADER.length);
  });

  it('elenca nella colonna Audio i link delle note caricate, uno per riga', () => {
    const note = { id: 'a', recordedAt: '2026-10-31T09:10:00+01:00', mimeType: 'audio/mp4', durationSeconds: 5, device: null, position: null };
    const withAudio: Visit = {
      ...closed,
      audio: [
        { ...note, id: 'a-1', driveFileId: 'f-1', driveLink: 'https://drive.google.com/file/d/f-1/view' },
        { ...note, id: 'a-2', driveFileId: null, driveLink: null },
        { ...note, id: 'a-3', driveFileId: 'f-3', driveLink: 'https://drive.google.com/file/d/f-3/view' },
      ],
    };
    expect(visitToRow(withAudio, null).at(-2)).toBe(
      'https://drive.google.com/file/d/f-1/view\nhttps://drive.google.com/file/d/f-3/view',
    );
  });

  it("riporta nell'ultima colonna il dispositivo che ha registrato la visita", () => {
    expect(visitToRow({ ...closed, device: 'iPhone di Mario' }, null).at(-1)).toBe('iPhone di Mario');
    expect(REGISTER_HEADER.at(-1)).toBe('Dispositivo');
  });
});
