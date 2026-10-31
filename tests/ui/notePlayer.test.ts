import { describe, expect, it, vi } from 'vitest';
import { loadNoteAudio } from '../../src/ui/notePlayer';

function dependencies(local: Blob | null) {
  const fromDrive = new Blob(['drive'], { type: 'audio/mp4' });
  const logins = { count: 0 };
  return {
    fromDrive,
    logins,
    deps: {
      audioStore: { get: vi.fn().mockResolvedValue(local) },
      download: vi.fn().mockResolvedValue(fromDrive),
      authorized: <T>(action: () => Promise<T>) => {
        logins.count += 1;
        return action();
      },
    },
  };
}

describe('loadNoteAudio', () => {
  it('usa la copia sul telefono senza chiamare Drive', async () => {
    const local = new Blob(['locale'], { type: 'audio/mp4' });
    const { deps } = dependencies(local);
    await expect(loadNoteAudio({ noteId: 'a-1', driveFileId: 'f-1' }, deps, new Map())).resolves.toBe(local);
    expect(deps.download).not.toHaveBeenCalled();
  });

  it('altrimenti scarica da Drive (con login) una sola volta', async () => {
    const { deps, fromDrive, logins } = dependencies(null);
    const cache = new Map<string, Blob>();
    await expect(loadNoteAudio({ noteId: 'a-1', driveFileId: 'f-1' }, deps, cache)).resolves.toBe(fromDrive);
    await expect(loadNoteAudio({ noteId: 'a-1', driveFileId: 'f-1' }, deps, cache)).resolves.toBe(fromDrive);
    expect(deps.download).toHaveBeenCalledTimes(1);
    expect(logins.count).toBe(1);
  });

  it('senza copia locale né file su Drive lo dice', async () => {
    const { deps } = dependencies(null);
    await expect(loadNoteAudio({ noteId: 'a-1', driveFileId: null }, deps, new Map())).rejects.toThrow(
      'file non presente né sul telefono né su Drive',
    );
  });
});
