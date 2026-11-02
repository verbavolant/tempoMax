import type { AudioNote, Visit } from '../model/visit';
import type { DriveClient, DriveFileSummary } from './drive';
import { AUDIO_FOLDER, ROOT_FOLDER } from './layout';

// Più delle note di un anno di lavoro; 1000 è il massimo per richiesta di files.list.
const MAX_NOTES_PER_YEAR = 1000;

/** Una nota vocale da elencare: su Drive o ancora solo sul telefono. */
export interface CatalogNote {
  noteId: string;
  kind: 'visit' | 'free' | 'todo';
  /** Data e ora locali (ISO con fuso), oppure solo `AAAA-MM-GG` se ricavata dal nome del file. */
  recordedAt: string;
  durationSeconds: number | null;
  visitId: string | null;
  driveFileId: string | null;
}

// AAAA-MM-GG_<idVisita | "libera">_<idNota>.<estensione> (vedi audioFileName).
const AUDIO_FILE_NAME = /^(\d{4}-\d{2}-\d{2})_(.+)_([^_]+)\.[a-z0-9]+$/;

/**
 * Dati della nota dalle proprietà private del file (T-028a); se mancano si ricavano dal nome.
 * null se il file non è una nota di TempoMax.
 */
export function catalogNoteFromDriveFile(file: DriveFileSummary): CatalogNote | null {
  const match = AUDIO_FILE_NAME.exec(file.name);
  if (!match) {
    return null;
  }
  const [, date = '', owner = '', noteId = ''] = match;
  const { kind, recordedAt, durationSeconds, visitId } = file.appProperties;
  const duration = Number(durationSeconds);
  const noteKind: CatalogNote['kind'] =
    kind === 'visit' || kind === 'free' || kind === 'todo'
      ? kind
      : owner === 'libera'
        ? 'free'
        : owner === 'dafare'
          ? 'todo'
          : 'visit';
  return {
    noteId,
    kind: noteKind,
    recordedAt: recordedAt ?? date,
    durationSeconds: durationSeconds !== undefined && Number.isFinite(duration) ? duration : null,
    visitId: noteKind === 'visit' ? (visitId ?? owner) : null,
    driveFileId: file.id,
  };
}

function catalogNoteFromLocal(note: AudioNote, visitId: string | null): CatalogNote {
  return {
    noteId: note.id,
    kind: visitId ? 'visit' : 'free',
    recordedAt: note.recordedAt,
    durationSeconds: note.durationSeconds,
    visitId,
    driveFileId: note.driveFileId,
  };
}

/**
 * Unisce le note su Drive con quelle ancora sul telefono (non caricate), dalla più recente.
 * Una nota già su Drive compare una volta sola.
 */
export function mergeCatalog(
  fromDrive: readonly CatalogNote[],
  localVisits: readonly Visit[],
  freeNotes: readonly AudioNote[],
): CatalogNote[] {
  const onDrive = new Set(fromDrive.map((note) => note.noteId));
  const local = [
    ...localVisits.flatMap((visit) => visit.audio.map((note) => catalogNoteFromLocal(note, visit.id))),
    ...freeNotes.map((note) => catalogNoteFromLocal(note, null)),
  ].filter((note) => !onDrive.has(note.noteId));
  return [...fromDrive, ...local].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
}

/** Elenco e scaricamento delle note vocali in `TempoMax/audio/AAAA/`. */
export class AudioCatalog {
  constructor(private readonly drive: Pick<DriveClient, 'ensureFolderPath' | 'listFiles' | 'downloadFile'>) {}

  async listYear(year: string): Promise<CatalogNote[]> {
    const folderId = await this.drive.ensureFolderPath([ROOT_FOLDER, AUDIO_FOLDER, year]);
    const files = await this.drive.listFiles(folderId, MAX_NOTES_PER_YEAR);
    return files.flatMap((file) => catalogNoteFromDriveFile(file) ?? []);
  }

  download(driveFileId: string): Promise<Blob> {
    return this.drive.downloadFile(driveFileId);
  }
}
