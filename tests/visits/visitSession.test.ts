import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '../../src/model/client';
import type { MeasuredPosition } from '../../src/model/position';
import type { AudioNote, Visit } from '../../src/model/visit';
import type { AudioOwner } from '../../src/storage/audioUploader';
import { FileTooLargeError } from '../../src/storage/drive';
import { LocalVisitStore } from '../../src/storage/localVisits';
import { VisitSession, type VisitSessionDependencies } from '../../src/visits/visitSession';

const villa: Client = {
  id: 'c-villa',
  name: 'Villa Rossi',
  location: { latitude: 45.4642, longitude: 9.19 },
  radiusMeters: 150,
  createdAt: '2026-10-30T09:00:00+01:00',
};
const atVilla: MeasuredPosition = { latitude: 45.4643, longitude: 9.19, accuracyMeters: 10 };
const farAway: MeasuredPosition = { latitude: 45.6, longitude: 9.19, accuracyMeters: 10 };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

function memoryStorage() {
  const items = new Map<string, string>();
  return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) };
}

function setup(overrides: Partial<VisitSessionDependencies> = {}) {
  const storage = memoryStorage();
  const saved: Visit[] = [];
  const repository = { save: vi.fn(async (visit: Visit) => void saved.push(structuredClone(visit))) };
  const register = { save: vi.fn<(visit: Visit, clientName: string | null) => Promise<void>>().mockResolvedValue() };
  const audio = {
    upload: vi.fn<(owner: AudioOwner, note: AudioNote) => Promise<{ fileId: string; link: string } | null>>(async (_owner, note) => ({
      fileId: `drive-${note.id}`,
      link: `https://drive.example/${note.id}`,
    })),
    deleteLocal: vi.fn<(noteId: string) => Promise<void>>().mockResolvedValue(),
  };
  let clock = new Date(Date.UTC(2026, 9, 31, 8, 0, 0));
  const authorizedCalls: number[] = [];
  const dependencies: VisitSessionDependencies = {
    store: new LocalVisitStore(storage),
    repository,
    register,
    audio,
    loadClients: vi.fn().mockResolvedValue([villa]),
    readPosition: vi.fn().mockResolvedValue(atVilla),
    authorized: (action) => {
      authorizedCalls.push(Date.now());
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
    audio,
    authorizedCalls,
    dependencies,
    session: new VisitSession(dependencies),
    advance: (minutes: number) => {
      clock = new Date(clock.getTime() + minutes * 60_000);
    },
    lastSaved: () => saved.at(-1),
  };
}

describe('VisitSession', () => {
  beforeEach(() => {
    vi.stubEnv('TZ', 'Europe/Rome');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("al tap registra subito l'orario in locale, prima che il GPS risponda", () => {
    const gps = deferred<MeasuredPosition>();
    const { session, storage, authorizedCalls, dependencies } = setup({ readPosition: () => gps.promise });

    void session.toggle();

    expect(session.view().openVisit?.checkIn).toEqual({ at: '2026-10-31T09:00:00+01:00', position: null });
    expect(new VisitSession({ ...dependencies, store: new LocalVisitStore(storage) }).view().openVisit?.id).toBe(
      session.view().openVisit?.id,
    );
    // Il token va chiesto nel tap stesso, non dopo un await.
    expect(authorizedCalls).toHaveLength(1);
  });

  it('registra nella visita il nome del dispositivo', async () => {
    const { session, lastSaved } = setup();
    await session.toggle();
    expect(lastSaved()?.device).toBe('iPhone di prova');
    expect(session.currentDeviceName()).toBe('iPhone di prova');
  });

  it('associa il cliente entro il raggio e salva su Drive con la posizione', async () => {
    const { session, lastSaved } = setup();
    await session.toggle();
    expect(lastSaved()).toMatchObject({ clientId: 'c-villa', checkIn: { position: atVilla }, checkOut: null });
    expect(session.view()).toMatchObject({ clientName: 'Villa Rossi', notice: null });
  });

  it('fuori da ogni raggio la visita resta senza cliente', async () => {
    const { session, lastSaved } = setup({ readPosition: vi.fn().mockResolvedValue(farAway) });
    await session.toggle();
    expect(lastSaved()).toMatchObject({ clientId: null, checkIn: { position: farAway } });
    expect(session.view().clientName).toBeNull();
  });

  it('senza GPS la visita parte lo stesso, con un avviso', async () => {
    const { session, lastSaved, dependencies } = setup({
      readPosition: vi.fn().mockRejectedValue(new Error('Permesso di posizione negato')),
    });
    await session.toggle();
    expect(lastSaved()).toMatchObject({ clientId: null, checkIn: { position: null } });
    expect(dependencies.loadClients).not.toHaveBeenCalled();
    expect(session.view().notice).toBe('Posizione non rilevata: Permesso di posizione negato');
  });

  it("se l'anagrafica non si carica, la posizione resta salvata in locale", async () => {
    const { session } = setup({ loadClients: vi.fn().mockRejectedValue(new Error('offline')) });
    await session.toggle();
    expect(session.view().openVisit?.checkIn.position).toEqual(atVilla);
    expect(session.view().notice).toBe('Salvata sul telefono, non ancora su Drive: offline');
  });

  it('il check-out chiude la visita, la salva su Drive e svuota la coda', async () => {
    const { session, advance, lastSaved } = setup();
    await session.toggle();
    advance(150);
    await session.toggle();
    expect(lastSaved()).toMatchObject({
      clientId: 'c-villa',
      checkIn: { at: '2026-10-31T09:00:00+01:00', position: atVilla },
      checkOut: { at: '2026-10-31T11:30:00+01:00', position: atVilla },
    });
    expect(session.view()).toMatchObject({ openVisit: null, unsyncedCount: 0 });
  });

  it('se Drive fallisce la visita chiusa resta in coda e viene risalvata al tap successivo', async () => {
    const { session, repository, advance, saved } = setup();
    await session.toggle();
    advance(60);
    repository.save.mockRejectedValueOnce(new Error('rete assente'));
    await session.toggle();
    expect(session.view()).toMatchObject({ unsyncedCount: 1, notice: 'Salvata sul telefono, non ancora su Drive: rete assente' });

    advance(30);
    await session.toggle();
    expect(session.view()).toMatchObject({ unsyncedCount: 0, notice: null });
    const closedId = saved.find((visit) => visit.checkOut)?.id;
    expect(saved.filter((visit) => visit.id === closedId && visit.checkOut).length).toBeGreaterThan(0);
  });

  it('un check-out prima della risposta del GPS del check-in non perde posizione né cliente', async () => {
    const checkInGps = deferred<MeasuredPosition>();
    const readPosition = vi.fn().mockReturnValueOnce(checkInGps.promise).mockResolvedValue(farAway);
    const { session, advance, lastSaved } = setup({ readPosition });

    const checkIn = session.toggle();
    advance(1);
    const checkOut = session.toggle();
    checkInGps.resolve(atVilla);
    await Promise.all([checkIn, checkOut]);

    expect(lastSaved()).toMatchObject({
      clientId: 'c-villa',
      checkIn: { position: atVilla },
      checkOut: { position: farAway },
    });
    expect(session.view().unsyncedCount).toBe(0);
  });

  it('senza login (es. modalità aereo) la posizione del check-in e del check-out viene comunque salvata sul telefono', async () => {
    const { session, advance } = setup({ authorized: () => Promise.reject(new Error('nessuna connessione')) });
    await session.toggle();
    expect(session.view().openVisit?.checkIn.position).toEqual(atVilla);
    advance(30);
    await session.toggle();
    expect(session.localVisits()[0]?.checkOut?.position).toEqual(atVilla);
    expect(session.view().notice).toBe('Salvata sul telefono, non ancora su Drive: nessuna connessione');
  });

  it('se il login Google fallisce la visita resta sul telefono', async () => {
    const { session, repository } = setup({ authorized: () => Promise.reject(new Error('Finestra di accesso chiusa')) });
    await session.toggle();
    expect(repository.save).not.toHaveBeenCalled();
    expect(session.view().openVisit).not.toBeNull();
    expect(session.view().notice).toBe('Salvata sul telefono, non ancora su Drive: Finestra di accesso chiusa');
  });

  it('dopo il JSON aggiorna il registro con il nome del cliente', async () => {
    const { session, register, advance } = setup();
    await session.toggle();
    advance(30);
    await session.toggle();
    const [lastVisit, clientName] = register.save.mock.calls.at(-1) ?? [];
    expect(clientName).toBe('Villa Rossi');
    expect(lastVisit?.checkOut?.at).toBe('2026-10-31T09:30:00+01:00');
  });

  it('se il registro fallisce la visita chiusa resta in coda', async () => {
    const { session, register, advance } = setup();
    await session.toggle();
    advance(30);
    register.save.mockRejectedValueOnce(new Error('Google Drive ha risposto 500'));
    await session.toggle();
    expect(session.view()).toMatchObject({ unsyncedCount: 1 });
  });

  describe('assignClient', () => {
    it('sulla visita in corso cambia il cliente e lo mantiene dopo la risposta del GPS', async () => {
      const gps = deferred<MeasuredPosition>();
      const { session, lastSaved } = setup({ readPosition: () => gps.promise });
      const checkIn = session.toggle();
      const open = session.view().openVisit;
      if (!open) throw new Error('visita non aperta');

      const assigned = session.assignClient(open, 'c-altro');
      gps.resolve(atVilla);
      await Promise.all([checkIn, assigned]);

      expect(lastSaved()).toMatchObject({ id: open.id, clientId: 'c-altro', checkIn: { position: atVilla } });
    });

    it('su una visita letta da Drive la salva con il nuovo cliente, JSON e registro', async () => {
      const { session, lastSaved, register } = setup();
      const fromDrive: Visit = {
        schemaVersion: 1,
        id: 'v-drive',
        clientId: null,
        checkIn: { at: '2026-10-30T09:00:00+01:00', position: null },
        checkOut: { at: '2026-10-30T10:00:00+01:00', position: null },
        note: '',
        audio: [],
        device: null,
      };
      await session.assignClient(fromDrive, 'c-villa');
      expect(lastSaved()).toEqual({ ...fromDrive, clientId: 'c-villa' });
      expect(register.save).toHaveBeenLastCalledWith({ ...fromDrive, clientId: 'c-villa' }, 'Villa Rossi');
      expect(session.view().unsyncedCount).toBe(0);
    });

    it('senza rete la modifica resta in coda', async () => {
      const { session, repository } = setup();
      const fromDrive: Visit = {
        schemaVersion: 1,
        id: 'v-drive',
        clientId: 'c-villa',
        checkIn: { at: '2026-10-30T09:00:00+01:00', position: null },
        checkOut: { at: '2026-10-30T10:00:00+01:00', position: null },
        note: '',
        audio: [],
        device: null,
      };
      repository.save.mockRejectedValueOnce(new Error('rete assente'));
      await session.assignClient(fromDrive, null);
      expect(session.view().unsyncedCount).toBe(1);
    });
  });

  describe('note audio', () => {
    const note = {
      id: 'a-1',
      recordedAt: '2026-10-31T09:10:00+01:00',
      mimeType: 'audio/mp4',
      durationSeconds: 12,
      driveFileId: null,
      driveLink: null,
      device: null,
      position: null,
    };

    it('aggiunge e toglie una nota dalla visita in corso, in locale', async () => {
      const { session, storage, dependencies } = setup();
      await session.toggle();
      const openId = session.view().openVisit?.id ?? '';

      session.addAudio(openId, note);
      expect(session.view().openVisit?.audio).toEqual([note]);
      const reloaded = new VisitSession({ ...dependencies, store: new LocalVisitStore(storage) });
      expect(reloaded.view().openVisit?.audio).toEqual([note]);

      session.removeAudio(openId, 'a-1');
      expect(session.view().openVisit?.audio).toEqual([]);
    });

    it('una nota fermata dopo FINE finisce nella visita chiusa e viene risalvata al tap successivo', async () => {
      const { session, advance, saved } = setup();
      await session.toggle();
      const visitId = session.view().openVisit?.id ?? '';
      advance(10);
      await session.toggle();
      expect(session.view().unsyncedCount).toBe(0);

      session.addAudio(visitId, note);
      expect(session.view().unsyncedCount).toBe(1);

      advance(5);
      await session.toggle();
      const lastVersion = saved.filter((visit) => visit.id === visitId).at(-1);
      expect(lastVersion).toMatchObject({
        checkOut: { at: '2026-10-31T09:10:00+01:00' },
        audio: [{ ...note, driveFileId: 'drive-a-1', driveLink: 'https://drive.example/a-1' }],
      });
      expect(session.view().unsyncedCount).toBe(0);
    });

    it('al salvataggio carica le note, salva id e link nel JSON e cancella la copia locale', async () => {
      const { session, audio, saved } = setup();
      await session.toggle();
      const visitId = session.view().openVisit?.id ?? '';
      session.addAudio(visitId, note);
      await session.toggle();

      expect(audio.upload).toHaveBeenCalledTimes(1);
      expect(audio.deleteLocal).toHaveBeenCalledWith('a-1');
      const savedNotes = saved.filter((visit) => visit.id === visitId).at(-1)?.audio;
      expect(savedNotes).toEqual([{ ...note, driveFileId: 'drive-a-1', driveLink: 'https://drive.example/a-1' }]);
    });

    it('non ricarica una nota già su Drive', async () => {
      const { session, audio } = setup();
      await session.toggle();
      const visitId = session.view().openVisit?.id ?? '';
      session.addAudio(visitId, { ...note, driveFileId: 'già-su-drive', driveLink: 'https://drive.example/x' });
      await session.toggle();
      expect(audio.upload).not.toHaveBeenCalled();
    });

    it('se il caricamento fallisce per la rete la visita resta in coda e la copia locale resta', async () => {
      const { session, audio, saved } = setup();
      await session.toggle();
      const visitId = session.view().openVisit?.id ?? '';
      session.addAudio(visitId, note);
      audio.upload.mockRejectedValueOnce(new Error('rete assente'));
      await session.toggle();

      expect(session.view()).toMatchObject({ unsyncedCount: 1 });
      expect(audio.deleteLocal).not.toHaveBeenCalled();
      expect(saved.filter((visit) => visit.id === visitId && visit.checkOut)).toEqual([]);
    });

    it('un file troppo grande o mancante viene segnalato ma non blocca la visita', async () => {
      const { session, audio, saved } = setup();
      await session.toggle();
      const visitId = session.view().openVisit?.id ?? '';
      session.addAudio(visitId, note);
      session.addAudio(visitId, { ...note, id: 'a-2' });
      audio.upload.mockRejectedValueOnce(new FileTooLargeError(6_000_000)).mockResolvedValueOnce(null);
      await session.toggle();

      expect(session.view().unsyncedCount).toBe(0);
      expect(saved.filter((visit) => visit.id === visitId).at(-1)?.audio.map((saved) => saved.driveFileId)).toEqual([
        null,
        null,
      ]);
      expect(session.view().notice).toBe('Nota vocale non caricata: il file non è su questo telefono');
    });

    it('una nota libera viene caricata subito con syncAfter, senza visita, ed esce dalla coda', async () => {
      const { session, audio, authorizedCalls } = setup();
      session.addFreeNote(note);
      expect(session.view().pendingFreeNotes).toEqual([note]);

      const recordingStopped = Promise.resolve();
      const sync = session.syncAfter(recordingStopped);
      expect(authorizedCalls).toHaveLength(1);
      await sync;

      expect(audio.upload).toHaveBeenCalledWith({ kind: 'free' }, note);
      expect(audio.deleteLocal).toHaveBeenCalledWith('a-1');
      expect(session.view().pendingFreeNotes).toEqual([]);
    });

    it('senza rete la nota libera resta in coda e sul telefono', async () => {
      const { session, audio } = setup();
      session.addFreeNote(note);
      audio.upload.mockRejectedValueOnce(new Error('rete assente'));
      await session.syncAfter(Promise.resolve());
      expect(session.view().pendingFreeNotes).toEqual([note]);
      expect(audio.deleteLocal).not.toHaveBeenCalled();
      expect(session.view().notice).toBe('Salvata sul telefono, non ancora su Drive: rete assente');
    });

    it('syncAfter aspetta la fine del compito anche se fallisce', async () => {
      const { session, audio } = setup();
      session.addFreeNote(note);
      await session.syncAfter(Promise.reject(new Error('registrazione fallita')));
      expect(audio.upload).toHaveBeenCalledTimes(1);
    });

    it('aggiunge la posizione a una nota della visita anche dopo che è stata salvata su Drive', async () => {
      const { session, advance, saved } = setup();
      await session.toggle();
      const visitId = session.view().openVisit?.id ?? '';
      session.addAudio(visitId, note);
      advance(5);
      await session.toggle();
      expect(session.view().unsyncedCount).toBe(0);

      session.setNotePosition('a-1', farAway);
      expect(session.view().unsyncedCount).toBe(1);
      await session.syncAfter(Promise.resolve());
      expect(saved.filter((visit) => visit.id === visitId).at(-1)?.audio[0]?.position).toEqual(farAway);
    });

    it('aggiunge la posizione a una nota libera non ancora caricata', () => {
      const { session } = setup();
      session.addFreeNote(note);
      session.setNotePosition('a-1', atVilla);
      expect(session.view().pendingFreeNotes[0]?.position).toEqual(atVilla);
    });

    it('readNotePosition restituisce null (con avviso) se il GPS non risponde', async () => {
      const { session } = setup({ readPosition: vi.fn().mockRejectedValue(new Error('timeout')) });
      await expect(session.readNotePosition()).resolves.toBeNull();
      expect(session.view().notice).toBe('Posizione non rilevata: timeout');
    });
  });
});
