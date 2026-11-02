import type { Client } from '../model/client';
import { type Task, compareOpenTasks, createVoiceTask } from '../model/task';
import { formatLocalIsoDateTime } from '../model/time';
import type { MeasuredPosition } from '../model/position';
import type { AudioNote } from '../model/visit';
import type { AudioUploader } from '../storage/audioUploader';
import { FileTooLargeError } from '../storage/drive';
import { type LocalTaskState, type LocalTaskStore } from '../storage/localTasks';
import type { TaskRegister } from '../storage/taskRegister';
import { type TasksRepository, mergeTasks } from '../storage/tasksRepository';

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

// Completati mostrati nell'elenco: quelli recenti bastano, lo storico completo è su Drive.
const RECENT_DONE_LIMIT = 20;

export interface TaskSessionDependencies {
  store: Pick<LocalTaskStore, 'load' | 'save'>;
  repository: Pick<TasksRepository, 'load' | 'saveAll'>;
  register: Pick<TaskRegister, 'save'>;
  audio: Pick<AudioUploader, 'upload' | 'deleteLocal'>;
  loadClients: () => Promise<Client[]>;
  /** Garantisce un token valido prima dell'azione; va chiamato in modo sincrono dentro il tocco. */
  authorized: <T>(action: () => Promise<T>) => Promise<T>;
  now: () => Date;
  deviceName: () => string | null;
}

export interface TaskSessionView {
  open: Task[];
  recentlyDone: Task[];
  /** Oggi `AAAA-MM-GG`, per distinguere scadute, di oggi e future. */
  today: string;
  unsyncedCount: number;
  notice: string | null;
}

export interface VoiceTaskDraft {
  audio: AudioNote;
  dueDate: string | null;
  visitId: string | null;
  clientId: string | null;
}

/** Logica dei "da fare": tutto si salva subito sul telefono; `task.json`, audio e foglio arrivano dopo, in coda. */
export class TaskSession {
  private state: LocalTaskState;
  private queue: Promise<void> = Promise.resolve();
  private syncError: string | null = null;
  /** Problemi permanenti di una nota (troppo grande, file assente): restano visibili anche se il resto si salva. */
  private audioNotice: string | null = null;
  private readonly listeners = new Set<(view: TaskSessionView) => void>();

  /** Lancia se l'archivio locale è corrotto: il chiamante deve mostrarlo, non ripartire da zero. */
  constructor(private readonly dependencies: TaskSessionDependencies) {
    this.state = dependencies.store.load();
  }

  view(): TaskSessionView {
    const open = this.state.tasks.filter((task) => !task.completedAt).sort(compareOpenTasks);
    const recentlyDone = this.state.tasks
      .filter((task) => task.completedAt)
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
      .slice(0, RECENT_DONE_LIMIT);
    return {
      open,
      recentlyDone,
      today: this.today(),
      unsyncedCount: this.state.unsyncedIds.length,
      notice: this.syncError ?? this.audioNotice,
    };
  }

  subscribe(listener: (view: TaskSessionView) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  today(): string {
    return formatLocalIsoDateTime(this.dependencies.now()).slice(0, 10);
  }

  /** Nuovo "da fare" vocale, salvato subito sul telefono. Il salvataggio su Drive lo avvia chi chiama (`syncAfter`). */
  addVoiceTask(draft: VoiceTaskDraft): Task {
    const task = createVoiceTask({
      ...draft,
      createdAt: formatLocalIsoDateTime(this.dependencies.now()),
      device: this.dependencies.deviceName(),
    });
    this.commitChange(task);
    return task;
  }

  /** Posizione di inizio registrazione, aggiunta quando il GPS risponde (T-033). */
  setAudioPosition(taskId: string, position: MeasuredPosition): void {
    this.change(taskId, (task) => (task.audio ? { ...task, audio: { ...task.audio, position } } : task));
  }

  /** Da chiamare nel tocco: cambia la scadenza e avvia il salvataggio. */
  setDueDate(taskId: string, dueDate: string | null): Promise<void> {
    this.change(taskId, (task) => ({ ...task, dueDate }));
    return this.enqueueSync();
  }

  /** Da chiamare nel tocco: segna come fatto (o di nuovo da fare) e avvia il salvataggio. */
  setDone(taskId: string, done: boolean): Promise<void> {
    const completedAt = done ? formatLocalIsoDateTime(this.dependencies.now()) : null;
    this.change(taskId, (task) => ({ ...task, completedAt }));
    return this.enqueueSync();
  }

  /** Da chiamare nel tocco: rilegge `task.json` (modifiche da altri dispositivi) e salva quelle in attesa. */
  refresh(): Promise<void> {
    return this.enqueueSync();
  }

  /** Salvataggio che parte a `task` concluso (es. la registrazione appena fermata); va chiamato nel tocco. */
  syncAfter(task: Promise<unknown>): Promise<void> {
    return this.enqueueSync(task);
  }

  private change(taskId: string, update: (task: Task) => Task): void {
    const current = this.state.tasks.find((task) => task.id === taskId);
    if (current) {
      this.commitChange(update(current));
    }
  }

  private commitChange(task: Task): void {
    const exists = this.state.tasks.some((current) => current.id === task.id);
    this.commit({
      tasks: exists ? this.state.tasks.map((current) => (current.id === task.id ? task : current)) : [...this.state.tasks, task],
      unsyncedIds: this.state.unsyncedIds.includes(task.id) ? this.state.unsyncedIds : [...this.state.unsyncedIds, task.id],
    });
  }

  private enqueueSync(before: Promise<unknown> = Promise.resolve()): Promise<void> {
    const previous = this.queue;
    const operation = this.dependencies.authorized(async () => {
      await previous;
      // L'esito di `before` è gestito da chi lo ha avviato: qui serve solo aspettarlo.
      await before.catch(() => undefined);
      await this.saveToDrive();
    });
    this.queue = operation.then(
      () => this.setSyncError(null),
      (error: unknown) => this.setSyncError(`Salvato sul telefono, non ancora su Drive: ${errorText(error)}`),
    );
    return this.queue;
  }

  /** Audio, poi `task.json` unito con Drive, poi le righe del foglio; escono dalla coda solo le versioni salvate. */
  private async saveToDrive(): Promise<void> {
    this.audioNotice = null;
    for (const id of [...this.state.unsyncedIds]) {
      await this.uploadAudio(id);
    }
    const saving = new Map(
      this.state.unsyncedIds.flatMap((id) => {
        const task = this.state.tasks.find((current) => current.id === id);
        return task ? [[id, task] as const] : [];
      }),
    );
    const merged = mergeTasks(await this.dependencies.repository.load(), this.state.tasks, this.state.unsyncedIds);
    await this.dependencies.repository.saveAll(merged);
    const clients = saving.size > 0 ? await this.dependencies.loadClients() : [];
    for (const task of saving.values()) {
      const clientName = clients.find((client) => client.id === task.clientId)?.name ?? null;
      await this.dependencies.register.save(task, clientName);
    }
    // Le attività cambiate durante il salvataggio restano in coda, con la loro versione più recente.
    const changedMeanwhile = new Set(
      [...saving].filter(([id, task]) => this.state.tasks.find((current) => current.id === id) !== task).map(([id]) => id),
    );
    const newSinceStart = this.state.unsyncedIds.filter((id) => !saving.has(id));
    this.commit({
      tasks: mergeTasks(merged, this.state.tasks, [...changedMeanwhile, ...newSinceStart]),
      unsyncedIds: [...changedMeanwhile, ...newSinceStart],
    });
  }

  private async uploadAudio(taskId: string): Promise<void> {
    const task = this.state.tasks.find((current) => current.id === taskId);
    if (!task?.audio || task.audio.driveFileId) {
      return;
    }
    const note = task.audio;
    let uploaded;
    try {
      uploaded = await this.dependencies.audio.upload({ kind: 'todo', taskId }, note);
    } catch (error) {
      // Un file troppo grande non passerà mai: lo si segnala senza bloccare le altre attività.
      if (error instanceof FileTooLargeError) {
        this.audioNotice = `Nota del "da fare" non caricata: ${error.message}`;
        return;
      }
      throw error;
    }
    if (!uploaded) {
      this.audioNotice = 'Nota del "da fare" non caricata: il file non è su questo telefono';
      return;
    }
    const { fileId, link } = uploaded;
    this.change(taskId, (current) =>
      current.audio ? { ...current, audio: { ...current.audio, driveFileId: fileId, driveLink: link } } : current,
    );
    await this.dependencies.audio.deleteLocal(note.id);
  }

  private commit(state: LocalTaskState): void {
    this.dependencies.store.save(state);
    this.state = state;
    this.emit();
  }

  private setSyncError(error: string | null): void {
    this.syncError = error;
    this.emit();
  }

  private emit(): void {
    const view = this.view();
    this.listeners.forEach((listener) => listener(view));
  }
}
