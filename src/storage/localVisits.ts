import { type Visit, parseVisit } from '../model/visit';
import { expectArray, expectObject, expectUniqueIds, nullable } from '../model/validation';

const STORAGE_KEY = 'tempomax.visits';

/** Ciò che vive sul telefono: la visita in corso e le visite non ancora confermate da Drive. */
export interface LocalVisitState {
  openVisit: Visit | null;
  unsyncedVisits: Visit[];
}

export const EMPTY_LOCAL_VISIT_STATE: LocalVisitState = { openVisit: null, unsyncedVisits: [] };

function parseLocalVisitState(value: unknown): LocalVisitState {
  const object = expectObject(value, 'locale');
  const unsyncedVisits = expectArray(object.unsyncedVisits, 'locale.unsyncedVisits').map(parseVisit);
  expectUniqueIds(unsyncedVisits, 'locale.unsyncedVisits');
  return { openVisit: nullable(object.openVisit, parseVisit), unsyncedVisits };
}

/** Sostituisce la visita con lo stesso id o la aggiunge in coda. */
export function upsertVisit(visits: readonly Visit[], visit: Visit): Visit[] {
  return visits.some((existing) => existing.id === visit.id)
    ? visits.map((existing) => (existing.id === visit.id ? visit : existing))
    : [...visits, visit];
}

export class LocalVisitStore {
  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'>) {}

  /** Lancia `ValidationError` se il contenuto è corrotto: meglio un errore visibile che perdere visite in silenzio. */
  load(): LocalVisitState {
    const raw = this.storage.getItem(STORAGE_KEY);
    return raw === null ? EMPTY_LOCAL_VISIT_STATE : parseLocalVisitState(JSON.parse(raw));
  }

  save(state: LocalVisitState): void {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(parseLocalVisitState(state)));
  }
}
