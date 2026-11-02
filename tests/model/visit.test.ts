import { describe, expect, it } from 'vitest';
import {
  type Visit,
  endVisit,
  parseVisit,
  startVisit,
  visitDurationMinutes,
  visitStorageLocation,
} from '../../src/model/visit';

const closedVisit: Visit = {
  schemaVersion: 1,
  id: 'v-1',
  clientId: 'c-1',
  checkIn: {
    at: '2026-10-30T09:15:00+01:00',
    position: { latitude: 45.4642, longitude: 9.19, accuracyMeters: 12 },
  },
  checkOut: { at: '2026-10-30T11:40:00+01:00', position: null },
  note: 'Potatura siepe lato strada',
  audio: [],
  device: null,
};

describe('parseVisit', () => {
  it('sopravvive al round-trip JSON', () => {
    expect(parseVisit(JSON.parse(JSON.stringify(closedVisit)))).toStrictEqual(closedVisit);
  });

  it('accetta una visita in corso', () => {
    const openVisit = { ...closedVisit, checkOut: null, note: '' };
    expect(parseVisit(openVisit)).toStrictEqual(openVisit);
  });

  it('confronta gli orari tenendo conto del fuso', () => {
    // 10:00Z equivale alle 11:00+01:00: check-out dopo il check-in nonostante l'ora "scritta" minore.
    const visit = {
      ...closedVisit,
      checkIn: { at: '2026-10-30T10:30:00+01:00', position: null },
      checkOut: { at: '2026-10-30T10:00:00Z', position: null },
    };
    expect(parseVisit(visit)).toStrictEqual(visit);
  });

  it('rifiuta un check-out precedente al check-in', () => {
    const visit = { ...closedVisit, checkOut: { at: '2026-10-30T09:00:00+01:00', position: null } };
    expect(() => parseVisit(visit)).toThrow('visita.checkOut.at: check-out precedente al check-in');
  });

  it('rifiuta una precisione GPS negativa', () => {
    const visit = {
      ...closedVisit,
      checkIn: { ...closedVisit.checkIn, position: { latitude: 45, longitude: 9, accuracyMeters: -1 } },
    };
    expect(() => parseVisit(visit)).toThrow('visita.checkIn.position.accuracyMeters');
  });

  it('richiede la nota anche se vuota', () => {
    const withoutNote: Partial<Visit> = { ...closedVisit };
    delete withoutNote.note;
    expect(() => parseVisit(withoutNote)).toThrow('visita.note: attesa una stringa');
  });
});

describe('cliente facoltativo', () => {
  it('accetta una visita senza cliente', () => {
    const withoutClient = { ...closedVisit, clientId: null };
    expect(parseVisit(withoutClient)).toStrictEqual(withoutClient);
  });

  it('rifiuta un clientId vuoto', () => {
    expect(() => parseVisit({ ...closedVisit, clientId: '' })).toThrow('visita.clientId: stringa vuota');
  });
});

describe('startVisit / endVisit', () => {
  it('apre una visita senza cliente né posizione', () => {
    const visit = startVisit('2026-10-31T08:00:00+01:00', null);
    expect(visit).toMatchObject({
      schemaVersion: 1,
      clientId: null,
      checkIn: { at: '2026-10-31T08:00:00+01:00', position: null },
      checkOut: null,
      note: '',
      audio: [],
      device: null,
    });
    expect(visit.id).not.toBe(startVisit('2026-10-31T08:00:00+01:00', null).id);
  });

  it('chiude la visita conservando il resto', () => {
    const open = { ...startVisit('2026-10-31T08:00:00+01:00', null), clientId: 'c-1' };
    expect(endVisit(open, '2026-10-31T10:30:00+01:00')).toStrictEqual({
      ...open,
      checkOut: { at: '2026-10-31T10:30:00+01:00', position: null },
    });
  });

  it('rifiuta di chiudere due volte o prima del check-in', () => {
    expect(() => endVisit(closedVisit, '2026-10-30T12:00:00+01:00')).toThrow('visita già chiusa');
    const open = startVisit('2026-10-31T08:00:00+01:00', null);
    expect(() => endVisit(open, '2026-10-31T07:59:00+01:00')).toThrow('check-out precedente al check-in');
  });

  it('rifiuta un orario senza fuso', () => {
    expect(() => startVisit('2026-10-31T08:00:00', null)).toThrow('visita.checkIn.at');
  });
});

describe('visitStorageLocation', () => {
  it('usa la data locale del check-in anche quando in UTC sarebbe il giorno prima', () => {
    // 00:30 a Roma (+01:00) corrisponde alle 23:30 UTC del 31 dicembre: conta il giorno locale.
    const visit = { ...closedVisit, id: 'v-7', checkIn: { at: '2027-01-01T00:30:00+01:00', position: null }, checkOut: null };
    expect(visitStorageLocation(visit)).toEqual({ year: '2027', fileName: '2027-01-01_v-7.json' });
  });
});

describe('visitDurationMinutes', () => {
  const at = (checkIn: string, checkOut: string | null): Visit => ({
    ...closedVisit,
    checkIn: { at: checkIn, position: null },
    checkOut: checkOut ? { at: checkOut, position: null } : null,
  });

  it('è null per una visita in corso', () => {
    expect(visitDurationMinutes(at('2026-10-31T09:00:00+01:00', null))).toBeNull();
  });

  it.each([
    ['2026-10-31T09:00:00+01:00', '2026-10-31T11:30:00+01:00', 150],
    ['2026-10-31T09:00:00+01:00', '2026-10-31T09:00:29+01:00', 0],
    ['2026-10-31T09:00:00+01:00', '2026-10-31T09:00:30+01:00', 1],
    // Stessa ora "di orologio" ma fusi diversi (cambio dell'ora legale): conta il tempo reale.
    ['2026-10-25T01:30:00+02:00', '2026-10-25T02:30:00+01:00', 120],
  ])('da %s a %s → %i minuti', (checkIn, checkOut, minutes) => {
    expect(visitDurationMinutes(at(checkIn, checkOut))).toBe(minutes);
  });
});

describe('note audio', () => {
  const note = {
    id: 'a-1',
    recordedAt: '2026-10-30T09:30:00+01:00',
    mimeType: 'audio/mp4',
    durationSeconds: 42.5,
    driveFileId: null,
    driveLink: null,
    device: null,
    position: null,
  };

  it('una visita salvata prima del nome dispositivo (senza campo) ha device null', () => {
    const legacy: Partial<Visit> = { ...closedVisit };
    delete legacy.device;
    expect(parseVisit(legacy).device).toBeNull();
    expect(parseVisit({ ...closedVisit, device: 'iPhone' }).device).toBe('iPhone');
    expect(() => parseVisit({ ...closedVisit, device: '' })).toThrow('visita.device');
  });

  it('una visita salvata prima dell’audio (senza campo) vale “nessuna nota”', () => {
    const legacy: Partial<Visit> = { ...closedVisit };
    delete legacy.audio;
    expect(parseVisit(legacy).audio).toEqual([]);
  });

  it('conserva le note audio nel round-trip JSON', () => {
    const withAudio = { ...closedVisit, audio: [note, { ...note, id: 'a-2', driveFileId: 'drive-1' }] };
    expect(parseVisit(JSON.parse(JSON.stringify(withAudio)))).toStrictEqual(withAudio);
  });

  it('una nota salvata prima della posizione (senza campo) ha position null, e la posizione si conserva', () => {
    const legacyNote: Partial<typeof note> = { ...note };
    delete legacyNote.position;
    expect(parseVisit({ ...closedVisit, audio: [legacyNote] }).audio[0]?.position).toBeNull();
    const located = { ...note, position: { latitude: 45.46, longitude: 9.19, accuracyMeters: 8 } };
    expect(parseVisit(JSON.parse(JSON.stringify({ ...closedVisit, audio: [located] }))).audio[0]).toEqual(located);
  });

  it('una nota salvata prima del caricamento (senza driveLink) ha link null', () => {
    const legacyNote: Partial<typeof note> = { ...note };
    delete legacyNote.driveLink;
    expect(parseVisit({ ...closedVisit, audio: [legacyNote] }).audio[0]?.driveLink).toBeNull();
  });

  it('rifiuta durate negative e id duplicati', () => {
    expect(() => parseVisit({ ...closedVisit, audio: [{ ...note, durationSeconds: -1 }] })).toThrow(
      'visita.audio[0].durationSeconds',
    );
    expect(() => parseVisit({ ...closedVisit, audio: [note, note] })).toThrow('id duplicato "a-1"');
  });
});
