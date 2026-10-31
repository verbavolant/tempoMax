import { findClientAtPosition } from '../geo/distance';
import type { Client } from '../model/client';
import type { MeasuredPosition } from '../model/position';
import { formatLocalIsoDateTime } from '../model/time';
import { type AudioNote, type Visit, endVisit, parseVisit, startVisit } from '../model/visit';
import { type LocalVisitState, type LocalVisitStore, upsertVisit } from '../storage/localVisits';
import type { AudioUploader, UploadedAudio } from '../storage/audioUploader';
import { FileTooLargeError } from '../storage/drive';
import type { VisitRegister } from '../storage/visitRegister';
import type { VisitsRepository } from '../storage/visitsRepository';

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

export interface VisitSessionDependencies {
  store: Pick<LocalVisitStore, 'load' | 'save'>;
  repository: Pick<VisitsRepository, 'save'>;
  register: Pick<VisitRegister, 'save'>;
  audio: Pick<AudioUploader, 'upload' | 'deleteLocal'>;
  loadClients: () => Promise<Client[]>;
  readPosition: () => Promise<MeasuredPosition>;
  /** Garantisce un token valido prima dell'azione; va chiamato in modo sincrono dentro il tap. */
  authorized: <T>(action: () => Promise<T>) => Promise<T>;
  now: () => Date;
}

export interface VisitSessionView {
  openVisit: Visit | null;
  clientName: string | null;
  unsyncedCount: number;
  /** Note libere registrate e non ancora caricate su Drive. */
  pendingFreeNotes: AudioNote[];
  notice: string | null;
}

/**
 * Logica del pulsante unico. L'orario si registra e si salva in locale al tap;
 * GPS, cliente e Drive arrivano dopo. Le scritture su Drive sono in coda, una alla volta.
 */
export class VisitSession {
  private state: LocalVisitState;
  private clients: Promise<Client[]> | null = null;
  private knownClients: Client[] = [];
  private queue: Promise<void> = Promise.resolve();
  // Ultima versione di ogni visita toccata in questa sessione: un aggiornamento in coda può arrivare
  // dopo che una versione intermedia è già stata salvata su Drive e tolta da `unsyncedVisits`.
  private readonly latestVisits = new Map<string, Visit>();
  private positionNotice: string | null = null;
  private syncError: string | null = null;
  private audioNotice: string | null = null;
  private readonly listeners = new Set<(view: VisitSessionView) => void>();

  /** Lancia se l'archivio locale è corrotto: il chiamante deve mostrarlo, non ripartire da zero. */
  constructor(private readonly dependencies: VisitSessionDependencies) {
    this.state = dependencies.store.load();
  }

  view(): VisitSessionView {
    const clientId = this.state.openVisit?.clientId;
    return {
      openVisit: this.state.openVisit,
      clientName: this.knownClients.find((client) => client.id === clientId)?.name ?? null,
      unsyncedCount: this.state.unsyncedVisits.length,
      pendingFreeNotes: this.state.freeNotes,
      notice: this.syncError ?? this.audioNotice ?? this.positionNotice,
    };
  }

  /** Visite presenti solo o anche sul telefono: quella in corso e quelle in attesa di Drive. */
  localVisits(): Visit[] {
    return [...(this.state.openVisit ? [this.state.openVisit] : []), ...this.state.unsyncedVisits];
  }

  subscribe(listener: (view: VisitSessionView) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Da chiamare quando l'anagrafica cambia, così il prossimo check-in la rilegge. */
  invalidateClients(): void {
    this.clients = null;
  }

  /** Check-in o check-out. Restituisce la promessa delle operazioni in background (utile nei test). */
  toggle(): Promise<void> {
    const at = formatLocalIsoDateTime(this.dependencies.now());
    this.positionNotice = null;
    const position = this.readPositionOrNull();
    const open = this.state.openVisit;
    if (open) {
      const closed = endVisit(open, at);
      this.commit({ ...this.state, openVisit: null, unsyncedVisits: upsertVisit(this.state.unsyncedVisits, closed) });
      return this.enqueueSync(async () => {
        const checkOutPosition = await position;
        this.updateVisit(closed.id, (visit) =>
          visit.checkOut ? { ...visit, checkOut: { ...visit.checkOut, position: checkOutPosition } } : visit,
        );
      });
    }
    const started = startVisit(at);
    this.commit({ ...this.state, openVisit: started });
    return this.enqueueSync(async () => {
      const checkInPosition = await position;
      // Prima la posizione, poi il cliente: se l'anagrafica non si carica, la posizione resta comunque salvata.
      this.updateVisit(started.id, (visit) => ({ ...visit, checkIn: { ...visit.checkIn, position: checkInPosition } }));
      if (!checkInPosition) {
        return;
      }
      const client = findClientAtPosition(checkInPosition, await this.loadClients());
      if (client) {
        this.updateVisit(started.id, (visit) => (visit.clientId ? visit : { ...visit, clientId: client.id }));
      }
    });
  }

  /**
   * Assegna (o toglie, con null) il cliente di una visita. Passa dalla coda come le altre scritture:
   * per la visita in corso o in attesa si modifica la copia locale; per una visita letta da Drive
   * la si mette in coda, così senza rete la modifica viene risalvata al tap successivo.
   */
  assignClient(visit: Visit, clientId: string | null): Promise<void> {
    const isLocal =
      this.state.openVisit?.id === visit.id || this.state.unsyncedVisits.some((pending) => pending.id === visit.id);
    if (isLocal) {
      this.updateVisit(visit.id, (current) => ({ ...current, clientId }));
    } else {
      const updated = parseVisit({ ...visit, clientId });
      this.commit({ ...this.state, unsyncedVisits: upsertVisit(this.state.unsyncedVisits, updated) });
    }
    return this.enqueueSync(async () => undefined);
  }

  /**
   * Aggiunge una nota audio alla visita (in corso, o appena chiusa se FINE è arrivato durante la registrazione).
   * Solo in locale: il JSON su Drive si aggiorna al prossimo salvataggio, il file audio con T-014.
   */
  addAudio(visitId: string, note: AudioNote): void {
    this.updateVisit(visitId, (visit) => ({ ...visit, audio: [...visit.audio, note] }));
  }

  /** Nota registrata senza visita ("Note libere"): resta sul telefono finché non è caricata. */
  addFreeNote(note: AudioNote): void {
    this.commit({ ...this.state, freeNotes: [...this.state.freeNotes, note] });
  }

  removeFreeNote(noteId: string): void {
    this.commit({ ...this.state, freeNotes: this.state.freeNotes.filter((note) => note.id !== noteId) });
  }

  /**
   * Avvia un salvataggio su Drive che parte quando `task` è finito (es. una nota appena fermata).
   * Va chiamato dentro il tocco: `authorized` può così chiedere il token senza popup bloccati.
   */
  syncAfter(task: Promise<unknown>): Promise<void> {
    return this.enqueueSync(async () => {
      // L'esito di `task` è gestito da chi lo ha avviato: qui serve solo aspettarlo.
      await task.catch(() => undefined);
    });
  }

  removeAudio(visitId: string, noteId: string): void {
    this.updateVisit(visitId, (visit) => ({ ...visit, audio: visit.audio.filter((note) => note.id !== noteId) }));
  }

  private async readPositionOrNull(): Promise<MeasuredPosition | null> {
    try {
      return await this.dependencies.readPosition();
    } catch (error) {
      // Senza posizione la visita vale lo stesso (ADR-006): lo si dice, ma non si blocca nulla.
      this.positionNotice = `Posizione non rilevata: ${errorText(error)}`;
      this.emit();
      return null;
    }
  }

  private loadClients(): Promise<Client[]> {
    this.clients ??= this.dependencies.loadClients().then((clients) => {
      this.knownClients = clients;
      return clients;
    });
    this.clients.catch(() => {
      this.clients = null;
    });
    return this.clients;
  }

  /**
   * `update` (posizione, cliente: modifiche sul telefono) parte subito e non dipende dal login:
   * senza rete o con il popup bloccato la posizione va comunque salvata.
   * `authorized` parte anch'esso subito (nel tocco) per poter aprire il popup di Google;
   * il salvataggio su Drive aspetta l'aggiornamento locale e le operazioni precedenti in coda.
   */
  private enqueueSync(update: () => Promise<void>): Promise<void> {
    const localUpdate = update();
    const previous = this.queue;
    const driveSave = this.dependencies.authorized(async () => {
      await previous;
      await localUpdate;
      await this.saveToDrive();
    });
    this.queue = Promise.allSettled([localUpdate, driveSave]).then((results) => {
      const failure = results.find((result) => result.status === 'rejected');
      this.syncError = failure ? `Salvata sul telefono, non ancora su Drive: ${errorText(failure.reason)}` : null;
      this.emit();
    });
    return this.queue;
  }

  /** Salva la visita in corso e tutte quelle chiuse in attesa; toglie dalla coda solo la versione confermata. */
  private async saveToDrive(): Promise<void> {
    if (this.state.openVisit) {
      await this.saveVisit(this.state.openVisit.id);
    }
    await this.uploadFreeNotes();
    for (const visit of [...this.state.unsyncedVisits]) {
      const saved = await this.saveVisit(visit.id);
      // Si toglie solo la versione salvata: se nel frattempo la visita è cambiata, resta in coda.
      this.commit({
        ...this.state,
        unsyncedVisits: this.state.unsyncedVisits.filter((current) => current !== saved),
      });
    }
  }

  /**
   * Prima gli audio, poi il JSON (fonte di verità) con i loro riferimenti, poi la riga del registro.
   * Se un passo fallisce la visita resta in coda; restituisce la versione salvata.
   */
  private async saveVisit(visitId: string): Promise<Visit> {
    await this.uploadPendingAudio(visitId);
    const visit = this.findVisit(visitId);
    if (!visit) {
      throw new Error(`Visita ${visitId} non trovata sul telefono`);
    }
    await this.dependencies.repository.save(visit);
    const clientName = visit.clientId
      ? ((await this.loadClients()).find((client) => client.id === visit.clientId)?.name ?? null)
      : null;
    await this.dependencies.register.save(visit, clientName);
    return visit;
  }

  /** Le note libere caricate escono dalla coda; quelle impossibili da caricare restano, con un avviso. */
  private async uploadFreeNotes(): Promise<void> {
    for (const note of [...this.state.freeNotes]) {
      const uploaded = await this.uploadAudio(null, note);
      if (uploaded) {
        this.removeFreeNote(note.id);
        await this.dependencies.audio.deleteLocal(note.id);
      }
    }
  }

  /** Carica una nota; null (con avviso) se non potrà mai essere caricata. Gli errori di rete si propagano. */
  private async uploadAudio(visit: Visit | null, note: AudioNote): Promise<UploadedAudio | null> {
    try {
      const uploaded = await this.dependencies.audio.upload(visit, note);
      if (!uploaded) {
        this.audioNotice = 'Nota vocale non caricata: il file non è su questo telefono';
      }
      return uploaded;
    } catch (error) {
      // Un file troppo grande non passerà mai: lo si segnala senza bloccare il resto.
      if (error instanceof FileTooLargeError) {
        this.audioNotice = `Nota vocale non caricata: ${error.message}`;
        return null;
      }
      throw error;
    }
  }

  private async uploadPendingAudio(visitId: string): Promise<void> {
    const pending = this.findVisit(visitId)?.audio.filter((note) => !note.driveFileId) ?? [];
    for (const note of pending) {
      const visit = this.findVisit(visitId);
      if (!visit) {
        return;
      }
      const uploaded = await this.uploadAudio(visit, note);
      if (!uploaded) {
        continue;
      }
      const { fileId, link } = uploaded;
      this.updateVisit(visitId, (visit) => ({
        ...visit,
        audio: visit.audio.map((current) =>
          current.id === note.id ? { ...current, driveFileId: fileId, driveLink: link } : current,
        ),
      }));
      // Il riferimento su Drive è salvato sul telefono: la copia locale non serve più.
      await this.dependencies.audio.deleteLocal(note.id);
    }
  }

  private findVisit(id: string): Visit | undefined {
    const { openVisit, unsyncedVisits } = this.state;
    if (openVisit?.id === id) {
      return openVisit;
    }
    return unsyncedVisits.find((visit) => visit.id === id) ?? this.latestVisits.get(id);
  }

  private updateVisit(id: string, change: (visit: Visit) => Visit): void {
    const { openVisit, unsyncedVisits } = this.state;
    if (openVisit?.id === id) {
      this.commit({ ...this.state, openVisit: change(openVisit) });
      return;
    }
    const target = unsyncedVisits.find((visit) => visit.id === id) ?? this.latestVisits.get(id);
    if (target) {
      this.commit({ ...this.state, unsyncedVisits: upsertVisit(unsyncedVisits, change(target)) });
    }
  }

  private commit(state: LocalVisitState): void {
    this.dependencies.store.save(state);
    this.state = state;
    for (const visit of [state.openVisit, ...state.unsyncedVisits]) {
      if (visit) {
        this.latestVisits.set(visit.id, visit);
      }
    }
    this.emit();
  }

  private emit(): void {
    const view = this.view();
    this.listeners.forEach((listener) => listener(view));
  }
}
