import { describe, expect, it, vi } from 'vitest';
import { WorkRegister } from '../../src/storage/workRegister';

describe('WorkRegister', () => {
  it('scrive nel Foglio "Orario di lavoro" con intestazione e riga del periodo', async () => {
    const request = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => new Response('{}'));
    const drive = {
      ensureFolderPath: vi.fn().mockResolvedValue('root-folder'),
      findFile: vi.fn().mockResolvedValue(null),
      createEmptyFile: vi.fn().mockResolvedValue('work-sheet'),
      request,
    };
    await new WorkRegister(drive).save({ id: 'p-1', start: '2026-10-31T07:30:00+01:00', end: null });

    expect(drive.createEmptyFile).toHaveBeenCalledWith('Orario di lavoro', 'root-folder', 'application/vnd.google-apps.spreadsheet');
    const urls = request.mock.calls.map(([url]) => decodeURIComponent(url));
    expect(urls).toEqual([
      'https://sheets.googleapis.com/v4/spreadsheets/work-sheet/values/A1:E1?valueInputOption=RAW',
      'https://sheets.googleapis.com/v4/spreadsheets/work-sheet/values/E1:E10000',
      'https://sheets.googleapis.com/v4/spreadsheets/work-sheet/values/A1:E1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS',
    ]);
    expect(request.mock.calls[2]?.[1]?.body).toBe(JSON.stringify({ values: [['31/10/2026', '07:30', '', '', 'p-1']] }));
  });
});
