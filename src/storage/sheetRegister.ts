import { expectArray, expectObject } from '../model/validation';
import type { DriveClient } from './drive';
import { ROOT_FOLDER } from './layout';

const SHEETS_API_URL = 'https://sheets.googleapis.com/v4/spreadsheets';
const SPREADSHEET_MIME_TYPE = 'application/vnd.google-apps.spreadsheet';

// La doc Sheets garantisce che un intervallo senza nome del foglio ("A1:B2") indica il primo foglio visibile;
// le forme aperte ("H:H") senza nome non sono documentate, quindi usiamo intervalli limitati.
// 10.000 righe: anni di registrazioni a qualche riga al giorno.
const MAX_REGISTER_ROWS = 10_000;

const columnLetter = (index: number) => String.fromCharCode('A'.charCodeAt(0) + index);

export type RegisterCell = string | number;

export interface SheetLayout {
  /** Nome del Foglio Google nella cartella `TempoMax`. */
  fileName: string;
  header: readonly string[];
  /** Colonna (da 0) con l'id che identifica la riga. */
  idColumnIndex: number;
}

type RegisterDrive = Pick<DriveClient, 'ensureFolderPath' | 'findFile' | 'createEmptyFile' | 'request'>;

/** Foglio Google con una riga per elemento (visita, periodo di lavoro…), aggiornata a ogni salvataggio. Vista derivata dai JSON (ADR-003). */
export class SheetRegister {
  private spreadsheetId: Promise<string> | null = null;
  private readonly lastColumn: string;
  private readonly idColumn: string;

  constructor(
    private readonly drive: RegisterDrive,
    private readonly layout: SheetLayout,
  ) {
    this.lastColumn = columnLetter(layout.header.length - 1);
    this.idColumn = columnLetter(layout.idColumnIndex);
  }

  /** Aggiorna la riga con questo id, oppure la aggiunge in fondo. */
  async saveRow(id: string, row: readonly RegisterCell[]): Promise<void> {
    const spreadsheetId = await this.getSpreadsheetId();
    const body = JSON.stringify({ values: [row] });
    const rowNumber = await this.findRowNumber(spreadsheetId, id);
    if (rowNumber) {
      await this.drive.request(this.valuesUrl(spreadsheetId, this.rowRange(rowNumber), '?valueInputOption=RAW'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      return;
    }
    await this.drive.request(
      this.valuesUrl(spreadsheetId, this.rowRange(1), ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS'),
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body },
    );
  }

  private rowRange(row: number): string {
    return `A${row}:${this.lastColumn}${row}`;
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
      (await this.drive.findFile(this.layout.fileName, folderId)) ??
      (await this.drive.createEmptyFile(this.layout.fileName, folderId, SPREADSHEET_MIME_TYPE));
    // Intestazione riscritta anche sui fogli esistenti: aggiunge le colonne nuove.
    await this.drive.request(this.valuesUrl(spreadsheetId, this.rowRange(1), '?valueInputOption=RAW'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [this.layout.header] }),
    });
    return spreadsheetId;
  }

  /** Numero di riga (da 1) con questo id, oppure null se non è ancora nel foglio. */
  private async findRowNumber(spreadsheetId: string, id: string): Promise<number | null> {
    const range = `${this.idColumn}1:${this.idColumn}${MAX_REGISTER_ROWS}`;
    const response = await this.drive.request(this.valuesUrl(spreadsheetId, range, ''));
    // Con la colonna vuota la risposta non contiene `values`.
    const { values = [] } = expectObject(await response.json(), 'valori');
    const index = expectArray(values, 'valori.values').findIndex((row) => Array.isArray(row) && row[0] === id);
    return index === -1 ? null : index + 1;
  }

  private valuesUrl(spreadsheetId: string, range: string, suffix: string): string {
    return `${SHEETS_API_URL}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}${suffix}`;
  }
}
