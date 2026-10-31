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

/** `AAAA-MM-GG_<idVisita>_<idNota>.<estensione>`: data locale di registrazione, ordinabile e univoco. */
export function audioFileName(visit: Visit, note: AudioNote): string {
  return `${note.recordedAt.slice(0, 10)}_${visit.id}_${note.id}.${audioFileExtension(note.mimeType)}`;
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

  /** null se il file non è più sul telefono (es. registrato in Safari e non nell'app installata). */
  async upload(visit: Visit, note: AudioNote): Promise<UploadedAudio | null> {
    const audio = await this.store.get(note.id);
    if (!audio) {
      return null;
    }
    const folderId = await this.drive.ensureFolderPath([ROOT_FOLDER, AUDIO_FOLDER, note.recordedAt.slice(0, 4)]);
    const { id, webViewLink } = await this.drive.uploadFile(audioFileName(visit, note), folderId, audio);
    return { fileId: id, link: webViewLink };
  }

  deleteLocal(noteId: string): Promise<void> {
    return this.store.delete(noteId);
  }
}
