import { describe, expect, it } from 'vitest';
import type { WorkPeriod } from '../../src/model/work';
import { EMPTY_LOCAL_WORK_STATE, LocalWorkStore, pruneLocalWork } from '../../src/storage/localWork';

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return { items, getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) };
}

const yesterday: WorkPeriod = { id: 'ieri', start: '2026-10-30T08:00:00+01:00', end: '2026-10-30T17:00:00+01:00', device: null };
const today: WorkPeriod = { id: 'oggi', start: '2026-10-31T07:30:00+01:00', end: null, device: null };

describe('LocalWorkStore', () => {
  it('senza dati restituisce lo stato vuoto e rilegge ciò che salva', () => {
    const storage = memoryStorage();
    expect(new LocalWorkStore(storage).load()).toEqual(EMPTY_LOCAL_WORK_STATE);
    const state = { periods: [yesterday, today], unsyncedIds: ['oggi'] };
    new LocalWorkStore(storage).save(state);
    expect(new LocalWorkStore(storage).load()).toEqual(state);
  });

  it('non salva id da sincronizzare che non corrispondono a un periodo', () => {
    const storage = memoryStorage();
    expect(() => new LocalWorkStore(storage).save({ periods: [today], unsyncedIds: ['fantasma'] })).toThrow(
      'periodo sconosciuto "fantasma"',
    );
    expect(storage.items.size).toBe(0);
  });
});

describe('pruneLocalWork', () => {
  it('toglie solo i periodi chiusi, già su Drive, dei giorni precedenti', () => {
    const notSyncedYesterday = { ...yesterday, id: 'ieri-non-salvato' };
    const openYesterday = { ...yesterday, id: 'ieri-aperto', end: null };
    const state = { periods: [yesterday, notSyncedYesterday, openYesterday, today], unsyncedIds: ['ieri-non-salvato'] };
    expect(pruneLocalWork(state, '2026-10-31').periods.map((period) => period.id)).toEqual([
      'ieri-non-salvato',
      'ieri-aperto',
      'oggi',
    ]);
  });
});
