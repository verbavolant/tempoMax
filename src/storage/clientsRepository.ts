import { type Client, type ClientsDocument, parseClientsDocument } from '../model/client';
import { SCHEMA_VERSION } from '../model/validation';
import type { DriveClient } from './drive';
import { CLIENTS_FILE, ROOT_FOLDER } from './layout';

type ClientsDrive = Pick<DriveClient, 'ensureFolderPath' | 'findFile' | 'readJson' | 'writeJson'>;

/** Lettura e scrittura di `TempoMax/clienti.json`. Un solo utente: vince l'ultima scrittura. */
export class ClientsRepository {
  constructor(private readonly drive: ClientsDrive) {}

  async load(): Promise<Client[]> {
    const folderId = await this.drive.ensureFolderPath([ROOT_FOLDER]);
    const fileId = await this.drive.findFile(CLIENTS_FILE, folderId);
    if (!fileId) {
      return [];
    }
    return parseClientsDocument(await this.drive.readJson(fileId)).clients;
  }

  async save(clients: readonly Client[]): Promise<void> {
    const document: ClientsDocument = { schemaVersion: SCHEMA_VERSION, clients: [...clients] };
    // Rivalida prima di scrivere: un file corrotto su Drive bloccherebbe il caricamento successivo.
    parseClientsDocument(document);
    const folderId = await this.drive.ensureFolderPath([ROOT_FOLDER]);
    await this.drive.writeJson(CLIENTS_FILE, folderId, document);
  }
}
