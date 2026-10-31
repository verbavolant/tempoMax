import { describe, expect, it, vi } from 'vitest';
import { type AudioNote, startVisit } from '../../src/model/visit';
import { AudioCatalog, catalogNoteFromDriveFile, mergeCatalog } from '../../src/storage/audioCatalog';

const file = (name: string, appProperties: Record<string, string> = {}) => ({
  id: `drive-${name}`,
  name,
  webViewLink: null,
  appProperties,
});

describe('catalogNoteFromDriveFile', () => {
  it('legge i dati dalle proprietà private', () => {
    expect(
      catalogNoteFromDriveFile(
        file('2026-10-31_v-1_a-1.m4a', {
          kind: 'visit',
          recordedAt: '2026-10-31T09:10:00+01:00',
          durationSeconds: '12.5',
          visitId: 'v-1',
        }),
      ),
    ).toEqual({
      noteId: 'a-1',
      kind: 'visit',
      recordedAt: '2026-10-31T09:10:00+01:00',
      durationSeconds: 12.5,
      visitId: 'v-1',
      driveFileId: 'drive-2026-10-31_v-1_a-1.m4a',
    });
  });

  it('senza proprietà ricava tipo, data e visita dal nome, anche con id che contengono trattini', () => {
    expect(catalogNoteFromDriveFile(file('2026-10-30_libera_9f1c-22.m4a'))).toMatchObject({
      noteId: '9f1c-22',
      kind: 'free',
      recordedAt: '2026-10-30',
      durationSeconds: null,
      visitId: null,
    });
    expect(catalogNoteFromDriveFile(file('2026-10-30_6d2a-11_9f1c-22.webm'))).toMatchObject({
      kind: 'visit',
      visitId: '6d2a-11',
      noteId: '9f1c-22',
    });
  });

  it('ignora file che non sono note di TempoMax', () => {
    expect(catalogNoteFromDriveFile(file('foto.jpg'))).toBeNull();
  });
});

describe('mergeCatalog', () => {
  const localNote = (id: string, recordedAt: string, driveFileId: string | null = null): AudioNote => ({
    id,
    recordedAt,
    mimeType: 'audio/mp4',
    durationSeconds: 5,
    driveFileId,
    driveLink: null,
  });

  it('aggiunge le note ancora sul telefono, senza duplicare quelle già su Drive, dalla più recente', () => {
    const onDrive = catalogNoteFromDriveFile(
      file('2026-10-31_v-1_a-1.m4a', { kind: 'visit', recordedAt: '2026-10-31T09:10:00+01:00', visitId: 'v-1' }),
    );
    if (!onDrive) throw new Error('nota non riconosciuta');
    const visit = {
      ...startVisit('2026-10-31T09:00:00+01:00'),
      id: 'v-1',
      audio: [localNote('a-1', '2026-10-31T09:10:00+01:00', 'f-1'), localNote('a-2', '2026-10-31T09:20:00+01:00')],
    };
    const merged = mergeCatalog([onDrive], [visit], [localNote('n-1', '2026-10-31T18:00:00+01:00')]);
    expect(merged.map((note) => [note.noteId, note.kind, note.visitId])).toEqual([
      ['n-1', 'free', null],
      ['a-2', 'visit', 'v-1'],
      ['a-1', 'visit', 'v-1'],
    ]);
  });
});

describe('AudioCatalog.listYear', () => {
  it("elenca la cartella audio dell'anno con una sola richiesta", async () => {
    const drive = {
      ensureFolderPath: vi.fn().mockResolvedValue('audio-2026'),
      listFiles: vi.fn().mockResolvedValue([file('2026-10-31_libera_n-1.m4a', { kind: 'free' }), file('altro.txt')]),
      downloadFile: vi.fn(),
    };
    const notes = await new AudioCatalog(drive).listYear('2026');
    expect(drive.ensureFolderPath).toHaveBeenCalledWith(['TempoMax', 'audio', '2026']);
    expect(drive.listFiles).toHaveBeenCalledWith('audio-2026', 1000);
    expect(notes.map((note) => note.noteId)).toEqual(['n-1']);
  });
});
