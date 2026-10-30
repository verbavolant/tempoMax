import { describe, expect, it } from 'vitest';
import { type Visit, parseVisit } from '../../src/model/visit';

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
