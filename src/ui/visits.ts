import { distanceMeters } from '../geo/distance';
import type { Client } from '../model/client';
import type { Coordinates } from '../model/position';
import type { Visit } from '../model/visit';
import { clockTime, italianDate } from '../register/visitRow';
import type { VisitsRepository } from '../storage/visitsRepository';
import type { VisitSession } from '../visits/visitSession';
import { errorMessage, requireElement } from './dom';

const RECENT_VISITS_LIMIT = 20;

export interface VisitsScreenDependencies {
  repository: Pick<VisitsRepository, 'listRecent'>;
  loadClients: () => Promise<Client[]>;
  session: Pick<VisitSession, 'assignClient' | 'localVisits' | 'view'>;
  authorized: <T>(action: () => Promise<T>) => Promise<T>;
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

export async function mountVisitsScreen(container: HTMLElement, dependencies: VisitsScreenDependencies): Promise<void> {
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

  const clientName = (id: string | null) => clients.find((client) => client.id === id)?.name ?? null;

  const assignmentForm = (visit: Visit) => {
    const form = document.createElement('form');
    form.className = 'card';
    const label = document.createElement('label');
    label.textContent = 'Cliente';
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

  const render = () => {
    list.replaceChildren(
      ...visits.map((visit) => {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'list-item';
        const times = document.createElement('strong');
        times.textContent = describeTimes(visit);
        const client = document.createElement('small');
        client.textContent = clientName(visit.clientId) ?? (visit.clientId ? 'cliente non trovato' : '⚠️ senza cliente');
        button.append(times, client);
        button.addEventListener('click', () => {
          expandedVisitId = expandedVisitId === visit.id ? null : visit.id;
          message.textContent = '';
          render();
        });
        item.append(button);
        if (expandedVisitId === visit.id) {
          item.append(assignmentForm(visit));
        }
        return item;
      }),
    );
    if (visits.length === 0) {
      message.textContent = 'Nessuna visita quest’anno.';
    }
  };

  message.textContent = 'Caricamento visite…';
  try {
    const [fromDrive, loadedClients] = await dependencies.authorized(() =>
      Promise.all([dependencies.repository.listRecent(dependencies.currentYear, RECENT_VISITS_LIMIT), dependencies.loadClients()]),
    );
    clients = loadedClients;
    visits = mergeVisits(fromDrive, dependencies.session.localVisits(), RECENT_VISITS_LIMIT);
    message.textContent = '';
    render();
  } catch (error) {
    message.textContent = `Impossibile caricare le visite: ${errorMessage(error)}`;
  }
}
