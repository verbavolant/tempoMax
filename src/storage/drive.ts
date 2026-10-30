import { expectArray, expectNonEmptyString, expectObject, expectString } from '../model/validation';

const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const JSON_MIME_TYPE = 'application/json';

// L'upload multipart è documentato per file "5 MB or less"; usiamo il valore decimale, più prudente.
// Fonte: https://developers.google.com/workspace/drive/api/guides/manage-uploads
export const MULTIPART_UPLOAD_MAX_BYTES = 5_000_000;

export class DriveError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'DriveError';
    this.status = status;
  }
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
    assertUploadable(content);
    const boundary = `tempomax-${crypto.randomUUID()}`;
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
      JSON.stringify({ name, parents: [parentId] }),
      `\r\n--${boundary}\r\nContent-Type: ${content.type}\r\n\r\n`,
      content,
      `\r\n--${boundary}--`,
    ]);
    const response = await this.request(`${DRIVE_UPLOAD_URL}/files?uploadType=multipart&fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    return parseFileId(await response.json(), 'create');
  }

  async updateFile(fileId: string, content: Blob): Promise<void> {
    assertUploadable(content);
    await this.request(`${DRIVE_UPLOAD_URL}/files/${encodeURIComponent(fileId)}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': content.type },
      body: content,
    });
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
    const response = await this.request(`${DRIVE_API_URL}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': JSON_MIME_TYPE },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME_TYPE, ...(parentId && { parents: [parentId] }) }),
    });
    return parseFileId(await response.json(), 'folder');
  }

  /** Il più vecchio tra i file che soddisfano la query, così un eventuale duplicato non sostituisce l'originale. */
  private async findOne(query: string): Promise<string | null> {
    const params = new URLSearchParams({ q: query, fields: 'files(id)', orderBy: 'createdTime', pageSize: '1' });
    const response = await this.request(`${DRIVE_API_URL}/files?${params}`);
    const [first] = expectArray(expectObject(await response.json(), 'list').files, 'list.files');
    return first === undefined ? null : parseFileId(first, 'list.files[0]');
  }

  private async request(url: string, init: RequestInit = {}): Promise<Response> {
    const accessToken = this.getAccessToken();
    if (!accessToken) {
      throw new DriveError(401, 'Accesso Google scaduto: tocca "Accedi con Google"');
    }
    const response = await fetch(url, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new DriveError(response.status, `Google Drive ha risposto ${response.status}`);
    }
    return response;
  }
}

function assertUploadable(content: Blob): void {
  if (!content.type) {
    throw new Error('Tipo MIME mancante per il file da caricare');
  }
  if (content.size > MULTIPART_UPLOAD_MAX_BYTES) {
    // TODO(T-014): upload "resumable" per audio lunghi oltre il limite del multipart.
    throw new Error(`File troppo grande (${content.size} byte): limite ${MULTIPART_UPLOAD_MAX_BYTES}`);
  }
}

function parseFileId(value: unknown, path: string): string {
  return expectNonEmptyString(expectObject(value, path).id, `${path}.id`);
}
