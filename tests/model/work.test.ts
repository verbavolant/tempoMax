import { describe, expect, it } from 'vitest';
import {
  type WorkPeriod,
  endWorkPeriod,
  parseWorkDayDocument,
  startWorkPeriod,
  workPeriodDate,
  workedMilliseconds,
} from '../../src/model/work';

const period = (id: string, start: string, end: string | null): WorkPeriod => ({ id, start, end });

describe('startWorkPeriod / endWorkPeriod', () => {
  it('apre un periodo senza fine e lo chiude', () => {
    const open = startWorkPeriod('2026-10-31T07:30:00+01:00');
    expect(open).toMatchObject({ start: '2026-10-31T07:30:00+01:00', end: null });
    expect(endWorkPeriod(open, '2026-10-31T12:30:00+01:00')).toEqual({ ...open, end: '2026-10-31T12:30:00+01:00' });
  });

  it('rifiuta di chiudere due volte o prima dell’inizio', () => {
    const open = startWorkPeriod('2026-10-31T07:30:00+01:00');
    expect(() => endWorkPeriod(open, '2026-10-31T07:00:00+01:00')).toThrow('fine precedente all’inizio');
    const closed = endWorkPeriod(open, '2026-10-31T12:30:00+01:00');
    expect(() => endWorkPeriod(closed, '2026-10-31T13:00:00+01:00')).toThrow('periodo già chiuso');
  });

  it('il giorno del periodo è quello di inizio, anche oltre mezzanotte', () => {
    expect(workPeriodDate(period('p', '2026-10-31T22:00:00+01:00', '2026-11-01T01:00:00+01:00'))).toBe('2026-10-31');
  });
});

describe('workedMilliseconds', () => {
  const hour = 3_600_000;
  const periods = [
    period('mattina', '2026-10-31T07:30:00+01:00', '2026-10-31T12:30:00+01:00'),
    period('pomeriggio', '2026-10-31T13:30:00+01:00', null),
    period('ieri', '2026-10-30T08:00:00+01:00', '2026-10-30T17:00:00+01:00'),
  ];

  it('somma i periodi del giorno, quello in corso fino a adesso, escludendo la pausa', () => {
    const now = Date.parse('2026-10-31T15:00:00+01:00');
    expect(workedMilliseconds(periods, '2026-10-31', now)).toBe(5 * hour + 1.5 * hour);
  });

  it('ignora gli altri giorni', () => {
    expect(workedMilliseconds(periods, '2026-10-30', 0)).toBe(9 * hour);
    expect(workedMilliseconds(periods, '2026-11-01', 0)).toBe(0);
  });
});

describe('parseWorkDayDocument', () => {
  const document = {
    schemaVersion: 1,
    date: '2026-10-31',
    periods: [period('a', '2026-10-31T07:30:00+01:00', '2026-10-31T12:30:00+01:00')],
  };

  it('sopravvive al round-trip JSON', () => {
    expect(parseWorkDayDocument(JSON.parse(JSON.stringify(document)))).toEqual(document);
  });

  it('rifiuta periodi di un altro giorno e date inesistenti', () => {
    expect(() =>
      parseWorkDayDocument({ ...document, periods: [period('b', '2026-10-30T07:30:00+01:00', null)] }),
    ).toThrow('periodo di un altro giorno');
    expect(() => parseWorkDayDocument({ ...document, date: '2026-02-30', periods: [] })).toThrow(
      'data inesistente nel calendario',
    );
  });
});
