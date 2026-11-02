import { LOCAL_STORAGE_PREFIX } from '../config';
import { type Task, parseTask } from '../model/task';
import { ValidationError, expectArray, expectNonEmptyString, expectObject, expectUniqueIds } from '../model/validation';

const STORAGE_KEY = `${LOCAL_STORAGE_PREFIX}.tasks`;

/** Sul telefono: tutte le attività note (anche offline) e gli id di quelle cambiate e non ancora su Drive. */
export interface LocalTaskState {
  tasks: Task[];
  unsyncedIds: string[];
}

export const EMPTY_LOCAL_TASK_STATE: LocalTaskState = { tasks: [], unsyncedIds: [] };

function parseLocalTaskState(value: unknown): LocalTaskState {
  const object = expectObject(value, 'attivitàLocali');
  const tasks = expectArray(object.tasks, 'attivitàLocali.tasks').map((task, index) =>
    parseTask(task, `attivitàLocali.tasks[${index}]`),
  );
  expectUniqueIds(tasks, 'attivitàLocali.tasks');
  const known = new Set(tasks.map((task) => task.id));
  const unsyncedIds = expectArray(object.unsyncedIds, 'attivitàLocali.unsyncedIds').map((id, index) => {
    const path = `attivitàLocali.unsyncedIds[${index}]`;
    const text = expectNonEmptyString(id, path);
    if (!known.has(text)) {
      throw new ValidationError(path, `attività sconosciuta "${text}"`);
    }
    return text;
  });
  return { tasks, unsyncedIds: [...new Set(unsyncedIds)] };
}

export class LocalTaskStore {
  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'>) {}

  /** Lancia `ValidationError` se il contenuto è corrotto, invece di perdere attività in silenzio. */
  load(): LocalTaskState {
    const raw = this.storage.getItem(STORAGE_KEY);
    return raw === null ? EMPTY_LOCAL_TASK_STATE : parseLocalTaskState(JSON.parse(raw));
  }

  save(state: LocalTaskState): void {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(parseLocalTaskState(state)));
  }
}
