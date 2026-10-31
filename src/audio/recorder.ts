// In ordine di preferenza. Safari registra in MP4 con AAC (WebKit, "MediaRecorder API", blog 11353);
// Chrome e Firefox di solito in WebM/Opus.
const PREFERRED_MIME_TYPES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'] as const;

// Blocchi da un secondo: se la registrazione si interrompe per errore, i secondi già registrati restano.
const CHUNK_MILLISECONDS = 1_000;

/** Il primo formato supportato, oppure undefined per lasciare scegliere al browser. */
export function chooseAudioMimeType(isTypeSupported: (mimeType: string) => boolean): string | undefined {
  return PREFERRED_MIME_TYPES.find((mimeType) => isTypeSupported(mimeType));
}

export interface RecordedAudio {
  audio: Blob;
  durationSeconds: number;
}

/** Una registrazione dal microfono, avviata con `AudioRecording.start()`. */
export class AudioRecording {
  private readonly chunks: Blob[] = [];
  private readonly startedAt = Date.now();

  private constructor(
    private readonly stream: MediaStream,
    private readonly recorder: MediaRecorder,
  ) {
    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    });
    recorder.start(CHUNK_MILLISECONDS);
  }

  /** Chiede il permesso del microfono (solo HTTPS) e inizia a registrare. */
  static async start(): Promise<AudioRecording> {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      throw new Error('Questo browser non può registrare audio');
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = chooseAudioMimeType((candidate) => MediaRecorder.isTypeSupported(candidate));
    return new AudioRecording(stream, new MediaRecorder(stream, mimeType ? { mimeType } : undefined));
  }

  elapsedSeconds(): number {
    return (Date.now() - this.startedAt) / 1000;
  }

  stop(): Promise<RecordedAudio> {
    return new Promise((resolve, reject) => {
      this.recorder.addEventListener('stop', () => {
        this.releaseMicrophone();
        const audio = new Blob(this.chunks, { type: this.recorder.mimeType });
        if (audio.size === 0) {
          reject(new Error('Registrazione vuota'));
          return;
        }
        resolve({ audio, durationSeconds: this.elapsedSeconds() });
      });
      this.recorder.addEventListener('error', () => {
        this.releaseMicrophone();
        reject(new Error('Errore durante la registrazione'));
      });
      this.recorder.stop();
    });
  }

  /** Spegne il microfono (l'indicatore di registrazione del telefono si spegne). */
  private releaseMicrophone(): void {
    this.stream.getTracks().forEach((track) => track.stop());
  }
}
