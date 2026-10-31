import type { AudioNote, Visit } from '../model/visit';
import type { AudioStore } from './audioStore';
import type { DriveClient } from './drive';
import { AUDIO_FOLDER, ROOT_FOLDER } from './layout';

type AudioDrive = Pick<DriveClient, 'ensureFolderPath' | 'uploadFile'>;

/** Estensione leggibile sul PC: MP4 solo audio è il classico .m4a. */
export function audioFileExtension(mimeType: string): string {
  if (mimeType.startsWith('audio/mp4')) {
    return 'm4a';
  }
  if (mimeType.startsWith('audio/webm')) {
    return 'webm';
  }
  return 'bin';
}

/**
 * `AAAA-MM-GG_<idVisita>_<idNota>.<estensione>` per le note di una visita, `AAAA-MM-GG_libera_<idNota>.<estensione>`
 * per le note libere: data locale di registrazione, ordinabile e univoco.
 */
export function audioFileName(visit: Visit | null, note: AudioNote): string {
  return `${note.recordedAt.slice(0, 10)}_${visit ? visit.id : 'libera'}_${note.id}.${audioFileExtension(note.mimeType)}`;
}

/** Proprietà private salvate sul file audio: permettono di elencare le note con una sola richiesta (T-028c). */
export function audioAppProperties(visit: Visit | null, note: AudioNote): Record<string, string> {
  return {
    kind: visit ? 'visit' : 'free',
    recordedAt: note.recordedAt,
    durationSeconds: String(note.durationSeconds),
    ...(visit && { visitId: visit.id }),
  };
}

export interface UploadedAudio {
  fileId: string;
  link: string;
}

/** Porta le note dal telefono (`AudioStore`) a `TempoMax/audio/AAAA/` su Drive. */
export class AudioUploader {
  constructor(
    private readonly drive: AudioDrive,
    private readonly store: Pick<AudioStore, 'get' | 'delete'>,
  ) {}

  /**
   * `visit` null per una nota libera. Restituisce null se il file non è più sul telefono
   * (es. registrato in Safari e non nell'app installata).
   */
  async upload(visit: Visit | null, note: AudioNote): Promise<UploadedAudio | null> {
    const audio = await this.store.get(note.id);
    if (!audio) {
      return null;
    }
    const folderId = await this.drive.ensureFolderPath([ROOT_FOLDER, AUDIO_FOLDER, note.recordedAt.slice(0, 4)]);
    const { id, webViewLink } = await this.drive.uploadFile(
      audioFileName(visit, note),
      folderId,
      audio,
      audioAppProperties(visit, note),
    );
    return { fileId: id, link: webViewLink };
  }

  deleteLocal(noteId: string): Promise<void> {
    return this.store.delete(noteId);
  }
}
