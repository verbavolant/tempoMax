import { expectArray, expectNonEmptyString, expectObject, expectString } from '../model/validation';

const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const JSON_MIME_TYPE = 'application/json';

// L'upload multipart è documentato per file "5 MB or less"; usiamo il valore decimale, più prudente.
// Fonte: https://developers.google.com/workspace/drive/api/guides/manage-uploads
export const MULTIPART_UPLOAD_MAX_BYTES = 5_000_000;

/** File oltre il limite del multipart (ADR-007): errore permanente, riprovare non serve. */
export class FileTooLargeError extends Error {
  constructor(size: number) {
    super(`File troppo grande (${size} byte): limite ${MULTIPART_UPLOAD_MAX_BYTES}`);
    this.name = 'FileTooLargeError';
  }
}

export class DriveError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'DriveError';
    this.status = status;
  }
}

export interface DriveFileSummary {
  id: string;
  name: string;
  webViewLink: string | null;
  /** Proprietà private dell'app; oggetto vuoto se il file non ne ha. */
  appProperties: Record<string, string>;
}

export interface DriveUser {
  displayName: string;
  emailAddress: string;
}

/** Escaping dei valori nelle query `q` di files.list: backslash e apostrofo vanno preceduti da backslash. */
export function escapeQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export class DriveClient {
  // Promesse in cache per percorso: due chiamate contemporanee non creano cartelle doppie.
  private readonly folderIds = new Map<string, Promise<string>>();

  constructor(private readonly getAccessToken: () => string | null) {}

  async getUser(): Promise<DriveUser> {
    // `fields` è obbligatorio per about.get.
    const response = await this.request(`${DRIVE_API_URL}/about?${new URLSearchParams({ fields: 'user(displayName,emailAddress)' })}`);
    const user = expectObject(expectObject(await response.json(), 'about').user, 'about.user');
    return {
      displayName: expectString(user.displayName, 'about.user.displayName'),
      emailAddress: expectNonEmptyString(user.emailAddress, 'about.user.emailAddress'),
    };
  }

  /** Restituisce l'id dell'ultima cartella del percorso (es. `['TempoMax', 'visite', '2026']`), creando quelle mancanti. */
  ensureFolderPath(path: readonly string[]): Promise<string> {
    let folderId: Promise<string> | undefined;
    for (const [index, name] of path.entries()) {
      const key = path.slice(0, index + 1).join('/');
      const parentId: Promise<string | null> = folderId ?? Promise.resolve(null);
      let cached = this.folderIds.get(key);
      if (!cached) {
        cached = parentId.then((parent) => this.findOrCreateFolder(name, parent));
        this.folderIds.set(key, cached);
        // Un errore (es. rete assente) non deve restare in cache: il prossimo tentativo riprova.
        cached.catch(() => this.folderIds.delete(key));
      }
      folderId = cached;
    }
    return folderId ?? Promise.reject(new Error('Percorso cartella vuoto'));
  }

  findFile(name: string, parentId: string): Promise<string | null> {
    return this.findOne(`name = '${escapeQueryValue(name)}' and '${escapeQueryValue(parentId)}' in parents and mimeType != '${FOLDER_MIME_TYPE}' and trashed = false`);
  }

  /** File (non cartelle) contenuti in una cartella, ordinati per nome decrescente (max 1000 per la API). */
  async listFiles(parentId: string, pageSize: number): Promise<DriveFileSummary[]> {
    const params = new URLSearchParams({
      q: `'${escapeQueryValue(parentId)}' in parents and mimeType != '${FOLDER_MIME_TYPE}' and trashed = false`,
      fields: 'files(id,name,webViewLink,appProperties)',
      orderBy: 'name desc',
      pageSize: String(pageSize),
    });
    const response = await this.request(`${DRIVE_API_URL}/files?${params}`);
    return expectArray(expectObject(await response.json(), 'list').files, 'list.files').map((file, index) => {
      const path = `list.files[${index}]`;
      const object = expectObject(file, path);
      const properties = object.appProperties === undefined ? {} : expectObject(object.appProperties, `${path}.appProperties`);
      return {
        id: parseFileId(object, path),
        name: expectNonEmptyString(object.name, `${path}.name`),
        webViewLink: object.webViewLink === undefined ? null : expectNonEmptyString(object.webViewLink, `${path}.webViewLink`),
        appProperties: Object.fromEntries(
          Object.entries(properties).map(([key, value]) => [key, expectString(value, `${path}.appProperties.${key}`)]),
        ),
      };
    });
  }

  /** Contenuto di un file binario (es. una nota vocale). */
  async downloadFile(fileId: string): Promise<Blob> {
    const response = await this.request(`${DRIVE_API_URL}/files/${encodeURIComponent(fileId)}?alt=media`);
    return response.blob();
  }

  async readJson(fileId: string): Promise<unknown> {
    const response = await this.request(`${DRIVE_API_URL}/files/${encodeURIComponent(fileId)}?alt=media`);
    return response.json();
  }

  /** Crea il file JSON o ne sostituisce il contenuto se esiste già nella cartella. */
  async writeJson(name: string, parentId: string, value: unknown): Promise<string> {
    const content = new Blob([JSON.stringify(value, null, 2)], { type: JSON_MIME_TYPE });
    const existingId = await this.findFile(name, parentId);
    if (existingId) {
      await this.updateFile(existingId, content);
      return existingId;
    }
    return this.createFile(name, parentId, content);
  }

  async createFile(name: string, parentId: string, content: Blob): Promise<string> {
    return parseFileId(await this.createMultipart({ name, parents: [parentId] }, content, 'id'), 'create');
  }

  /**
   * Carica un file e ne restituisce id e link per aprirlo nel visualizzatore di Drive (`webViewLink`).
   * `appProperties`: proprietà private dell'app sul file (max 30, 124 byte per coppia chiave-valore).
   */
  async uploadFile(
    name: string,
    parentId: string,
    content: Blob,
    appProperties: Record<string, string> = {},
  ): Promise<{ id: string; webViewLink: string }> {
    const metadata = { name, parents: [parentId], ...(Object.keys(appProperties).length > 0 && { appProperties }) };
    const file = expectObject(await this.createMultipart(metadata, content, 'id,webViewLink'), 'upload');
    return { id: parseFileId(file, 'upload'), webViewLink: expectNonEmptyString(file.webViewLink, 'upload.webViewLink') };
  }

  private async createMultipart(metadata: object, content: Blob, fields: string): Promise<unknown> {
    assertUploadable(content);
    const boundary = `tempomax-${crypto.randomUUID()}`;
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
      JSON.stringify(metadata),
      `\r\n--${boundary}\r\nContent-Type: ${content.type}\r\n\r\n`,
      content,
      `\r\n--${boundary}--`,
    ]);
    const params = new URLSearchParams({ uploadType: 'multipart', fields });
    const response = await this.request(`${DRIVE_UPLOAD_URL}/files?${params}`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    return response.json();
  }

  async updateFile(fileId: string, content: Blob): Promise<void> {
    assertUploadable(content);
    await this.request(`${DRIVE_UPLOAD_URL}/files/${encodeURIComponent(fileId)}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': content.type },
      body: content,
    });
  }

  /** Crea un file senza contenuto (cartella, Foglio Google…) e ne restituisce l'id. Senza genitore va in "Il mio Drive". */
  async createEmptyFile(name: string, parentId: string | null, mimeType: string): Promise<string> {
    const response = await this.request(`${DRIVE_API_URL}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': JSON_MIME_TYPE },
      body: JSON.stringify({ name, mimeType, ...(parentId && { parents: [parentId] }) }),
    });
    return parseFileId(await response.json(), 'create');
  }

  private async findOrCreateFolder(name: string, parentId: string | null): Promise<string> {
    // Senza genitore cerchiamo ovunque: con lo scope drive.file l'app vede solo le cartelle create da lei.
    const parentClause = parentId ? ` and '${escapeQueryValue(parentId)}' in parents` : '';
    const existingId = await this.findOne(
      `name = '${escapeQueryValue(name)}' and mimeType = '${FOLDER_MIME_TYPE}' and trashed = false${parentClause}`,
    );
    if (existingId) {
      return existingId;
    }
    return this.createEmptyFile(name, parentId, FOLDER_MIME_TYPE);
  }

  /** Il più vecchio tra i file che soddisfano la query, così un eventuale duplicato non sostituisce l'originale. */
  private async findOne(query: string): Promise<string | null> {
    const params = new URLSearchParams({ q: query, fields: 'files(id)', orderBy: 'createdTime', pageSize: '1' });
    const response = await this.request(`${DRIVE_API_URL}/files?${params}`);
    const [first] = expectArray(expectObject(await response.json(), 'list').files, 'list.files');
    return first === undefined ? null : parseFileId(first, 'list.files[0]');
  }

  /** Richiesta autenticata a un'API Google con lo stesso token (usata anche per la Sheets API). */
  async request(url: string, init: RequestInit = {}): Promise<Response> {
    const accessToken = this.getAccessToken();
    if (!accessToken) {
      throw new DriveError(401, 'Accesso Google scaduto: riprova per accedere di nuovo');
    }
    const response = await fetch(url, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new DriveError(response.status, `Google ${serviceName(url)} ha risposto ${response.status}: ${await googleErrorMessage(response)}`);
    }
    return response;
  }
}

function serviceName(url: string): string {
  const { hostname, pathname } = new URL(url);
  if (hostname === 'sheets.googleapis.com') {
    return 'Sheets';
  }
  return pathname.includes('/drive/') ? 'Drive' : hostname;
}

/**
 * Le API Google restituiscono di solito `{ "error": { "message": … } }`: il testo spiega la causa
 * (es. API non abilitata, permesso mancante). Se il corpo ha un'altra forma, si usa lo status testuale.
 */
async function googleErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    const error = typeof body === 'object' && body !== null && 'error' in body ? body.error : undefined;
    if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
      return error.message;
    }
  } catch {
    // Corpo non JSON: si ricade sullo status testuale qui sotto.
  }
  return response.statusText || 'nessun dettaglio';
}

function assertUploadable(content: Blob): void {
  if (!content.type) {
    throw new Error('Tipo MIME mancante per il file da caricare');
  }
  if (content.size > MULTIPART_UPLOAD_MAX_BYTES) {
    throw new FileTooLargeError(content.size);
  }
}

function parseFileId(value: unknown, path: string): string {
  return expectNonEmptyString(expectObject(value, path).id, `${path}.id`);
}
