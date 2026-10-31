import { describe, expect, it } from 'vitest';
import { type Visit, startVisit } from '../../src/model/visit';
import { ValidationError } from '../../src/model/validation';
import { EMPTY_LOCAL_VISIT_STATE, LocalVisitStore, upsertVisit } from '../../src/storage/localVisits';

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}

const open: Visit = startVisit('2026-10-31T08:00:00+01:00');
const closed: Visit = {
  ...startVisit('2026-10-30T08:00:00+01:00'),
  checkOut: { at: '2026-10-30T09:00:00+01:00', position: null },
};

describe('LocalVisitStore', () => {
  it('senza dati salvati restituisce lo stato vuoto', () => {
    expect(new LocalVisitStore(memoryStorage()).load()).toEqual(EMPTY_LOCAL_VISIT_STATE);
  });

  it('salva e rilegge visita aperta e visite da sincronizzare', () => {
    const storage = memoryStorage();
    const state = { openVisit: open, unsyncedVisits: [closed] };
    new LocalVisitStore(storage).save(state);
    expect(new LocalVisitStore(storage).load()).toEqual(state);
  });

  it('segnala un contenuto corrotto invece di ripartire da zero', () => {
    const storage = memoryStorage({ 'tempomax.visits': JSON.stringify({ openVisit: { id: 'x' }, unsyncedVisits: [] }) });
    expect(() => new LocalVisitStore(storage).load()).toThrow(ValidationError);
  });

  it('non salva uno stato non valido', () => {
    const storage = memoryStorage();
    expect(() => new LocalVisitStore(storage).save({ openVisit: null, unsyncedVisits: [closed, closed] })).toThrow(
      'id duplicato',
    );
    expect(storage.items.size).toBe(0);
  });
});

describe('upsertVisit', () => {
  it('aggiunge una visita nuova in coda', () => {
    expect(upsertVisit([closed], open)).toEqual([closed, open]);
  });

  it('sostituisce la visita con lo stesso id', () => {
    const updated = { ...closed, clientId: 'c-1' };
    expect(upsertVisit([open, closed], updated)).toEqual([open, updated]);
  });
});
