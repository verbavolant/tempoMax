import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../../src/model/task';
import type { AudioNote } from '../../src/model/visit';
import type { AudioOwner } from '../../src/storage/audioUploader';
import { FileTooLargeError } from '../../src/storage/drive';
import { LocalTaskStore } from '../../src/storage/localTasks';
import { TaskSession, type TaskSessionDependencies } from '../../src/tasks/taskSession';

const note: AudioNote = {
  id: 'a-1',
  recordedAt: '2026-11-02T09:10:00+01:00',
  mimeType: 'audio/mp4',
  durationSeconds: 6,
  driveFileId: null,
  driveLink: null,
  device: 'iPhone di prova',
  position: null,
};

function memoryStorage() {
  const items = new Map<string, string>();
  return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) };
}

function setup(overrides: Partial<TaskSessionDependencies> = {}) {
  let remote: Task[] = [];
  const repository = {
    load: vi.fn(async () => remote),
    saveAll: vi.fn(async (tasks: readonly Task[]) => {
      remote = structuredClone([...tasks]);
    }),
  };
  const register = { save: vi.fn<(task: Task, clientName: string | null) => Promise<void>>().mockResolvedValue() };
  const audio = {
    upload: vi.fn<(owner: AudioOwner, note: AudioNote) => Promise<{ fileId: string; link: string } | null>>(async (_owner, current) => ({
      fileId: `drive-${current.id}`,
      link: `https://drive.example/${current.id}`,
    })),
    deleteLocal: vi.fn<(noteId: string) => Promise<void>>().mockResolvedValue(),
  };
  const authorizedCalls: number[] = [];
  const dependencies: TaskSessionDependencies = {
    store: new LocalTaskStore(memoryStorage()),
    repository,
    register,
    audio,
    loadClients: vi.fn().mockResolvedValue([{ id: 'c-1', name: 'Villa Rossi', radiusMeters: 200, createdAt: '2026-10-30T09:00:00+01:00' }]),
    authorized: (action) => {
      authorizedCalls.push(1);
      return action();
    },
    now: () => new Date(Date.UTC(2026, 10, 2, 8, 30)),
    deviceName: () => 'iPhone di prova',
    ...overrides,
  };
  return {
    session: new TaskSession(dependencies),
    repository,
    register,
    audio,
    authorizedCalls,
    remote: () => remote,
    setRemote: (tasks: Task[]) => {
      remote = tasks;
    },
  };
}

describe('TaskSession', () => {
  beforeEach(() => {
    vi.stubEnv('TZ', 'Europe/Rome');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('un "da fare" vocale si salva subito sul telefono e poi su Drive con audio, foglio e cliente', async () => {
    const { session, register, audio, remote, authorizedCalls } = setup();
    const created = session.addVoiceTask({ audio: note, dueDate: '2026-11-03', visitId: 'v-1', clientId: 'c-1' });
    expect(session.view().open.map((task) => task.id)).toEqual([created.id]);
    expect(created).toMatchObject({ createdAt: '2026-11-02T09:30:00+01:00', device: 'iPhone di prova' });

    const sync = session.syncAfter(Promise.resolve());
    expect(authorizedCalls).toHaveLength(1);
    await sync;

    expect(audio.upload).toHaveBeenCalledWith({ kind: 'todo', taskId: created.id }, note);
    expect(audio.deleteLocal).toHaveBeenCalledWith('a-1');
    expect(remote()[0]?.audio?.driveLink).toBe('https://drive.example/a-1');
    expect(register.save).toHaveBeenCalledWith(expect.objectContaining({ id: created.id }), 'Villa Rossi');
    expect(session.view().unsyncedCount).toBe(0);
  });

  it('cambia la scadenza e segna come fatto, poi di nuovo da fare', async () => {
    const { session, remote } = setup();
    const created = session.addVoiceTask({ audio: note, dueDate: '2026-11-03', visitId: null, clientId: null });
    await session.setDueDate(created.id, null);
    expect(remote()[0]?.dueDate).toBeNull();

    await session.setDone(created.id, true);
    expect(session.view().open).toEqual([]);
    expect(session.view().recentlyDone[0]?.completedAt).toBe('2026-11-02T09:30:00+01:00');

    await session.setDone(created.id, false);
    expect(session.view().open.map((task) => task.id)).toEqual([created.id]);
  });

  it('rileggendo unisce le attività create da un altro telefono', async () => {
    const { session, setRemote } = setup();
    const other: Task = {
      id: 'altro-telefono',
      kind: 'todo',
      createdAt: '2026-11-01T10:00:00+01:00',
      dueDate: '2026-11-02',
      completedAt: null,
      text: 'Potare la siepe',
      audio: null,
      visitId: null,
      clientId: null,
      device: 'Android di Luca',
    };
    setRemote([other]);
    await session.refresh();
    expect(session.view().open.map((task) => task.id)).toEqual(['altro-telefono']);
  });

  it('senza rete resta in coda e viene salvato al tocco successivo', async () => {
    const { session, repository, remote } = setup();
    repository.load.mockRejectedValueOnce(new Error('rete assente'));
    const created = session.addVoiceTask({ audio: note, dueDate: null, visitId: null, clientId: null });
    await session.syncAfter(Promise.resolve());
    expect(session.view()).toMatchObject({ unsyncedCount: 1, notice: 'Salvato sul telefono, non ancora su Drive: rete assente' });

    await session.refresh();
    expect(session.view()).toMatchObject({ unsyncedCount: 0, notice: null });
    expect(remote().map((task) => task.id)).toEqual([created.id]);
  });

  it('una modifica arrivata durante il salvataggio resta in coda e non viene sovrascritta', async () => {
    let releaseLoad!: () => void;
    const loadStarted = new Promise<void>((resolve) => {
      releaseLoad = resolve;
    });
    const { session, repository, remote } = setup();
    const created = session.addVoiceTask({ audio: note, dueDate: '2026-11-03', visitId: null, clientId: null });
    repository.load.mockImplementationOnce(async () => {
      await loadStarted;
      return [];
    });
    const firstSync = session.syncAfter(Promise.resolve());
    await vi.waitFor(() => expect(repository.load).toHaveBeenCalledTimes(1));

    const secondSync = session.setDueDate(created.id, '2026-11-09');
    releaseLoad();
    await Promise.all([firstSync, secondSync]);

    expect(session.view().open[0]?.dueDate).toBe('2026-11-09');
    expect(remote()[0]?.dueDate).toBe('2026-11-09');
    expect(session.view().unsyncedCount).toBe(0);
  });

  it('una nota troppo grande viene segnalata senza bloccare il salvataggio', async () => {
    const { session, audio, remote } = setup();
    audio.upload.mockRejectedValueOnce(new FileTooLargeError(6_000_000));
    session.addVoiceTask({ audio: note, dueDate: null, visitId: null, clientId: null });
    await session.syncAfter(Promise.resolve());
    expect(remote()).toHaveLength(1);
    expect(session.view().notice).toBe('Nota del "da fare" non caricata: File troppo grande (6000000 byte): limite 5000000');
  });
});
