import { roundedMinutesBetween } from '../model/time';
import type { WorkPeriod } from '../model/work';
import { clockTime, italianDate } from './visitRow';

export const WORK_REGISTER_HEADER = ['Data', 'Inizio', 'Fine', 'Durata (min)', 'ID periodo'] as const;

export const WORK_REGISTER_ID_COLUMN_INDEX = WORK_REGISTER_HEADER.indexOf('ID periodo');

export type WorkRegisterRow = [string, string, string, number | '', string];

/** Una riga per periodo; la data è quella di inizio (anche se il periodo finisce dopo mezzanotte). */
export function workPeriodToRow(period: WorkPeriod): WorkRegisterRow {
  return [
    italianDate(period.start),
    clockTime(period.start),
    period.end ? clockTime(period.end) : '',
    period.end ? roundedMinutesBetween(period.start, period.end) : '',
    period.id,
  ];
}
