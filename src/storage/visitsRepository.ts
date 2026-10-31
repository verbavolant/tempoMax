import { type Visit, parseVisit, visitStorageLocation } from '../model/visit';
import type { DriveClient } from './drive';
import { ROOT_FOLDER, VISITS_FOLDER } from './layout';

type VisitsDrive = Pick<DriveClient, 'ensureFolderPath' | 'writeJson' | 'listFiles' | 'readJson'>;

/** Un file per visita: risalvare la stessa visita ne sostituisce il contenuto (`writeJson` cerca per nome). */
export class VisitsRepository {
  constructor(private readonly drive: VisitsDrive) {}

  async save(visit: Visit): Promise<void> {
    parseVisit(visit);
    const { year, fileName } = visitStorageLocation(visit);
    const folderId = await this.drive.ensureFolderPath([ROOT_FOLDER, VISITS_FOLDER, year]);
    await this.drive.writeJson(fileName, folderId, visit);
  }

  /** Le ultime visite dell'anno `year` (es. `'2026'`), dalla più recente. */
  async listRecent(year: string, limit: number): Promise<Visit[]> {
    const folderId = await this.drive.ensureFolderPath([ROOT_FOLDER, VISITS_FOLDER, year]);
    // I nomi iniziano con la data: l'ordine per nome decrescente dà i giorni più recenti.
    const files = await this.drive.listFiles(folderId, limit);
    const visits = await Promise.all(files.map(async (file) => parseVisit(await this.drive.readJson(file.id))));
    // Nello stesso giorno il nome segue l'id casuale: si riordina per orario di check-in.
    return visits.sort((a, b) => Date.parse(b.checkIn.at) - Date.parse(a.checkIn.at));
  }
}
