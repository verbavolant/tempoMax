import { describe, expect, it, vi } from 'vitest';
import type { Task } from '../../src/model/task';
import { TasksRepository, mergeTasks } from '../../src/storage/tasksRepository';

const task = (id: string, dueDate: string | null = null): Task => ({
  id,
  kind: 'todo',
  createdAt: '2026-11-02T09:10:00+01:00',
  dueDate,
  completedAt: null,
  text: 'testo',
  audio: null,
  visitId: null,
  clientId: null,
  device: null,
});

describe('mergeTasks', () => {
  it('le modifiche locali non salvate vincono, le altre vengono da Drive, nessuna si perde', () => {
    const remote = [task('su-drive', '2026-11-05'), task('modificato-qui', '2026-11-05'), task('altro-telefono')];
    const local = [task('su-drive', '2026-11-03'), task('modificato-qui', '2026-11-09'), task('solo-qui')];
    const merged = mergeTasks(remote, local, ['modificato-qui', 'solo-qui']);
    expect(Object.fromEntries(merged.map((current) => [current.id, current.dueDate]))).toEqual({
      'su-drive': '2026-11-05',
      'modificato-qui': '2026-11-09',
      'solo-qui': null,
      'altro-telefono': null,
    });
  });
});

describe('TasksRepository', () => {
  function fakeDrive(existing: unknown) {
    return {
      ensureFolderPath: vi.fn().mockResolvedValue('root'),
      findFile: vi.fn().mockResolvedValue(existing ? 'tasks-file' : null),
      readJson: vi.fn().mockResolvedValue(existing),
      writeJson: vi.fn().mockResolvedValue('tasks-file'),
    };
  }

  it('senza task.json restituisce un elenco vuoto', async () => {
    await expect(new TasksRepository(fakeDrive(null)).load()).resolves.toEqual([]);
  });

  it('legge e scrive task.json nella cartella principale', async () => {
    const drive = fakeDrive({ schemaVersion: 1, tasks: [task('a')] });
    const repository = new TasksRepository(drive);
    await expect(repository.load()).resolves.toEqual([task('a')]);
    await repository.saveAll([task('a'), task('b')]);
    expect(drive.writeJson).toHaveBeenCalledWith('task.json', 'root', { schemaVersion: 1, tasks: [task('a'), task('b')] });
  });
});
