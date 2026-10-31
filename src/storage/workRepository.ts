import { SCHEMA_VERSION } from '../model/validation';
import { type WorkDayDocument, type WorkPeriod, parseWorkDayDocument, parseWorkPeriod, workPeriodDate } from '../model/work';
import type { DriveClient } from './drive';
import { ROOT_FOLDER, WORK_FOLDER } from './layout';

type WorkDrive = Pick<DriveClient, 'ensureFolderPath' | 'findFile' | 'readJson' | 'writeJson'>;

/** Un file per giorno, `TempoMax/lavoro/AAAA/AAAA-MM-GG.json`, con tutti i periodi iniziati quel giorno. */
export class WorkRepository {
  constructor(private readonly drive: WorkDrive) {}

  /** Inserisce o aggiorna il periodo nel file del suo giorno (lettura, modifica, scrittura). */
  async save(period: WorkPeriod): Promise<void> {
    parseWorkPeriod(period, 'periodo');
    const date = workPeriodDate(period);
    const folderId = await this.drive.ensureFolderPath([ROOT_FOLDER, WORK_FOLDER, date.slice(0, 4)]);
    const fileName = `${date}.json`;
    const existingId = await this.drive.findFile(fileName, folderId);
    const existing: WorkDayDocument = existingId
      ? parseWorkDayDocument(await this.drive.readJson(existingId))
      : { schemaVersion: SCHEMA_VERSION, date, periods: [] };
    const periods = existing.periods.some((current) => current.id === period.id)
      ? existing.periods.map((current) => (current.id === period.id ? period : current))
      : [...existing.periods, period];
    const document: WorkDayDocument = { ...existing, periods: periods.sort((a, b) => a.start.localeCompare(b.start)) };
    await this.drive.writeJson(fileName, folderId, parseWorkDayDocument(document));
  }
}
