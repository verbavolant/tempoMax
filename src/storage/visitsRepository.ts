import { type Visit, parseVisit, visitStorageLocation } from '../model/visit';
import type { DriveClient } from './drive';
import { ROOT_FOLDER, VISITS_FOLDER } from './layout';

type VisitsDrive = Pick<DriveClient, 'ensureFolderPath' | 'writeJson'>;

/** Un file per visita: risalvare la stessa visita ne sostituisce il contenuto (`writeJson` cerca per nome). */
export class VisitsRepository {
  constructor(private readonly drive: VisitsDrive) {}

  async save(visit: Visit): Promise<void> {
    parseVisit(visit);
    const { year, fileName } = visitStorageLocation(visit);
    const folderId = await this.drive.ensureFolderPath([ROOT_FOLDER, VISITS_FOLDER, year]);
    await this.drive.writeJson(fileName, folderId, visit);
  }
}
