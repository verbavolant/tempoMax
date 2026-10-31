import { findClientAtPosition } from '../geo/distance';
import type { Client } from '../model/client';
import type { MeasuredPosition } from '../model/position';
import { formatLocalIsoDateTime } from '../model/time';
import { type Visit, endVisit, startVisit } from '../model/visit';
import { type LocalVisitState, type LocalVisitStore, upsertVisit } from '../storage/localVisits';
import type { VisitRegister } from '../storage/visitRegister';
import type { VisitsRepository } from '../storage/visitsRepository';

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

export interface VisitSessionDependencies {
  store: Pick<LocalVisitStore, 'load' | 'save'>;
  repository: Pick<VisitsRepository, 'save'>;
  register: Pick<VisitRegister, 'save'>;
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
      notice: this.syncError ?? this.positionNotice,
    };
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
      this.commit({ openVisit: null, unsyncedVisits: upsertVisit(this.state.unsyncedVisits, closed) });
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
   * `authorized` parte subito (nel tap) per poter aprire il popup di Google; il lavoro vero
   * aspetta le operazioni precedenti in coda.
   */
  private enqueueSync(update: () => Promise<void>): Promise<void> {
    const previous = this.queue;
    const operation = this.dependencies.authorized(async () => {
      await previous;
      await update();
      await this.saveToDrive();
    });
    this.queue = operation.then(
      () => {
        this.syncError = null;
        this.emit();
      },
      (error: unknown) => {
        this.syncError = `Salvata sul telefono, non ancora su Drive: ${errorText(error)}`;
        this.emit();
      },
    );
    return this.queue;
  }

  /** Salva la visita in corso e tutte quelle chiuse in attesa; toglie dalla coda solo la versione confermata. */
  private async saveToDrive(): Promise<void> {
    if (this.state.openVisit) {
      await this.saveVisit(this.state.openVisit);
    }
    for (const visit of [...this.state.unsyncedVisits]) {
      await this.saveVisit(visit);
      this.commit({
        ...this.state,
        unsyncedVisits: this.state.unsyncedVisits.filter((current) => current !== visit),
      });
    }
  }

  /** Prima il JSON (fonte di verità), poi la riga del registro: se il registro fallisce, la visita resta in coda. */
  private async saveVisit(visit: Visit): Promise<void> {
    await this.dependencies.repository.save(visit);
    const clientName = visit.clientId
      ? ((await this.loadClients()).find((client) => client.id === visit.clientId)?.name ?? null)
      : null;
    await this.dependencies.register.save(visit, clientName);
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
