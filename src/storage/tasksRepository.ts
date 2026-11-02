import { type Task, type TasksDocument, parseTasksDocument } from '../model/task';
import { SCHEMA_VERSION } from '../model/validation';
import type { DriveClient } from './drive';
import { ROOT_FOLDER, TASKS_FILE } from './layout';

type TasksDrive = Pick<DriveClient, 'ensureFolderPath' | 'findFile' | 'readJson' | 'writeJson'>;

/**
 * Unione fra Drive e telefono: le attività cambiate sul telefono e non ancora salvate vincono,
 * per le altre vale Drive (possono essere state modificate da un altro dispositivo). Nessuna va persa.
 */
export function mergeTasks(remote: readonly Task[], local: readonly Task[], unsyncedIds: readonly string[]): Task[] {
  const unsynced = new Set(unsyncedIds);
  const merged = new Map(local.map((task) => [task.id, task]));
  for (const task of remote) {
    if (!unsynced.has(task.id)) {
      merged.set(task.id, task);
    }
  }
  return [...merged.values()];
}

/** `TempoMax/task.json`: tutte le attività "da fare" in un solo file. */
export class TasksRepository {
  constructor(private readonly drive: TasksDrive) {}

  async load(): Promise<Task[]> {
    const folderId = await this.drive.ensureFolderPath([ROOT_FOLDER]);
    const fileId = await this.drive.findFile(TASKS_FILE, folderId);
    return fileId ? parseTasksDocument(await this.drive.readJson(fileId)).tasks : [];
  }

  async saveAll(tasks: readonly Task[]): Promise<void> {
    const document: TasksDocument = { schemaVersion: SCHEMA_VERSION, tasks: [...tasks] };
    const folderId = await this.drive.ensureFolderPath([ROOT_FOLDER]);
    await this.drive.writeJson(TASKS_FILE, folderId, parseTasksDocument(document));
  }
}
