import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkPeriod } from '../../src/model/work';
import { LocalWorkStore } from '../../src/storage/localWork';
import { WorkSession, type WorkSessionDependencies } from '../../src/work/workSession';

function memoryStorage() {
  const items = new Map<string, string>();
  return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) };
}

function setup(overrides: Partial<WorkSessionDependencies> = {}) {
  const storage = memoryStorage();
  const saved: WorkPeriod[] = [];
  const repository = { save: vi.fn(async (period: WorkPeriod) => void saved.push({ ...period })) };
  const register = { save: vi.fn<(period: WorkPeriod) => Promise<void>>().mockResolvedValue() };
  let clock = new Date(Date.UTC(2026, 9, 31, 6, 30, 0));
  const authorizedCalls: number[] = [];
  const dependencies: WorkSessionDependencies = {
    store: new LocalWorkStore(storage),
    repository,
    register,
    authorized: (action) => {
      authorizedCalls.push(1);
      return action();
    },
    now: () => clock,
    deviceName: () => 'iPhone di prova',
    ...overrides,
  };
  return {
    storage,
    saved,
    repository,
    register,
    authorizedCalls,
    dependencies,
    session: new WorkSession(dependencies),
    advance: (minutes: number) => {
      clock = new Date(clock.getTime() + minutes * 60_000);
    },
  };
}

describe('WorkSession', () => {
  beforeEach(() => {
    vi.stubEnv('TZ', 'Europe/Rome');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('inizio: registra l’orario al tocco, chiede il token nel tocco e salva su Drive', async () => {
    const { session, saved, register, authorizedCalls } = setup();
    const done = session.start();
    expect(session.view().currentPeriod).toMatchObject({ start: '2026-10-31T07:30:00+01:00', end: null });
    expect(authorizedCalls).toHaveLength(1);
    await done;
    expect(saved).toHaveLength(1);
    expect(register.save).toHaveBeenCalledTimes(1);
    expect(session.view().unsyncedCount).toBe(0);
  });

  it('registra nel periodo il nome del dispositivo', async () => {
    const { session, saved } = setup();
    await session.start();
    expect(saved[0]?.device).toBe('iPhone di prova');
  });

  it('pausa pranzo: due periodi, il totale esclude la pausa', async () => {
    const { session, advance } = setup();
    await session.start();
    advance(5 * 60);
    await session.stop();
    advance(60);
    await session.start();
    advance(90);
    expect(session.view().currentPeriod).not.toBeNull();
    expect(session.view().todayMilliseconds).toBe((5 * 60 + 90) * 60_000);
    expect(session.view().periodsToday).toBe(2);
  });

  it('un secondo "Inizio" mentre si lavora non apre un altro periodo', async () => {
    const { session } = setup();
    await session.start();
    const first = session.view().currentPeriod;
    await session.start();
    expect(session.view().currentPeriod).toBe(first);
  });

  it('il periodo in corso sopravvive alla riapertura dell’app', async () => {
    const { session, storage, dependencies } = setup();
    await session.start();
    const reopened = new WorkSession({ ...dependencies, store: new LocalWorkStore(storage) });
    expect(reopened.view().currentPeriod?.id).toBe(session.view().currentPeriod?.id);
  });

  it('senza Drive resta in coda e viene salvato al tocco successivo', async () => {
    const { session, repository, advance, saved } = setup();
    repository.save.mockRejectedValueOnce(new Error('rete assente'));
    await session.start();
    expect(session.view()).toMatchObject({
      unsyncedCount: 1,
      notice: 'Orario salvato sul telefono, non ancora su Drive: rete assente',
    });
    advance(60);
    await session.stop();
    expect(session.view()).toMatchObject({ unsyncedCount: 0, notice: null });
    expect(saved.at(-1)?.end).toBe('2026-10-31T08:30:00+01:00');
  });

  it('una fine arrivata mentre l’inizio si sta salvando viene salvata a sua volta', async () => {
    let releaseFirstSave!: () => void;
    const firstSave = new Promise<void>((resolve) => {
      releaseFirstSave = resolve;
    });
    const repository = { save: vi.fn<(period: WorkPeriod) => Promise<void>>().mockReturnValueOnce(firstSave).mockResolvedValue() };
    const { session, advance } = setup({ repository });
    const started = session.start();
    // Il primo salvataggio deve essere già partito (con la versione aperta) quando arriva la fine.
    await vi.waitFor(() => expect(repository.save).toHaveBeenCalledTimes(1));
    expect(repository.save).toHaveBeenLastCalledWith(expect.objectContaining({ end: null }));
    advance(30);
    const stopped = session.stop();
    releaseFirstSave();
    await Promise.all([started, stopped]);
    expect(repository.save).toHaveBeenLastCalledWith(expect.objectContaining({ end: '2026-10-31T08:00:00+01:00' }));
    expect(session.view().unsyncedCount).toBe(0);
  });
});
