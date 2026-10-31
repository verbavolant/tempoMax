// In ordine di preferenza: AAC in MP4 (.m4a) si riproduce quasi ovunque, anche nell'anteprima sul PC.
// Safari registra in MP4 con AAC (WebKit, "MediaRecorder API", blog 11353). Chrome con il solo "audio/mp4"
// sceglie Opus in MP4 (osservato su Chrome 156), da qui il codec esplicito mp4a.40.2 (AAC-LC) per primo.
const PREFERRED_MIME_TYPES = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'] as const;

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
    private readonly requestedMimeType: string | undefined,
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
    return new AudioRecording(stream, new MediaRecorder(stream, mimeType ? { mimeType } : undefined), mimeType);
  }

  elapsedSeconds(): number {
    return (Date.now() - this.startedAt) / 1000;
  }

  stop(): Promise<RecordedAudio> {
    return new Promise((resolve, reject) => {
      this.recorder.addEventListener('stop', () => {
        this.releaseMicrophone();
        // Se il browser non dichiara il formato si usa quello richiesto; senza nessuno dei due, binario generico.
        const type = this.recorder.mimeType || this.requestedMimeType || 'application/octet-stream';
        const audio = new Blob(this.chunks, { type });
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
