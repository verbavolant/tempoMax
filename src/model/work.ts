import {
  SCHEMA_VERSION,
  ValidationError,
  expectArray,
  expectIsoDate,
  expectIsoDateTime,
  expectNonEmptyString,
  expectObject,
  expectOptionalNonEmptyString,
  expectSchemaVersion,
  expectUniqueIds,
  nullable,
} from './validation';

/** Un periodo di lavoro: da "Inizio lavoro" a "Fine lavoro". Una pausa è la fine di un periodo e l'inizio del successivo. */
export interface WorkPeriod {
  id: string;
  start: string;
  /** null finché si sta lavorando. */
  end: string | null;
  /** Nome del dispositivo che ha registrato il periodo (T-032); null se non indicato o nei dati vecchi. */
  device: string | null;
}

/** Contenuto di `lavoro/AAAA/AAAA-MM-GG.json` su Drive: i periodi iniziati in quel giorno. */
export interface WorkDayDocument {
  schemaVersion: typeof SCHEMA_VERSION;
  date: string;
  periods: WorkPeriod[];
}

/** Giorno (locale) del periodo: quello di inizio, anche se finisce dopo mezzanotte. */
export const workPeriodDate = (period: WorkPeriod) => period.start.slice(0, 10);

export function parseWorkPeriod(value: unknown, path: string): WorkPeriod {
  const object = expectObject(value, path);
  const period: WorkPeriod = {
    id: expectNonEmptyString(object.id, `${path}.id`),
    start: expectIsoDateTime(object.start, `${path}.start`),
    end: nullable(object.end, (present) => expectIsoDateTime(present, `${path}.end`)),
    device: expectOptionalNonEmptyString(object.device, `${path}.device`),
  };
  if (period.end && Date.parse(period.end) < Date.parse(period.start)) {
    throw new ValidationError(`${path}.end`, 'fine precedente all’inizio');
  }
  return period;
}

export function parseWorkDayDocument(value: unknown): WorkDayDocument {
  const object = expectObject(value, 'lavoro');
  const schemaVersion = expectSchemaVersion(object.schemaVersion, 'lavoro.schemaVersion');
  const date = expectIsoDate(object.date, 'lavoro.date');
  const periods = expectArray(object.periods, 'lavoro.periods').map((period, index) =>
    parseWorkPeriod(period, `lavoro.periods[${index}]`),
  );
  expectUniqueIds(periods, 'lavoro.periods');
  periods.forEach((period, index) => {
    if (workPeriodDate(period) !== date) {
      throw new ValidationError(`lavoro.periods[${index}].start`, `periodo di un altro giorno (atteso ${date})`);
    }
  });
  return { schemaVersion, date, periods };
}

export function startWorkPeriod(at: string, device: string | null): WorkPeriod {
  return parseWorkPeriod({ id: crypto.randomUUID(), start: at, end: null, device }, 'periodo');
}

export function endWorkPeriod(period: WorkPeriod, at: string): WorkPeriod {
  if (period.end) {
    throw new ValidationError('periodo.end', 'periodo già chiuso');
  }
  return parseWorkPeriod({ ...period, end: at }, 'periodo');
}

/** Millisecondi lavorati nei periodi iniziati nel giorno `date`; quello in corso conta fino a `now`. */
export function workedMilliseconds(periods: readonly WorkPeriod[], date: string, now: number): number {
  return periods
    .filter((period) => workPeriodDate(period) === date)
    .reduce((total, period) => {
      const end = period.end ? Date.parse(period.end) : now;
      return total + Math.max(0, end - Date.parse(period.start));
    }, 0);
}
