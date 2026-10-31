import type { WorkPeriod } from '../model/work';
import { WORK_REGISTER_HEADER, WORK_REGISTER_ID_COLUMN_INDEX, workPeriodToRow } from '../register/workRow';
import { WORK_REGISTER_FILE } from './layout';
import { SheetRegister } from './sheetRegister';

/** Foglio Google `TempoMax/Orario di lavoro`: una riga per periodo di lavoro. */
export class WorkRegister {
  private readonly sheet: SheetRegister;

  constructor(drive: ConstructorParameters<typeof SheetRegister>[0]) {
    this.sheet = new SheetRegister(drive, {
      fileName: WORK_REGISTER_FILE,
      header: WORK_REGISTER_HEADER,
      idColumnIndex: WORK_REGISTER_ID_COLUMN_INDEX,
    });
  }

  save(period: WorkPeriod): Promise<void> {
    return this.sheet.saveRow(period.id, workPeriodToRow(period));
  }
}
