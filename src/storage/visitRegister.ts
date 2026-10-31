import type { Visit } from '../model/visit';
import { REGISTER_HEADER, REGISTER_ID_COLUMN_INDEX, visitToRow } from '../register/visitRow';
import { REGISTER_FILE } from './layout';
import { SheetRegister } from './sheetRegister';

/** Foglio Google `TempoMax/Registro visite`: una riga per visita. */
export class VisitRegister {
  private readonly sheet: SheetRegister;

  constructor(drive: ConstructorParameters<typeof SheetRegister>[0]) {
    this.sheet = new SheetRegister(drive, {
      fileName: REGISTER_FILE,
      header: REGISTER_HEADER,
      idColumnIndex: REGISTER_ID_COLUMN_INDEX,
    });
  }

  save(visit: Visit, clientName: string | null): Promise<void> {
    return this.sheet.saveRow(visit.id, visitToRow(visit, clientName));
  }
}
