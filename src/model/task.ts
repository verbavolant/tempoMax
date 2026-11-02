import { type AudioNote, parseAudioNote } from './visit';
import {
  SCHEMA_VERSION,
  ValidationError,
  expectArray,
  expectIsoDate,
  expectIsoDateTime,
  expectLiteral,
  expectNonEmptyString,
  expectObject,
  expectOptionalNonEmptyString,
  expectSchemaVersion,
  expectString,
  expectUniqueIds,
  nullable,
} from './validation';

export const TASK_KINDS = ['todo', 'purchase'] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

/** Un'attività "da fare" (T-034): di solito una nota vocale, con una scadenza facoltativa. */
export interface Task {
  id: string;
  kind: TaskKind;
  createdAt: string;
  /** Giorno di scadenza `AAAA-MM-GG`; null = nessuna scadenza. */
  dueDate: string | null;
  /** null finché è da fare. */
  completedAt: string | null;
  /** Testo (può essere vuoto se c'è la nota vocale). */
  text: string;
  audio: AudioNote | null;
  /** Visita in corso quando è stata registrata, e il suo cliente; null se registrata fuori visita. */
  visitId: string | null;
  clientId: string | null;
  device: string | null;
}

/** Contenuto di `task.json` su Drive. */
export interface TasksDocument {
  schemaVersion: typeof SCHEMA_VERSION;
  tasks: Task[];
}

export function parseTask(value: unknown, path: string): Task {
  const object = expectObject(value, path);
  const task: Task = {
    id: expectNonEmptyString(object.id, `${path}.id`),
    kind: expectLiteral(object.kind, `${path}.kind`, TASK_KINDS),
    createdAt: expectIsoDateTime(object.createdAt, `${path}.createdAt`),
    dueDate: nullable(object.dueDate, (present) => expectIsoDate(present, `${path}.dueDate`)),
    completedAt: nullable(object.completedAt, (present) => expectIsoDateTime(present, `${path}.completedAt`)),
    text: expectString(object.text, `${path}.text`),
    audio: nullable(object.audio, (present) => parseAudioNote(present, `${path}.audio`)),
    visitId: expectOptionalNonEmptyString(object.visitId, `${path}.visitId`),
    clientId: expectOptionalNonEmptyString(object.clientId, `${path}.clientId`),
    device: expectOptionalNonEmptyString(object.device, `${path}.device`),
  };
  if (task.text.trim() === '' && !task.audio) {
    throw new ValidationError(path, 'serve un testo o una nota vocale');
  }
  return task;
}

export function parseTasksDocument(value: unknown): TasksDocument {
  const object = expectObject(value, 'task');
  const schemaVersion = expectSchemaVersion(object.schemaVersion, 'task.schemaVersion');
  const tasks = expectArray(object.tasks, 'task.tasks').map((item, index) => parseTask(item, `task.tasks[${index}]`));
  expectUniqueIds(tasks, 'task.tasks');
  return { schemaVersion, tasks };
}

export interface VoiceTaskInput {
  audio: AudioNote;
  createdAt: string;
  dueDate: string | null;
  visitId: string | null;
  clientId: string | null;
  device: string | null;
}

export function createVoiceTask(input: VoiceTaskInput): Task {
  // Campo per campo: proprietà estranee nell'input non possono sostituire id o stato.
  return parseTask(
    {
      id: crypto.randomUUID(),
      kind: 'todo',
      createdAt: input.createdAt,
      dueDate: input.dueDate,
      completedAt: null,
      text: '',
      audio: input.audio,
      visitId: input.visitId,
      clientId: input.clientId,
      device: input.device,
    },
    'attività',
  );
}

/** Ordine dell'elenco: prima le scadenze più vicine (scadute comprese), poi quelle senza scadenza; a parità, le più vecchie. */
export function compareOpenTasks(a: Task, b: Task): number {
  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  }
  return a.createdAt.localeCompare(b.createdAt);
}
