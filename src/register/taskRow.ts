import { googleMapsUrl } from '../geo/mapsLink';
import type { Task } from '../model/task';
import { clockTime, italianDate } from './visitRow';

// Le colonne nuove vanno in fondo, dopo l'ID: i fogli già esistenti restano coerenti.
export const TASK_REGISTER_HEADER = [
  'Creato',
  'Scadenza',
  'Stato',
  'Completato',
  'Cliente',
  'Audio',
  'Mappa',
  'Dispositivo',
  'ID attività',
] as const;

export const TASK_REGISTER_ID_COLUMN_INDEX = TASK_REGISTER_HEADER.indexOf('ID attività');

const dateTime = (at: string) => `${italianDate(at)} ${clockTime(at)}`;

export function taskToRow(task: Task, clientName: string | null): string[] {
  return [
    dateTime(task.createdAt),
    task.dueDate ? italianDate(task.dueDate) : '',
    task.completedAt ? 'Fatto' : 'Da fare',
    task.completedAt ? dateTime(task.completedAt) : '',
    clientName ?? '',
    task.audio?.driveLink ?? '',
    task.audio?.position ? googleMapsUrl(task.audio.position) : '',
    task.device ?? '',
    task.id,
  ];
}
