import { type WorkPeriod, parseWorkPeriod, workPeriodDate } from '../model/work';
import { ValidationError, expectArray, expectNonEmptyString, expectObject, expectUniqueIds } from '../model/validation';

const STORAGE_KEY = 'tempomax.work';

/**
 * Sul telefono: i periodi recenti (per il totale di oggi e il periodo in corso)
 * e gli id di quelli non ancora confermati da Drive.
 */
export interface LocalWorkState {
  periods: WorkPeriod[];
  unsyncedIds: string[];
}

export const EMPTY_LOCAL_WORK_STATE: LocalWorkState = { periods: [], unsyncedIds: [] };

function parseLocalWorkState(value: unknown): LocalWorkState {
  const object = expectObject(value, 'lavoroLocale');
  const periods = expectArray(object.periods, 'lavoroLocale.periods').map((period, index) =>
    parseWorkPeriod(period, `lavoroLocale.periods[${index}]`),
  );
  expectUniqueIds(periods, 'lavoroLocale.periods');
  const known = new Set(periods.map((period) => period.id));
  const unsyncedIds = expectArray(object.unsyncedIds, 'lavoroLocale.unsyncedIds').map((id, index) => {
    const path = `lavoroLocale.unsyncedIds[${index}]`;
    const text = expectNonEmptyString(id, path);
    if (!known.has(text)) {
      throw new ValidationError(path, `periodo sconosciuto "${text}"`);
    }
    return text;
  });
  return { periods, unsyncedIds: [...new Set(unsyncedIds)] };
}

/** Toglie i periodi chiusi, già su Drive e di giorni precedenti a `today`: non servono più sul telefono. */
export function pruneLocalWork(state: LocalWorkState, today: string): LocalWorkState {
  const unsynced = new Set(state.unsyncedIds);
  return {
    ...state,
    periods: state.periods.filter(
      (period) => !period.end || unsynced.has(period.id) || workPeriodDate(period) >= today,
    ),
  };
}

export class LocalWorkStore {
  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'>) {}

  /** Lancia `ValidationError` se il contenuto è corrotto, invece di perdere i periodi in silenzio. */
  load(): LocalWorkState {
    const raw = this.storage.getItem(STORAGE_KEY);
    return raw === null ? EMPTY_LOCAL_WORK_STATE : parseLocalWorkState(JSON.parse(raw));
  }

  save(state: LocalWorkState): void {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(parseLocalWorkState(state)));
  }
}
