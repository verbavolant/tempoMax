import { findClientAtPosition } from '../geo/distance';
import { type Client, DEFAULT_CLIENT_RADIUS_METERS, buildClient, newClientIdentity } from '../model/client';
import type { Coordinates, MeasuredPosition } from '../model/position';
import type { ClientsRepository } from '../storage/clientsRepository';
import { errorMessage, requireElement } from './dom';

export interface ClientsScreenDependencies {
  repository: ClientsRepository;
  readPosition: () => Promise<MeasuredPosition>;
  /** Garantisce un token valido (chiedendolo nel click se serve) prima di eseguire l'azione. */
  authorized: <T>(action: () => Promise<T>) => Promise<T>;
}

function describeLocation(location: Coordinates | undefined, accuracyMeters?: number): string {
  if (!location) {
    return 'non impostata';
  }
  const accuracy = accuracyMeters === undefined ? '' : ` (±${Math.round(accuracyMeters)} m)`;
  return `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}${accuracy}`;
}

/** Ordine alfabetico, con in cima il cliente presso cui ci si trova. */
export function orderClientsForList(clients: readonly Client[], hereClient: Client | null): Client[] {
  return [...clients].sort(
    (a, b) => Number(b === hereClient) - Number(a === hereClient) || a.name.localeCompare(b.name, 'it'),
  );
}

export async function mountClientsScreen(container: HTMLElement, dependencies: ClientsScreenDependencies): Promise<void> {
  container.innerHTML = `
    <section class="clients">
      <header class="row">
        <h2>Clienti</h2>
        <button id="client-new" type="button" disabled>+ Nuovo cliente</button>
      </header>
      <p id="clients-message" role="status"></p>
      <ul id="clients-list" class="list"></ul>
      <form id="client-form" class="card" hidden>
        <h3 id="client-form-title"></h3>
        <label>Nome<input name="name" required autocomplete="off" /></label>
        <label>Indirizzo<input name="address" autocomplete="off" /></label>
        <label>Note<textarea name="notes" rows="2"></textarea></label>
        <label>Raggio di tolleranza (metri)<input name="radius" type="number" min="1" step="1" required inputmode="numeric" /></label>
        <p>Posizione: <span id="client-location"></span></p>
        <button id="client-here" type="button">📍 Sono qui adesso</button>
        <p id="client-form-message" role="alert"></p>
        <div class="row">
          <button type="submit" class="primary">Salva</button>
          <button id="client-cancel" type="button">Annulla</button>
        </div>
      </form>
    </section>
  `;

  const message = requireElement<HTMLParagraphElement>(container, '#clients-message');
  const list = requireElement<HTMLUListElement>(container, '#clients-list');
  const form = requireElement<HTMLFormElement>(container, '#client-form');
  const formTitle = requireElement<HTMLHeadingElement>(container, '#client-form-title');
  const formMessage = requireElement<HTMLParagraphElement>(container, '#client-form-message');
  const locationText = requireElement<HTMLSpanElement>(container, '#client-location');
  const hereButton = requireElement<HTMLButtonElement>(container, '#client-here');
  const nameInput = requireElement<HTMLInputElement>(form, '[name="name"]');
  const addressInput = requireElement<HTMLInputElement>(form, '[name="address"]');
  const notesInput = requireElement<HTMLTextAreaElement>(form, '[name="notes"]');
  const radiusInput = requireElement<HTMLInputElement>(form, '[name="radius"]');

  let clients: Client[] = [];
  let editing: Client | null = null;
  let formLocation: Coordinates | undefined;
  let currentPosition: Coordinates | null = null;
  let positionError: string | null = null;

  const renderList = () => {
    // Stessa regola del check-in: il cliente evidenziato è quello che verrebbe associato alla visita.
    const hereClient = currentPosition ? findClientAtPosition(currentPosition, clients) : null;
    list.replaceChildren(
      ...orderClientsForList(clients, hereClient).map((client) => {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'list-item';
        button.classList.toggle('here', client === hereClient);
        const name = document.createElement('strong');
        name.textContent = client === hereClient ? `📍 Sei qui · ${client.name}` : client.name;
        const details = document.createElement('small');
        details.textContent = [client.address, client.location ? `raggio ${client.radiusMeters} m` : '⚠️ senza posizione']
          .filter(Boolean)
          .join(' · ');
        button.append(name, details);
        button.addEventListener('click', () => openForm(client));
        item.append(button);
        return item;
      }),
    );
    if (clients.length === 0) {
      message.textContent = 'Nessun cliente: aggiungi il primo.';
    } else {
      message.textContent = positionError && !currentPosition ? `Posizione non disponibile (${positionError}): nessun cliente evidenziato.` : '';
    }
  };

  const openForm = (client: Client | null) => {
    editing = client;
    formLocation = client?.location;
    formTitle.textContent = client ? `Modifica ${client.name}` : 'Nuovo cliente';
    nameInput.value = client?.name ?? '';
    addressInput.value = client?.address ?? '';
    notesInput.value = client?.notes ?? '';
    radiusInput.value = String(client?.radiusMeters ?? DEFAULT_CLIENT_RADIUS_METERS);
    locationText.textContent = describeLocation(formLocation);
    formMessage.textContent = '';
    form.hidden = false;
    nameInput.focus();
  };

  const closeForm = () => {
    form.hidden = true;
    editing = null;
  };

  const newButton = requireElement<HTMLButtonElement>(container, '#client-new');
  newButton.addEventListener('click', () => openForm(null));
  requireElement<HTMLButtonElement>(container, '#client-cancel').addEventListener('click', closeForm);

  hereButton.addEventListener('click', async () => {
    hereButton.disabled = true;
    formMessage.textContent = 'Lettura GPS…';
    try {
      const position = await dependencies.readPosition();
      formLocation = { latitude: position.latitude, longitude: position.longitude };
      currentPosition = formLocation;
      positionError = null;
      locationText.textContent = describeLocation(formLocation, position.accuracyMeters);
      const radius = Number(radiusInput.value);
      formMessage.textContent =
        position.accuracyMeters > radius
          ? `Precisione bassa (±${Math.round(position.accuracyMeters)} m, più del raggio): se puoi, riprova all'aperto.`
          : '';
    } catch (error) {
      formMessage.textContent = errorMessage(error);
    } finally {
      hereButton.disabled = false;
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = requireElement<HTMLButtonElement>(form, '[type="submit"]');
    try {
      const client = buildClient(
        {
          name: nameInput.value,
          address: addressInput.value,
          notes: notesInput.value,
          radiusMeters: Number(radiusInput.value),
          ...(formLocation && { location: formLocation }),
        },
        editing ?? newClientIdentity(),
      );
      const updated = editing ? clients.map((existing) => (existing.id === client.id ? client : existing)) : [...clients, client];
      submitButton.disabled = true;
      formMessage.textContent = 'Salvataggio su Drive…';
      // authorized() va chiamato senza await precedenti: se il token manca apre il popup nel gesto dell'utente.
      await dependencies.authorized(() => dependencies.repository.save(updated));
      clients = updated;
      closeForm();
      renderList();
      message.textContent = `Salvato ${client.name}.`;
    } catch (error) {
      formMessage.textContent = errorMessage(error);
    } finally {
      submitButton.disabled = false;
    }
  });

  // GPS in parallelo al caricamento: la lista compare subito, l'evidenziazione appena arriva la posizione.
  const positionRead = dependencies.readPosition().then(
    (position) => position,
    (error: unknown) => {
      positionError = errorMessage(error);
      return null;
    },
  );

  message.textContent = 'Caricamento clienti…';
  try {
    clients = await dependencies.authorized(() => dependencies.repository.load());
    renderList();
    // Solo dopo un caricamento riuscito: salvare partendo da una lista vuota sovrascriverebbe clienti.json.
    newButton.disabled = false;
  } catch (error) {
    message.textContent = `Impossibile caricare i clienti: ${errorMessage(error)}`;
    return;
  }
  currentPosition ??= await positionRead;
  renderList();
}
