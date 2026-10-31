import type { AudioStore } from '../storage/audioStore';

/** Ciò che serve per riprodurre una nota: l'id (copia sul telefono) e, se caricata, il file su Drive. */
export interface PlayableNote {
  noteId: string;
  driveFileId: string | null;
}

export interface NotePlayerDependencies {
  audioStore: Pick<AudioStore, 'get'>;
  download: (driveFileId: string) => Promise<Blob>;
  authorized: <T>(action: () => Promise<T>) => Promise<T>;
}

/** File dal telefono se c'è, altrimenti scaricato da Drive (una volta sola grazie a `cache`). */
export async function loadNoteAudio(
  note: PlayableNote,
  dependencies: NotePlayerDependencies,
  cache: Map<string, Blob>,
): Promise<Blob> {
  const local = await dependencies.audioStore.get(note.noteId);
  if (local) {
    return local;
  }
  const { driveFileId } = note;
  if (!driveFileId) {
    throw new Error('file non presente né sul telefono né su Drive');
  }
  const cached = cache.get(driveFileId);
  if (cached) {
    return cached;
  }
  const audio = await dependencies.authorized(() => dependencies.download(driveFileId));
  cache.set(driveFileId, audio);
  return audio;
}

/** Un solo lettore per schermata: avviare una nota ferma la precedente. `onChange` ridisegna i pulsanti ▶/⏸. */
export class NotePlayer {
  private readonly audio = new Audio();
  private readonly downloaded = new Map<string, Blob>();
  private playingUrl: string | null = null;
  private playingNoteId: string | null = null;

  constructor(
    private readonly dependencies: NotePlayerDependencies,
    private readonly onChange: () => void,
  ) {
    this.audio.addEventListener('ended', () => {
      this.stop();
      this.onChange();
    });
  }

  isPlaying(noteId: string): boolean {
    return this.playingNoteId === noteId;
  }

  /** Avvia la nota, o la ferma se è quella in riproduzione. */
  async toggle(note: PlayableNote): Promise<void> {
    if (this.isPlaying(note.noteId)) {
      this.stop();
      this.onChange();
      return;
    }
    this.stop();
    this.playingNoteId = note.noteId;
    this.onChange();
    try {
      const audio = await loadNoteAudio(note, this.dependencies, this.downloaded);
      // Nel frattempo si può aver toccato un'altra nota: questa non va più avviata.
      if (!this.isPlaying(note.noteId)) {
        return;
      }
      this.playingUrl = URL.createObjectURL(audio);
      this.audio.src = this.playingUrl;
      await this.audio.play();
    } catch (error) {
      this.stop();
      this.onChange();
      throw error;
    }
  }

  stop(): void {
    this.audio.pause();
    if (this.playingUrl) {
      URL.revokeObjectURL(this.playingUrl);
    }
    this.playingUrl = null;
    this.playingNoteId = null;
  }
}
