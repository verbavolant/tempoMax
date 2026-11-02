import { describe, expect, it, vi } from 'vitest';
import { type AudioNote, startVisit } from '../../src/model/visit';
import { AudioUploader, audioAppProperties, audioFileExtension, audioFileName } from '../../src/storage/audioUploader';

const visit = { ...startVisit('2026-10-31T09:00:00+01:00', null), id: 'v-1' };
const note: AudioNote = {
  id: 'a-1',
  recordedAt: '2026-10-31T09:10:00+01:00',
  mimeType: 'audio/mp4;codecs=mp4a.40.2',
  durationSeconds: 12,
  driveFileId: null,
  driveLink: null,
  device: null,
  position: null,
};

describe('audioFileExtension', () => {
  it.each([
    ['audio/mp4', 'm4a'],
    ['audio/mp4;codecs=mp4a.40.2', 'm4a'],
    ['audio/webm;codecs=opus', 'webm'],
    ['application/octet-stream', 'bin'],
  ])('%s → %s', (mimeType, extension) => {
    expect(audioFileExtension(mimeType)).toBe(extension);
  });
});

describe('audioFileName', () => {
  it('usa la data locale di registrazione, la visita e la nota', () => {
    expect(audioFileName({ kind: 'visit', visit }, note)).toBe('2026-10-31_v-1_a-1.m4a');
  });

  it('per una nota libera usa "libera" al posto della visita', () => {
    expect(audioFileName({ kind: 'free' }, note)).toBe('2026-10-31_libera_a-1.m4a');
  });

  it('per un "da fare" usa "dafare"', () => {
    expect(audioFileName({ kind: 'todo', taskId: 't-1' }, note)).toBe('2026-10-31_dafare_a-1.m4a');
  });
});

describe('audioAppProperties', () => {
  it('"da fare": tipo todo con id dell\'attività', () => {
    expect(audioAppProperties({ kind: 'todo', taskId: 't-1' }, note)).toMatchObject({ kind: 'todo', taskId: 't-1' });
  });

  it('nota libera: tipo free, senza visita', () => {
    expect(audioAppProperties({ kind: 'free' }, note)).toEqual({
      kind: 'free',
      recordedAt: '2026-10-31T09:10:00+01:00',
      durationSeconds: '12',
    });
  });

  it('aggiunge la posizione di inizio registrazione se nota', () => {
    const located = { ...note, position: { latitude: 45.4642, longitude: 9.19, accuracyMeters: 12.4 } };
    expect(audioAppProperties({ kind: 'free' }, located)).toMatchObject({ latitude: '45.4642', longitude: '9.19', accuracyMeters: '12' });
    expect(audioAppProperties({ kind: 'free' }, note)).not.toHaveProperty('latitude');
  });

  it('aggiunge il dispositivo se indicato', () => {
    expect(audioAppProperties({ kind: 'free' }, { ...note, device: 'iPhone di Mario' }).device).toBe('iPhone di Mario');
    expect(audioAppProperties({ kind: 'free' }, note)).not.toHaveProperty('device');
  });

  it('ogni coppia chiave-valore sta nei 124 byte UTF-8 consentiti da Drive', () => {
    const properties = audioAppProperties({ kind: 'visit', visit: { ...visit, id: crypto.randomUUID() } }, { ...note, durationSeconds: 299.999 });
    for (const [key, value] of Object.entries(properties)) {
      expect(new TextEncoder().encode(key + value).length).toBeLessThanOrEqual(124);
    }
  });
});

describe('AudioUploader', () => {
  function setup(local: Blob | null) {
    const drive = {
      ensureFolderPath: vi.fn().mockResolvedValue('audio-2026'),
      uploadFile: vi.fn().mockResolvedValue({ id: 'drive-1', webViewLink: 'https://drive.google.com/file/d/drive-1/view' }),
    };
    const store = { get: vi.fn().mockResolvedValue(local), delete: vi.fn().mockResolvedValue(undefined) };
    return { drive, store, uploader: new AudioUploader(drive, store) };
  }

  it("carica il file nella cartella audio dell'anno e restituisce id e link", async () => {
    const blob = new Blob(['x'], { type: 'audio/mp4' });
    const { drive, uploader } = setup(blob);
    await expect(uploader.upload({ kind: 'visit', visit }, note)).resolves.toEqual({
      fileId: 'drive-1',
      link: 'https://drive.google.com/file/d/drive-1/view',
    });
    expect(drive.ensureFolderPath).toHaveBeenCalledWith(['TempoMax', 'audio', '2026']);
    expect(drive.uploadFile).toHaveBeenCalledWith('2026-10-31_v-1_a-1.m4a', 'audio-2026', blob, {
      kind: 'visit',
      recordedAt: '2026-10-31T09:10:00+01:00',
      durationSeconds: '12',
      visitId: 'v-1',
    });
  });

  it('restituisce null se il file non è sul telefono, senza chiamare Drive', async () => {
    const { drive, uploader } = setup(null);
    await expect(uploader.upload({ kind: 'visit', visit }, note)).resolves.toBeNull();
    expect(drive.uploadFile).not.toHaveBeenCalled();
  });
});
