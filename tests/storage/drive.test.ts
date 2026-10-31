import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../../src/model/validation';
import {
  DriveClient,
  DriveError,
  FileTooLargeError,
  MULTIPART_UPLOAD_MAX_BYTES,
  escapeQueryValue,
} from '../../src/storage/drive';

const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function requestAt(fetchMock: ReturnType<typeof vi.fn>, index: number): { url: URL; init: RequestInit } {
  const call = fetchMock.mock.calls[index];
  if (!call) throw new Error(`Nessuna chiamata fetch #${index}`);
  return { url: new URL(call[0] as string), init: (call[1] ?? {}) as RequestInit };
}

describe('escapeQueryValue', () => {
  it("segue l'esempio della guida Drive per apostrofi e backslash", () => {
    // https://developers.google.com/workspace/drive/api/guides/search-files
    expect(escapeQueryValue("quinn's paper\\essay")).toBe("quinn\\'s paper\\\\essay");
  });
});

describe('DriveClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let accessToken: string | null;
  let drive: DriveClient;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    accessToken = 'abc';
    drive = new DriveClient(() => accessToken);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('richieste', () => {
    it('getUser chiama about.get con fields e token Bearer', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ user: { displayName: 'Mario Verdi', emailAddress: 'mario@example.com' } }),
      );
      await expect(drive.getUser()).resolves.toEqual({ displayName: 'Mario Verdi', emailAddress: 'mario@example.com' });
      const { url, init } = requestAt(fetchMock, 0);
      expect(url.origin + url.pathname).toBe('https://www.googleapis.com/drive/v3/about');
      expect(url.searchParams.get('fields')).toBe('user(displayName,emailAddress)');
      expect(init.headers).toEqual({ Authorization: 'Bearer abc' });
    });

    it('rifiuta una risposta about.get senza email', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ user: { displayName: 'Mario Verdi' } }));
      await expect(drive.getUser()).rejects.toBeInstanceOf(ValidationError);
    });

    it("propaga status, servizio e messaggio dell'errore Google", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ error: { code: 403, message: 'Google Sheets API has not been used in project 1' } }, 403),
      );
      await expect(drive.getUser()).rejects.toEqual(
        new DriveError(403, 'Google Drive ha risposto 403: Google Sheets API has not been used in project 1'),
      );
    });

    it('indica Sheets quando a rispondere è la Sheets API', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: { message: 'The caller does not have permission' } }, 403));
      await expect(drive.request('https://sheets.googleapis.com/v4/spreadsheets/s-1/values/A1:H1')).rejects.toMatchObject({
        message: 'Google Sheets ha risposto 403: The caller does not have permission',
      });
    });

    it('con un corpo non JSON usa lo status testuale', async () => {
      fetchMock.mockResolvedValueOnce(new Response('<html>', { status: 502, statusText: 'Bad Gateway' }));
      await expect(drive.getUser()).rejects.toMatchObject({ status: 502, message: 'Google Drive ha risposto 502: Bad Gateway' });
    });

    it('senza token fallisce con 401 senza chiamare la rete', async () => {
      accessToken = null;
      await expect(drive.getUser()).rejects.toMatchObject({ status: 401 });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('listFiles elenca i file della cartella per nome decrescente', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ files: [{ id: 'f-2', name: '2026-10-31_b.json' }] }));
      await expect(drive.listFiles('folder-1', 20)).resolves.toEqual([{ id: 'f-2', name: '2026-10-31_b.json' }]);
      const params = requestAt(fetchMock, 0).url.searchParams;
      expect(params.get('q')).toBe(
        "'folder-1' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false",
      );
      expect(params.get('orderBy')).toBe('name desc');
      expect(params.get('pageSize')).toBe('20');
      expect(params.get('fields')).toBe('files(id,name)');
    });

    it('readJson scarica il contenuto con alt=media', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ ciao: 1 }));
      await expect(drive.readJson('file-1')).resolves.toEqual({ ciao: 1 });
      const { url } = requestAt(fetchMock, 0);
      expect(url.pathname).toBe('/drive/v3/files/file-1');
      expect(url.searchParams.get('alt')).toBe('media');
    });
  });

  describe('ensureFolderPath', () => {
    it('riusa le cartelle esistenti e crea quelle mancanti dentro il genitore', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ files: [{ id: 'root-folder' }] }))
        .mockResolvedValueOnce(jsonResponse({ files: [] }))
        .mockResolvedValueOnce(jsonResponse({ id: 'visits-folder' }));

      await expect(drive.ensureFolderPath(['TempoMax', 'visite'])).resolves.toBe('visits-folder');

      const rootSearch = requestAt(fetchMock, 0).url.searchParams;
      expect(rootSearch.get('q')).toBe(`name = 'TempoMax' and mimeType = '${FOLDER_MIME_TYPE}' and trashed = false`);
      expect(rootSearch.get('orderBy')).toBe('createdTime');
      expect(requestAt(fetchMock, 1).url.searchParams.get('q')).toBe(
        `name = 'visite' and mimeType = '${FOLDER_MIME_TYPE}' and trashed = false and 'root-folder' in parents`,
      );
      const create = requestAt(fetchMock, 2);
      expect(create.init.method).toBe('POST');
      expect(JSON.parse(create.init.body as string)).toEqual({
        name: 'visite',
        mimeType: FOLDER_MIME_TYPE,
        parents: ['root-folder'],
      });
    });

    it('chiamate contemporanee e successive non ripetono ricerca né creazione', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ files: [] })).mockResolvedValueOnce(jsonResponse({ id: 'new-folder' }));

      const [first, second] = await Promise.all([
        drive.ensureFolderPath(['TempoMax']),
        drive.ensureFolderPath(['TempoMax']),
      ]);
      await drive.ensureFolderPath(['TempoMax']);

      expect([first, second]).toEqual(['new-folder', 'new-folder']);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(JSON.parse(requestAt(fetchMock, 1).init.body as string)).toEqual({
        name: 'TempoMax',
        mimeType: FOLDER_MIME_TYPE,
      });
    });

    it('dopo un errore riprova invece di usare la cache', async () => {
      fetchMock
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(jsonResponse({ files: [{ id: 'root-folder' }] }));

      await expect(drive.ensureFolderPath(['TempoMax'])).rejects.toThrow('Failed to fetch');
      await expect(drive.ensureFolderPath(['TempoMax'])).resolves.toBe('root-folder');
    });

    it('rifiuta un percorso vuoto', async () => {
      await expect(drive.ensureFolderPath([])).rejects.toThrow('Percorso cartella vuoto');
    });
  });

  describe('writeJson', () => {
    it('crea il file con upload multipart se non esiste', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ files: [] })).mockResolvedValueOnce(jsonResponse({ id: 'new-file' }));

      await expect(drive.writeJson("l'elenco.json", 'folder-1', { a: 1 })).resolves.toBe('new-file');

      expect(requestAt(fetchMock, 0).url.searchParams.get('q')).toBe(
        `name = 'l\\'elenco.json' and 'folder-1' in parents and mimeType != '${FOLDER_MIME_TYPE}' and trashed = false`,
      );
      const { url, init } = requestAt(fetchMock, 1);
      expect(url.origin + url.pathname).toBe('https://www.googleapis.com/upload/drive/v3/files');
      expect(url.searchParams.get('uploadType')).toBe('multipart');
      expect(init.method).toBe('POST');
      const contentType = (init.headers as Record<string, string>)['Content-Type'] ?? '';
      const boundary = /^multipart\/related; boundary=(.+)$/.exec(contentType)?.[1];
      expect(boundary).toBeDefined();
      expect(await (init.body as Blob).text()).toBe(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
          `{"name":"l'elenco.json","parents":["folder-1"]}` +
          `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
          `{\n  "a": 1\n}` +
          `\r\n--${boundary}--`,
      );
    });

    it('sostituisce il contenuto se il file esiste già', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ files: [{ id: 'old-file' }] })).mockResolvedValueOnce(jsonResponse({ id: 'old-file' }));

      await expect(drive.writeJson('clienti.json', 'folder-1', { a: 2 })).resolves.toBe('old-file');

      const { url, init } = requestAt(fetchMock, 1);
      expect(url.origin + url.pathname).toBe('https://www.googleapis.com/upload/drive/v3/files/old-file');
      expect(url.searchParams.get('uploadType')).toBe('media');
      expect(init.method).toBe('PATCH');
      expect(init.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer abc' });
      expect(await (init.body as Blob).text()).toBe('{\n  "a": 2\n}');
    });
  });

  describe('uploadFile', () => {
    it('mette appProperties nei metadati del multipart', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'f-1', webViewLink: 'https://drive.google.com/file/d/f-1/view' }));
      await drive.uploadFile('nota.m4a', 'folder-1', new Blob(['x'], { type: 'audio/mp4' }), { kind: 'free' });
      const body = await (requestAt(fetchMock, 0).init.body as Blob).text();
      expect(body).toContain('{"name":"nota.m4a","parents":["folder-1"],"appProperties":{"kind":"free"}}');
    });

    it('chiede id e webViewLink e li restituisce', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'f-1', webViewLink: 'https://drive.google.com/file/d/f-1/view' }));
      await expect(drive.uploadFile('nota.m4a', 'folder-1', new Blob(['x'], { type: 'audio/mp4' }))).resolves.toEqual({
        id: 'f-1',
        webViewLink: 'https://drive.google.com/file/d/f-1/view',
      });
      const { url } = requestAt(fetchMock, 0);
      expect(url.searchParams.get('uploadType')).toBe('multipart');
      expect(url.searchParams.get('fields')).toBe('id,webViewLink');
    });
  });

  describe('limiti di upload', () => {
    it('rifiuta file oltre il limite del multipart senza chiamare la rete', async () => {
      const tooBig = new Blob([new Uint8Array(MULTIPART_UPLOAD_MAX_BYTES + 1)], { type: 'audio/mp4' });
      await expect(drive.createFile('audio.m4a', 'folder-1', tooBig)).rejects.toBeInstanceOf(FileTooLargeError);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rifiuta file senza tipo MIME', async () => {
      await expect(drive.updateFile('file-1', new Blob(['x']))).rejects.toThrow('Tipo MIME mancante');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
