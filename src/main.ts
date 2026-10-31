import './style.css';
import { GoogleAuth, loadGoogleIdentityServices } from './auth/googleAuth';
import { GOOGLE_CLIENT_ID, GOOGLE_SCOPE } from './config';
import { readCurrentPosition } from './geo/currentPosition';
import { ClientsRepository } from './storage/clientsRepository';
import { DriveClient, DriveError } from './storage/drive';
import { LocalVisitStore } from './storage/localVisits';
import { VisitRegister } from './storage/visitRegister';
import { VisitsRepository } from './storage/visitsRepository';
import { mountClientsScreen } from './ui/clients';
import { errorMessage, requireElement } from './ui/dom';
import { mountHomeScreen } from './ui/home';
import { mountVisitsScreen } from './ui/visits';
import { formatLocalIsoDateTime } from './model/time';
import { VisitSession } from './visits/visitSession';

const appRoot = requireElement<HTMLDivElement>(document, '#app');

try {
  await loadGoogleIdentityServices();
  const auth = new GoogleAuth(GOOGLE_CLIENT_ID, GOOGLE_SCOPE);
  const drive = new DriveClient(() => auth.currentToken());
  const clientsRepository = new ClientsRepository(drive);
  const visitsRepository = new VisitsRepository(drive);

  const authorized = async <T>(action: () => Promise<T>): Promise<T> => {
    // requestToken() resta sincrono nel tap quando il token manca: Safari blocca i popup dopo un await.
    if (!auth.currentToken()) {
      await auth.requestToken();
    }
    try {
      return await action();
    } catch (error) {
      if (error instanceof DriveError && error.status === 401) {
        auth.invalidateToken();
      }
      throw error;
    }
  };

  const session = new VisitSession({
    store: new LocalVisitStore(window.localStorage),
    repository: visitsRepository,
    register: new VisitRegister(drive),
    loadClients: () => clientsRepository.load(),
    readPosition: readCurrentPosition,
    authorized,
    now: () => new Date(),
  });

  let unmountCurrent: () => void = () => undefined;

  const showHome = () => {
    unmountCurrent();
    unmountCurrent = mountHomeScreen(appRoot, session, { openClients: showClients, openVisits: showVisits });
  };

  /** Schermata secondaria con "Indietro"; `mount` va chiamato senza await precedenti, per il popup di login nel tap. */
  const showSecondary = (mount: (container: HTMLDivElement) => Promise<void>) => {
    unmountCurrent();
    // L'anagrafica può essere cambiata: il prossimo check-in la rilegge.
    unmountCurrent = () => session.invalidateClients();
    appRoot.innerHTML = `
      <button id="back-home" type="button" class="secondary-button">‹ Indietro</button>
      <div id="secondary-screen"></div>
    `;
    requireElement<HTMLButtonElement>(appRoot, '#back-home').addEventListener('click', showHome);
    void mount(requireElement<HTMLDivElement>(appRoot, '#secondary-screen'));
  };

  const showClients = () =>
    showSecondary((container) =>
      mountClientsScreen(container, { repository: clientsRepository, readPosition: readCurrentPosition, authorized }),
    );

  const showVisits = () =>
    showSecondary((container) =>
      mountVisitsScreen(container, {
        repository: visitsRepository,
        loadClients: () => clientsRepository.load(),
        session,
        authorized,
        currentYear: formatLocalIsoDateTime(new Date()).slice(0, 4),
      }),
    );

  showHome();
} catch (error) {
  appRoot.textContent = `TempoMax non è partito: ${errorMessage(error)}`;
}
