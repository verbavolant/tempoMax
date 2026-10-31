import { distanceMeters } from '../geo/distance';
import { googleMapsUrl } from '../geo/mapsLink';
import { formatElapsed } from '../model/time';
import type { Client } from '../model/client';
import type { Coordinates } from '../model/position';
import type { Visit } from '../model/visit';
import { clockTime, italianDate } from '../register/visitRow';
import type { AudioStore } from '../storage/audioStore';
import type { VisitsRepository } from '../storage/visitsRepository';
import type { VisitSession } from '../visits/visitSession';
import { errorMessage, requireElement } from './dom';
import { NotePlayer } from './notePlayer';

const RECENT_VISITS_LIMIT = 20;

export interface VisitsScreenDependencies {
  repository: Pick<VisitsRepository, 'listRecent'>;
  loadClients: () => Promise<Client[]>;
  session: Pick<VisitSession, 'assignClient' | 'localVisits' | 'view'>;
  authorized: <T>(action: () => Promise<T>) => Promise<T>;
  audioStore: Pick<AudioStore, 'get'>;
  download: (driveFileId: string) => Promise<Blob>;
  currentYear: string;
}

/** Clienti dal più vicino alla posizione indicata; quelli senza posizione (o senza posizione di riferimento) in ordine alfabetico in fondo. */
export function orderClientsByDistance(clients: readonly Client[], position: Coordinates | null): Client[] {
  const distance = (client: Client) =>
    position && client.location ? distanceMeters(position, client.location) : Number.POSITIVE_INFINITY;
  return [...clients].sort((a, b) => distance(a) - distance(b) || a.name.localeCompare(b.name, 'it'));
}

/** Unisce le visite di Drive con quelle locali (più aggiornate), dalla più recente. */
export function mergeVisits(fromDrive: readonly Visit[], local: readonly Visit[], limit: number): Visit[] {
  const byId = new Map(fromDrive.map((visit) => [visit.id, visit]));
  local.forEach((visit) => byId.set(visit.id, visit));
  return [...byId.values()]
    .sort((a, b) => Date.parse(b.checkIn.at) - Date.parse(a.checkIn.at))
    .slice(0, limit);
}

function describeTimes(visit: Visit): string {
  const end = visit.checkOut ? clockTime(visit.checkOut.at) : 'in corso';
  return `${italianDate(visit.checkIn.at)} · ${clockTime(visit.checkIn.at)}–${end}`;
}

export async function mountVisitsScreen(
  container: HTMLElement,
  dependencies: VisitsScreenDependencies,
): Promise<() => void> {
  container.innerHTML = `
    <section class="visits">
      <h2>Visite recenti</h2>
      <p id="visits-message" role="status"></p>
      <ul id="visits-list" class="list"></ul>
    </section>
  `;
  const message = requireElement<HTMLParagraphElement>(container, '#visits-message');
  const list = requireElement<HTMLUListElement>(container, '#visits-list');

  let clients: Client[] = [];
  let visits: Visit[] = [];
  let expandedVisitId: string | null = null;
  // Pulsanti ▶/⏸ visibili: si aggiornano senza ridisegnare il resto (la scelta nella tendina non si perde).
  const audioButtons = new Map<string, { button: HTMLButtonElement; text: string }>();

  const refreshAudioButtons = () => {
    audioButtons.forEach(({ button, text }, noteId) => {
      button.textContent = `${player.isPlaying(noteId) ? '⏸' : '▶'} ${text}`;
    });
  };
  const player = new NotePlayer(
    { audioStore: dependencies.audioStore, download: dependencies.download, authorized: dependencies.authorized },
    refreshAudioButtons,
  );

  const clientName = (id: string | null) => clients.find((client) => client.id === id)?.name ?? null;

  const locationLink = (visit: Visit) => {
    const position = visit.checkIn.position;
    if (!position) {
      const missing = document.createElement('p');
      missing.className = 'muted';
      missing.textContent = 'Posizione del check-in non registrata.';
      return missing;
    }
    const link = document.createElement('a');
    link.className = 'maps-link';
    link.href = googleMapsUrl(position);
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = '📍 Apri in Maps il luogo della visita';
    return link;
  };

  const assignmentForm = (visit: Visit) => {
    const form = document.createElement('form');
    form.className = 'assign-form';
    const label = document.createElement('label');
    label.textContent = visit.clientId ? 'Cliente' : 'Abbina a un cliente';
    const select = document.createElement('select');
    const none = new Option('— nessun cliente —', '');
    select.append(
      none,
      ...orderClientsByDistance(clients, visit.checkIn.position).map((client) => new Option(client.name, client.id)),
    );
    select.value = visit.clientId ?? '';
    label.append(select);
    const save = document.createElement('button');
    save.type = 'submit';
    save.className = 'primary';
    save.textContent = 'Salva';
    form.append(label, save);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      save.disabled = true;
      const clientId = select.value || null;
      // assignClient chiede il token in modo sincrono, dentro il tap su "Salva".
      await dependencies.session.assignClient(visit, clientId);
      visits = visits.map((current) => (current.id === visit.id ? { ...current, clientId } : current));
      expandedVisitId = null;
      render();
      message.textContent = dependencies.session.view().notice ?? 'Salvato.';
    });
    return form;
  };

  const recordings = (visit: Visit) => {
    const section = document.createElement('div');
    const title = document.createElement('h4');
    title.textContent = `Registrazioni (${visit.audio.length})`;
    section.append(title);
    if (visit.audio.length === 0) {
      const none = document.createElement('p');
      none.className = 'muted';
      none.textContent = 'Nessuna registrazione.';
      section.append(none);
      return section;
    }
    const notes = document.createElement('ul');
    notes.className = 'audio-list';
    visit.audio.forEach((note, index) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      const text = `Nota ${index + 1} · ${clockTime(note.recordedAt)} · ${formatElapsed(note.durationSeconds * 1000)}`;
      audioButtons.set(note.id, { button, text });
      button.addEventListener('click', () => {
        message.textContent = '';
        player.toggle({ noteId: note.id, driveFileId: note.driveFileId }).catch((error: unknown) => {
          message.textContent = `Impossibile ascoltare la nota: ${errorMessage(error)}`;
        });
      });
      item.append(button);
      notes.append(item);
    });
    section.append(notes);
    return section;
  };

  const details = (visit: Visit) => {
    const card = document.createElement('div');
    card.className = 'card visit-details';
    if (!visit.clientId) {
      card.append(locationLink(visit));
    }
    card.append(assignmentForm(visit), recordings(visit));
    return card;
  };

  const render = () => {
    audioButtons.clear();
    list.replaceChildren(
      ...visits.map((visit) => {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'list-item';
        const times = document.createElement('strong');
        times.textContent = describeTimes(visit);
        const summary = document.createElement('small');
        const client =
          clientName(visit.clientId) ?? (visit.clientId ? 'cliente non trovato' : '⚠️ senza cliente · tocca per abbinare');
        summary.textContent = [client, visit.audio.length > 0 ? `🎧 ${visit.audio.length}` : null].filter(Boolean).join(' · ');
        button.append(times, summary);
        button.addEventListener('click', () => {
          expandedVisitId = expandedVisitId === visit.id ? null : visit.id;
          message.textContent = '';
          render();
        });
        item.append(button);
        if (expandedVisitId === visit.id) {
          item.append(details(visit));
        }
        return item;
      }),
    );
    refreshAudioButtons();
    if (visits.length === 0) {
      message.textContent = 'Nessuna visita quest’anno.';
    }
  };

  message.textContent = 'Caricamento visite…';
  let fromDrive: Visit[] = [];
  try {
    [fromDrive, clients] = await dependencies.authorized(() =>
      Promise.all([dependencies.repository.listRecent(dependencies.currentYear, RECENT_VISITS_LIMIT), dependencies.loadClients()]),
    );
    message.textContent = '';
  } catch (error) {
    // Senza Drive (es. offline) le visite ancora sul telefono restano consultabili, con le loro note.
    message.textContent = `Visite su Drive non disponibili (${errorMessage(error)}): mostro quelle sul telefono.`;
  }
  visits = mergeVisits(fromDrive, dependencies.session.localVisits(), RECENT_VISITS_LIMIT);
  render();
  return () => player.stop();
}
