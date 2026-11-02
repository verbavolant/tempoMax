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

/** A chi appartiene una nota: una visita, nessuno (nota libera) o un'attività "da fare" (T-034). */
export type AudioOwner = { kind: 'visit'; visit: Visit } | { kind: 'free' } | { kind: 'todo'; taskId: string };

const FILE_NAME_OWNER = { free: 'libera', todo: 'dafare' } as const;

/**
 * `AAAA-MM-GG_<idVisita | libera | dafare>_<idNota>.<estensione>`: data locale di registrazione,
 * ordinabile e univoco.
 */
export function audioFileName(owner: AudioOwner, note: AudioNote): string {
  const ownerPart = owner.kind === 'visit' ? owner.visit.id : FILE_NAME_OWNER[owner.kind];
  return `${note.recordedAt.slice(0, 10)}_${ownerPart}_${note.id}.${audioFileExtension(note.mimeType)}`;
}

/** Proprietà private salvate sul file audio: permettono di elencare le note con una sola richiesta (T-028c). */
export function audioAppProperties(owner: AudioOwner, note: AudioNote): Record<string, string> {
  return {
    kind: owner.kind,
    recordedAt: note.recordedAt,
    durationSeconds: String(note.durationSeconds),
    ...(owner.kind === 'visit' && { visitId: owner.visit.id }),
    ...(owner.kind === 'todo' && { taskId: owner.taskId }),
    ...(note.device && { device: note.device }),
    ...(note.position && {
      latitude: String(note.position.latitude),
      longitude: String(note.position.longitude),
      accuracyMeters: String(Math.round(note.position.accuracyMeters)),
    }),
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

  /** Restituisce null se il file non è più sul telefono (es. registrato in Safari e non nell'app installata). */
  async upload(owner: AudioOwner, note: AudioNote): Promise<UploadedAudio | null> {
    const audio = await this.store.get(note.id);
    if (!audio) {
      return null;
    }
    const folderId = await this.drive.ensureFolderPath([ROOT_FOLDER, AUDIO_FOLDER, note.recordedAt.slice(0, 4)]);
    const { id, webViewLink } = await this.drive.uploadFile(
      audioFileName(owner, note),
      folderId,
      audio,
      audioAppProperties(owner, note),
    );
    return { fileId: id, link: webViewLink };
  }

  deleteLocal(noteId: string): Promise<void> {
    return this.store.delete(noteId);
  }
}
