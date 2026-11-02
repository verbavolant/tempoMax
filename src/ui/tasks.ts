import type { Client } from '../model/client';
import type { Task } from '../model/task';
import { daysBetweenDates } from '../model/time';
import { clockTime, italianDate } from '../register/visitRow';
import type { AudioStore } from '../storage/audioStore';
import type { TaskSession, TaskSessionView } from '../tasks/taskSession';
import { errorMessage, requireElement } from './dom';
import { highlightedDaysFor, showDuePicker } from './duePicker';
import { NotePlayer } from './notePlayer';

export interface TasksScreenDependencies {
  tasks: TaskSession;
  audioStore: Pick<AudioStore, 'get'>;
  download: (driveFileId: string) => Promise<Blob>;
  loadClients: () => Promise<Client[]>;
  authorized: <T>(action: () => Promise<T>) => Promise<T>;
}

/** Scadenza in parole, rispetto a oggi; `overdue` per evidenziare le attività scadute. */
export function describeDue(dueDate: string | null, today: string): { text: string; overdue: boolean } {
  if (dueDate === null) {
    return { text: 'Senza scadenza', overdue: false };
  }
  const days = daysBetweenDates(today, dueDate);
  if (days < 0) return { text: `⚠️ Scaduto il ${italianDate(dueDate).slice(0, 5)}`, overdue: true };
  if (days === 0) return { text: 'Scade oggi', overdue: false };
  if (days === 1) return { text: 'Scade domani', overdue: false };
  return { text: `Scade il ${italianDate(dueDate).slice(0, 5)}`, overdue: false };
}

export async function mountTasksScreen(container: HTMLElement, dependencies: TasksScreenDependencies): Promise<() => void> {
  container.innerHTML = `
    <section class="tasks">
      <h2>Da fare</h2>
      <p id="tasks-message" role="status"></p>
      <ul id="tasks-open" class="list"></ul>
      <h3>Completati di recente</h3>
      <ul id="tasks-done" class="list"></ul>
    </section>
  `;
  const message = requireElement<HTMLParagraphElement>(container, '#tasks-message');
  const openList = requireElement<HTMLUListElement>(container, '#tasks-open');
  const doneList = requireElement<HTMLUListElement>(container, '#tasks-done');
  const { tasks } = dependencies;

  let clientNames = new Map<string, string>();
  let actionError: string | null = null;
  let closePicker: (() => void) | null = null;
  const player = new NotePlayer(
    { audioStore: dependencies.audioStore, download: dependencies.download, authorized: dependencies.authorized },
    () => render(tasks.view()),
  );

  const actionButton = (text: string, onClick: () => void, className = '') => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.className = className;
    button.addEventListener('click', onClick);
    return button;
  };

  const taskItem = (task: Task, view: TaskSessionView) => {
    const item = document.createElement('li');
    item.className = 'card task-item';
    const due = describeDue(task.dueDate, view.today);
    const title = document.createElement('strong');
    title.textContent = task.completedAt ? `✓ Fatto il ${italianDate(task.completedAt).slice(0, 5)}` : due.text;
    title.classList.toggle('overdue', !task.completedAt && due.overdue);
    const details = document.createElement('small');
    details.textContent = [
      `registrato il ${italianDate(task.createdAt).slice(0, 5)} alle ${clockTime(task.createdAt)}`,
      task.clientId ? (clientNames.get(task.clientId) ?? null) : null,
      task.audio && !task.audio.driveFileId ? 'solo sul telefono' : null,
    ]
      .filter(Boolean)
      .join(' · ');
    item.append(title, details);
    if (task.text) {
      const text = document.createElement('p');
      text.textContent = task.text;
      item.append(text);
    }
    const actions = document.createElement('div');
    actions.className = 'task-actions';
    const audio = task.audio;
    if (audio) {
      actions.append(
        actionButton(player.isPlaying(audio.id) ? '⏸ Ferma' : '▶ Ascolta', () => {
          actionError = null;
          player.toggle({ noteId: audio.id, driveFileId: audio.driveFileId }).catch((error: unknown) => {
            actionError = `Impossibile ascoltare: ${errorMessage(error)}`;
            render(tasks.view());
          });
        }),
      );
    }
    if (task.completedAt) {
      actions.append(actionButton('↩️ Riapri', () => void tasks.setDone(task.id, false)));
    } else {
      actions.append(
        actionButton('⏰ Scadenza', () => {
          closePicker = showDuePicker({
            title: 'Nuova scadenza?',
            today: view.today,
            highlightedDays: highlightedDaysFor(view.today, task.dueDate),
            onChoose: (dueDate) => void tasks.setDueDate(task.id, dueDate),
          });
        }),
        actionButton('✓ Fatto', () => void tasks.setDone(task.id, true), 'primary'),
      );
    }
    item.append(actions);
    return item;
  };

  const empty = (text: string) => {
    const item = document.createElement('li');
    item.className = 'empty';
    item.textContent = text;
    return item;
  };

  const render = (view: TaskSessionView) => {
    openList.replaceChildren(...(view.open.length ? view.open.map((task) => taskItem(task, view)) : [empty('Niente da fare.')]));
    doneList.replaceChildren(
      ...(view.recentlyDone.length ? view.recentlyDone.map((task) => taskItem(task, view)) : [empty('Nessuno.')]),
    );
    const pending = view.unsyncedCount > 0 ? `da salvare su Drive: ${view.unsyncedCount}` : '';
    message.textContent = [actionError, view.notice, pending].filter(Boolean).join(' · ');
  };

  const unsubscribe = tasks.subscribe(render);
  render(tasks.view());
  // Nel tocco che apre la schermata: rilegge task.json (anche da altri telefoni) e salva ciò che è in attesa.
  void tasks.refresh();
  try {
    const clients = await dependencies.authorized(() => dependencies.loadClients());
    clientNames = new Map(clients.map((client) => [client.id, client.name]));
    render(tasks.view());
  } catch {
    // Senza Drive i nomi dei clienti mancano: l'elenco resta utilizzabile, e l'errore compare già dalla sincronizzazione.
  }
  return () => {
    unsubscribe();
    player.stop();
    closePicker?.();
  };
}
