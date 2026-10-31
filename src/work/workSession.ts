import { formatLocalIsoDateTime } from '../model/time';
import { type WorkPeriod, endWorkPeriod, startWorkPeriod, workedMilliseconds } from '../model/work';
import { type LocalWorkState, type LocalWorkStore, pruneLocalWork } from '../storage/localWork';
import type { WorkRegister } from '../storage/workRegister';
import type { WorkRepository } from '../storage/workRepository';

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

export interface WorkSessionDependencies {
  store: Pick<LocalWorkStore, 'load' | 'save'>;
  repository: Pick<WorkRepository, 'save'>;
  register: Pick<WorkRegister, 'save'>;
  /** Garantisce un token valido prima dell'azione; va chiamato in modo sincrono dentro il tocco. */
  authorized: <T>(action: () => Promise<T>) => Promise<T>;
  now: () => Date;
}

export interface WorkSessionView {
  /** Periodo in corso, null se non si sta lavorando (prima di iniziare o in pausa). */
  currentPeriod: WorkPeriod | null;
  todayMilliseconds: number;
  unsyncedCount: number;
  notice: string | null;
}

/**
 * Logica dei pulsanti "Inizio lavoro" / "Fine lavoro". L'orario si registra al tocco e si salva sul telefono;
 * il file del giorno e la riga del Foglio "Orario di lavoro" arrivano dopo, in coda.
 */
export class WorkSession {
  private state: LocalWorkState;
  private queue: Promise<void> = Promise.resolve();
  private notice: string | null = null;
  private readonly listeners = new Set<(view: WorkSessionView) => void>();

  /** Lancia se l'archivio locale è corrotto: il chiamante deve mostrarlo, non ripartire da zero. */
  constructor(private readonly dependencies: WorkSessionDependencies) {
    this.state = pruneLocalWork(dependencies.store.load(), this.today());
  }

  view(): WorkSessionView {
    return {
      currentPeriod: this.state.periods.find((period) => !period.end) ?? null,
      todayMilliseconds: workedMilliseconds(this.state.periods, this.today(), this.dependencies.now().getTime()),
      unsyncedCount: this.state.unsyncedIds.length,
      notice: this.notice,
    };
  }

  subscribe(listener: (view: WorkSessionView) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** "Inizio lavoro". Se si sta già lavorando non apre un secondo periodo, ma riprova il salvataggio. */
  start(): Promise<void> {
    if (!this.view().currentPeriod) {
      const period = startWorkPeriod(this.nowIso());
      this.commit({ periods: [...this.state.periods, period], unsyncedIds: [...this.state.unsyncedIds, period.id] });
    }
    return this.enqueueSync();
  }

  /** "Fine lavoro" (anche per una pausa). Senza periodo in corso riprova solo il salvataggio. */
  stop(): Promise<void> {
    const current = this.view().currentPeriod;
    if (current) {
      const closed = endWorkPeriod(current, this.nowIso());
      this.commit({
        periods: this.state.periods.map((period) => (period.id === closed.id ? closed : period)),
        unsyncedIds: this.state.unsyncedIds.includes(closed.id) ? this.state.unsyncedIds : [...this.state.unsyncedIds, closed.id],
      });
    }
    return this.enqueueSync();
  }

  private today(): string {
    return this.nowIso().slice(0, 10);
  }

  private nowIso(): string {
    return formatLocalIsoDateTime(this.dependencies.now());
  }

  /** `authorized` parte subito (nel tocco); il lavoro aspetta le operazioni precedenti in coda. */
  private enqueueSync(): Promise<void> {
    const previous = this.queue;
    const operation = this.dependencies.authorized(async () => {
      await previous;
      await this.saveToDrive();
    });
    this.queue = operation.then(
      () => this.setNotice(null),
      (error: unknown) => this.setNotice(`Orario salvato sul telefono, non ancora su Drive: ${errorText(error)}`),
    );
    return this.queue;
  }

  /** Prima il file del giorno (fonte di verità), poi la riga del foglio; esce dalla coda solo la versione salvata. */
  private async saveToDrive(): Promise<void> {
    for (const id of [...this.state.unsyncedIds]) {
      const period = this.state.periods.find((current) => current.id === id);
      if (!period) {
        continue;
      }
      await this.dependencies.repository.save(period);
      await this.dependencies.register.save(period);
      const stillSame = this.state.periods.find((current) => current.id === id) === period;
      if (stillSame) {
        this.commit({ ...this.state, unsyncedIds: this.state.unsyncedIds.filter((current) => current !== id) });
      }
    }
  }

  private commit(state: LocalWorkState): void {
    this.dependencies.store.save(state);
    this.state = state;
    this.emit();
  }

  private setNotice(notice: string | null): void {
    this.notice = notice;
    this.emit();
  }

  private emit(): void {
    const view = this.view();
    this.listeners.forEach((listener) => listener(view));
  }
}
