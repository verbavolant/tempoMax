import type { Task } from '../model/task';
import { TASK_REGISTER_HEADER, TASK_REGISTER_ID_COLUMN_INDEX, taskToRow } from '../register/taskRow';
import { TASKS_REGISTER_FILE } from './layout';
import { SheetRegister } from './sheetRegister';

/** Foglio Google `TempoMax/Da fare`: una riga per attività. */
export class TaskRegister {
  private readonly sheet: SheetRegister;

  constructor(drive: ConstructorParameters<typeof SheetRegister>[0]) {
    this.sheet = new SheetRegister(drive, {
      fileName: TASKS_REGISTER_FILE,
      header: TASK_REGISTER_HEADER,
      idColumnIndex: TASK_REGISTER_ID_COLUMN_INDEX,
    });
  }

  save(task: Task, clientName: string | null): Promise<void> {
    return this.sheet.saveRow(task.id, taskToRow(task, clientName));
  }
}
