import type { Client } from '../model/client';
import { formatElapsed } from '../model/time';
import type { AudioNote, Visit } from '../model/visit';
import { clockTime, italianDate } from '../register/visitRow';
import { type CatalogNote, type AudioCatalog, mergeCatalog } from '../storage/audioCatalog';
import type { AudioStore } from '../storage/audioStore';
import type { VisitsRepository } from '../storage/visitsRepository';
import { errorMessage, requireElement } from './dom';
import { NotePlayer } from './notePlayer';

// Visite lette per mostrare il nome del cliente accanto alle note: le più recenti bastano.
const VISITS_FOR_CLIENT_NAMES = 30;

export interface NotesScreenDependencies {
  catalog: Pick<AudioCatalog, 'listYear' | 'download'>;
  audioStore: Pick<AudioStore, 'get'>;
  visitsRepository: Pick<VisitsRepository, 'listRecent'>;
  loadClients: () => Promise<Client[]>;
  session: { localVisits: () => Visit[]; view: () => { pendingFreeNotes: AudioNote[] } };
  authorized: <T>(action: () => Promise<T>) => Promise<T>;
  currentYear: string;
}

function describeWhen(recordedAt: string): string {
  // Le note ricavate dal solo nome del file hanno la data ma non l'ora.
  return recordedAt.length > 10 ? `${italianDate(recordedAt)} · ${clockTime(recordedAt)}` : italianDate(recordedAt);
}

export async function mountNotesScreen(container: HTMLElement, dependencies: NotesScreenDependencies): Promise<() => void> {
  container.innerHTML = `
    <section class="notes">
      <h2>Note vocali</h2>
      <p id="notes-message" role="status"></p>
      <h3>Note libere</h3>
      <ul id="notes-free" class="list"></ul>
      <h3>Note delle visite</h3>
      <ul id="notes-visits" class="list"></ul>
    </section>
  `;
  const message = requireElement<HTMLParagraphElement>(container, '#notes-message');
  const freeList = requireElement<HTMLUListElement>(container, '#notes-free');
  const visitList = requireElement<HTMLUListElement>(container, '#notes-visits');

  const player = new NotePlayer(
    {
      audioStore: dependencies.audioStore,
      download: (driveFileId) => dependencies.catalog.download(driveFileId),
      authorized: dependencies.authorized,
    },
    () => render(),
  );

  let notes: CatalogNote[] = [];
  let visitDescriptions = new Map<string, string>();

  const noteItem = (note: CatalogNote) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'list-item note-item';
    button.classList.toggle('here', player.isPlaying(note.noteId));
    const title = document.createElement('strong');
    title.textContent = `${player.isPlaying(note.noteId) ? '⏸' : '▶'} ${describeWhen(note.recordedAt)}`;
    const details = document.createElement('small');
    details.textContent = [
      note.durationSeconds === null ? null : formatElapsed(note.durationSeconds * 1000),
      note.visitId ? (visitDescriptions.get(note.visitId) ?? null) : null,
      note.driveFileId ? null : 'solo sul telefono',
    ]
      .filter(Boolean)
      .join(' · ');
    button.append(title, details);
    button.addEventListener('click', () => {
      message.textContent = '';
      player.toggle(note).catch((error: unknown) => {
        message.textContent = `Impossibile ascoltare la nota: ${errorMessage(error)}`;
      });
    });
    item.append(button);
    return item;
  };

  const emptyItem = (text: string) => {
    const item = document.createElement('li');
    item.className = 'empty';
    item.textContent = text;
    return item;
  };

  const render = () => {
    const free = notes.filter((note) => note.kind === 'free');
    const ofVisits = notes.filter((note) => note.kind === 'visit');
    freeList.replaceChildren(...(free.length ? free.map(noteItem) : [emptyItem('Nessuna nota libera.')]));
    visitList.replaceChildren(...(ofVisits.length ? ofVisits.map(noteItem) : [emptyItem('Nessuna nota delle visite.')]));
  };

  message.textContent = 'Caricamento note…';
  let fromDrive: CatalogNote[] = [];
  let recentVisits: Visit[] = [];
  let clients: Client[] = [];
  try {
    [fromDrive, recentVisits, clients] = await dependencies.authorized(() =>
      Promise.all([
        dependencies.catalog.listYear(dependencies.currentYear),
        dependencies.visitsRepository.listRecent(dependencies.currentYear, VISITS_FOR_CLIENT_NAMES),
        dependencies.loadClients(),
      ]),
    );
    message.textContent = '';
  } catch (error) {
    // Senza Drive (es. offline) le note ancora sul telefono si possono comunque ascoltare.
    message.textContent = `Note su Drive non disponibili (${errorMessage(error)}): mostro quelle sul telefono.`;
  }
  const localVisits = dependencies.session.localVisits();
  const clientNames = new Map(clients.map((client) => [client.id, client.name]));
  visitDescriptions = new Map(
    [...recentVisits, ...localVisits].map((visit) => [
      visit.id,
      (visit.clientId ? clientNames.get(visit.clientId) : null) ?? `visita del ${italianDate(visit.checkIn.at)}`,
    ]),
  );
  notes = mergeCatalog(fromDrive, localVisits, dependencies.session.view().pendingFreeNotes);
  render();

  return () => player.stop();
}
