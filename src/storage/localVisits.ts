import { LOCAL_STORAGE_PREFIX } from '../config';
import { type AudioNote, type Visit, parseAudioNote, parseVisit } from '../model/visit';
import { expectArray, expectObject, expectUniqueIds, nullable } from '../model/validation';

const STORAGE_KEY = `${LOCAL_STORAGE_PREFIX}.visits`;

/**
 * Ciò che vive sul telefono: la visita in corso, le visite non ancora confermate da Drive
 * e le note libere (registrate senza visita) non ancora caricate.
 */
export interface LocalVisitState {
  openVisit: Visit | null;
  unsyncedVisits: Visit[];
  freeNotes: AudioNote[];
}

export const EMPTY_LOCAL_VISIT_STATE: LocalVisitState = { openVisit: null, unsyncedVisits: [], freeNotes: [] };

function parseLocalVisitState(value: unknown): LocalVisitState {
  const object = expectObject(value, 'locale');
  const unsyncedVisits = expectArray(object.unsyncedVisits, 'locale.unsyncedVisits').map(parseVisit);
  expectUniqueIds(unsyncedVisits, 'locale.unsyncedVisits');
  // Campo aggiunto con le note libere (T-028a): i dati salvati prima non lo hanno.
  const freeNotes =
    object.freeNotes === undefined
      ? []
      : expectArray(object.freeNotes, 'locale.freeNotes').map((note, index) =>
          parseAudioNote(note, `locale.freeNotes[${index}]`),
        );
  expectUniqueIds(freeNotes, 'locale.freeNotes');
  return { openVisit: nullable(object.openVisit, parseVisit), unsyncedVisits, freeNotes };
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
