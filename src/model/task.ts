import {
  SCHEMA_VERSION,
  expectArray,
  expectIsoDateTime,
  expectLiteral,
  expectNonEmptyString,
  expectObject,
  expectSchemaVersion,
  expectUniqueIds,
  nullable,
} from './validation';

export const TASK_KINDS = ['todo', 'purchase'] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

export interface Task {
  id: string;
  kind: TaskKind;
  clientId: string;
  /** Visita in cui è stato annotato; null se aggiunto fuori da una visita. */
  originVisitId: string | null;
  text: string;
  createdAt: string;
  /** null finché il task è aperto. */
  completedAt: string | null;
}

/** Contenuto di `task.json` su Drive. */
export interface TasksDocument {
  schemaVersion: typeof SCHEMA_VERSION;
  tasks: Task[];
}

export function parseTask(value: unknown, path: string): Task {
  const object = expectObject(value, path);
  return {
    id: expectNonEmptyString(object.id, `${path}.id`),
    kind: expectLiteral(object.kind, `${path}.kind`, TASK_KINDS),
    clientId: expectNonEmptyString(object.clientId, `${path}.clientId`),
    originVisitId: nullable(object.originVisitId, (present) => expectNonEmptyString(present, `${path}.originVisitId`)),
    text: expectNonEmptyString(object.text, `${path}.text`),
    createdAt: expectIsoDateTime(object.createdAt, `${path}.createdAt`),
    completedAt: nullable(object.completedAt, (present) => expectIsoDateTime(present, `${path}.completedAt`)),
  };
}

export function parseTasksDocument(value: unknown): TasksDocument {
  const object = expectObject(value, 'task');
  const schemaVersion = expectSchemaVersion(object.schemaVersion, 'task.schemaVersion');
  const tasks = expectArray(object.tasks, 'task.tasks').map((item, index) => parseTask(item, `task.tasks[${index}]`));
  expectUniqueIds(tasks, 'task.tasks');
  return { schemaVersion, tasks };
}
