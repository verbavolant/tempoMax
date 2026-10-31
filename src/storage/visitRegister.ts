import { expectArray, expectObject } from '../model/validation';
import type { Visit } from '../model/visit';
import { REGISTER_HEADER, REGISTER_ID_COLUMN_INDEX, visitToRow } from '../register/visitRow';
import type { DriveClient } from './drive';
import { REGISTER_FILE, ROOT_FOLDER } from './layout';

const SHEETS_API_URL = 'https://sheets.googleapis.com/v4/spreadsheets';
const SPREADSHEET_MIME_TYPE = 'application/vnd.google-apps.spreadsheet';

// La doc Sheets garantisce che un intervallo senza nome del foglio ("A1:B2") indica il primo foglio visibile;
// le forme aperte ("H:H") senza nome non sono documentate, quindi usiamo intervalli limitati.
// 10.000 righe: anni di visite a qualche visita al giorno.
const MAX_REGISTER_ROWS = 10_000;

const columnLetter = (index: number) => String.fromCharCode('A'.charCodeAt(0) + index);
const LAST_COLUMN = columnLetter(REGISTER_HEADER.length - 1);
const ID_COLUMN = columnLetter(REGISTER_ID_COLUMN_INDEX);
const rowRange = (row: number) => `A${row}:${LAST_COLUMN}${row}`;

type RegisterDrive = Pick<DriveClient, 'ensureFolderPath' | 'findFile' | 'createEmptyFile' | 'request'>;

/** Foglio Google `TempoMax/Registro visite`: una riga per visita, aggiornata a ogni salvataggio. Vista derivata dai JSON (ADR-003). */
export class VisitRegister {
  private spreadsheetId: Promise<string> | null = null;

  constructor(private readonly drive: RegisterDrive) {}

  async save(visit: Visit, clientName: string | null): Promise<void> {
    const spreadsheetId = await this.getSpreadsheetId();
    const body = JSON.stringify({ values: [visitToRow(visit, clientName)] });
    const rowNumber = await this.findRowNumber(spreadsheetId, visit.id);
    if (rowNumber) {
      await this.drive.request(this.valuesUrl(spreadsheetId, rowRange(rowNumber), '?valueInputOption=RAW'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      return;
    }
    await this.drive.request(
      this.valuesUrl(spreadsheetId, rowRange(1), ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS'),
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body },
    );
  }

  private getSpreadsheetId(): Promise<string> {
    this.spreadsheetId ??= this.findOrCreateSpreadsheet();
    // Un errore (es. rete assente) non resta in cache: il prossimo salvataggio riprova.
    this.spreadsheetId.catch(() => {
      this.spreadsheetId = null;
    });
    return this.spreadsheetId;
  }

  private async findOrCreateSpreadsheet(): Promise<string> {
    const folderId = await this.drive.ensureFolderPath([ROOT_FOLDER]);
    // Creazione in cartella via Drive, come indicato dalla guida Sheets "Create a spreadsheet".
    const spreadsheetId =
      (await this.drive.findFile(REGISTER_FILE, folderId)) ??
      (await this.drive.createEmptyFile(REGISTER_FILE, folderId, SPREADSHEET_MIME_TYPE));
    // Intestazione riscritta anche sui fogli esistenti: aggiunge le colonne nuove (es. Audio).
    await this.drive.request(this.valuesUrl(spreadsheetId, rowRange(1), '?valueInputOption=RAW'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [REGISTER_HEADER] }),
    });
    return spreadsheetId;
  }

  /** Numero di riga (da 1) della visita, oppure null se non è ancora nel foglio. */
  private async findRowNumber(spreadsheetId: string, visitId: string): Promise<number | null> {
    const range = `${ID_COLUMN}1:${ID_COLUMN}${MAX_REGISTER_ROWS}`;
    const response = await this.drive.request(this.valuesUrl(spreadsheetId, range, ''));
    // Con la colonna vuota la risposta non contiene `values`.
    const { values = [] } = expectObject(await response.json(), 'valori');
    const index = expectArray(values, 'valori.values').findIndex(
      (row) => Array.isArray(row) && row[0] === visitId,
    );
    return index === -1 ? null : index + 1;
  }

  private valuesUrl(spreadsheetId: string, range: string, suffix: string): string {
    return `${SHEETS_API_URL}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}${suffix}`;
  }
}
