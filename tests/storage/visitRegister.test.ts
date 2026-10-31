import { describe, expect, it, vi } from 'vitest';
import type { Visit } from '../../src/model/visit';
import { REGISTER_HEADER } from '../../src/register/visitRow';
import { VisitRegister } from '../../src/storage/visitRegister';

const visit: Visit = {
  schemaVersion: 1,
  id: 'v-2',
  clientId: null,
  checkIn: { at: '2026-10-31T09:05:00+01:00', position: null },
  checkOut: null,
  note: '',
  audio: [],
  device: null,
};

const jsonResponse = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

function fakeDrive(existingSpreadsheet: string | null, idColumn: unknown) {
  const request = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async (url) =>
    jsonResponse(decodeURIComponent(url).includes('/values/H1:H10000') ? idColumn : {}),
  );
  return {
    ensureFolderPath: vi.fn().mockResolvedValue('root-folder'),
    findFile: vi.fn().mockResolvedValue(existingSpreadsheet),
    createEmptyFile: vi.fn().mockResolvedValue('new-sheet'),
    request,
    calls: () => request.mock.calls.map(([url, init]) => ({ url: decodeURIComponent(url), init })),
  };
}

describe('VisitRegister', () => {
  it('crea il foglio nella cartella TempoMax con intestazione, poi aggiunge la riga', async () => {
    const drive = fakeDrive(null, {});
    await new VisitRegister(drive).save(visit, null);

    expect(drive.findFile).toHaveBeenCalledWith('Registro visite', 'root-folder');
    expect(drive.createEmptyFile).toHaveBeenCalledWith(
      'Registro visite',
      'root-folder',
      'application/vnd.google-apps.spreadsheet',
    );
    const [header, lookup, append] = drive.calls();
    expect(header?.url).toBe('https://sheets.googleapis.com/v4/spreadsheets/new-sheet/values/A1:J1?valueInputOption=RAW');
    expect(header?.init).toMatchObject({ method: 'PUT', body: JSON.stringify({ values: [REGISTER_HEADER] }) });
    expect(lookup?.url).toBe('https://sheets.googleapis.com/v4/spreadsheets/new-sheet/values/H1:H10000');
    expect(append?.url).toBe(
      'https://sheets.googleapis.com/v4/spreadsheets/new-sheet/values/A1:J1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS',
    );
    expect(append?.init).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ values: [['31/10/2026', '09:05', '', '', '', '', '', 'v-2', '', '']] }),
    });
  });

  it('aggiorna la riga esistente della visita invece di duplicarla', async () => {
    const drive = fakeDrive('sheet-1', { values: [['ID visita'], ['v-1'], ['v-2']] });
    await new VisitRegister(drive).save(visit, 'Villa Rossi');

    expect(drive.createEmptyFile).not.toHaveBeenCalled();
    // Il foglio esistente riceve l'intestazione aggiornata (colonna Audio).
    expect(drive.calls()[0]?.url).toBe('https://sheets.googleapis.com/v4/spreadsheets/sheet-1/values/A1:J1?valueInputOption=RAW');
    const update = drive.calls().at(-1);
    expect(update?.url).toBe('https://sheets.googleapis.com/v4/spreadsheets/sheet-1/values/A3:J3?valueInputOption=RAW');
    expect(update?.init?.method).toBe('PUT');
  });

  it('cerca il foglio una sola volta per sessione', async () => {
    const drive = fakeDrive('sheet-1', { values: [['ID visita']] });
    const register = new VisitRegister(drive);
    await register.save(visit, null);
    await register.save({ ...visit, id: 'v-3' }, null);
    expect(drive.findFile).toHaveBeenCalledTimes(1);
  });

  it('dopo un errore nella ricerca del foglio riprova al salvataggio successivo', async () => {
    const drive = fakeDrive('sheet-1', { values: [] });
    drive.findFile.mockRejectedValueOnce(new Error('offline'));
    const register = new VisitRegister(drive);
    await expect(register.save(visit, null)).rejects.toThrow('offline');
    await expect(register.save(visit, null)).resolves.toBeUndefined();
    expect(drive.findFile).toHaveBeenCalledTimes(2);
  });
});
