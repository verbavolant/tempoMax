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
import { VisitSession } from './visits/visitSession';

const appRoot = requireElement<HTMLDivElement>(document, '#app');

try {
  await loadGoogleIdentityServices();
  const auth = new GoogleAuth(GOOGLE_CLIENT_ID, GOOGLE_SCOPE);
  const drive = new DriveClient(() => auth.currentToken());
  const clientsRepository = new ClientsRepository(drive);

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
    repository: new VisitsRepository(drive),
    register: new VisitRegister(drive),
    loadClients: () => clientsRepository.load(),
    readPosition: readCurrentPosition,
    authorized,
    now: () => new Date(),
  });

  let unmountCurrent: () => void = () => undefined;

  const showHome = () => {
    unmountCurrent();
    unmountCurrent = mountHomeScreen(appRoot, session, showClients);
  };

  const showClients = () => {
    unmountCurrent();
    unmountCurrent = () => session.invalidateClients();
    appRoot.innerHTML = `
      <button id="back-home" type="button" class="secondary-button">‹ Indietro</button>
      <div id="clients-screen"></div>
    `;
    requireElement<HTMLButtonElement>(appRoot, '#back-home').addEventListener('click', showHome);
    // Chiamata senza await precedenti: se il token manca, il popup si apre nel tap su "Clienti".
    void mountClientsScreen(requireElement<HTMLDivElement>(appRoot, '#clients-screen'), {
      repository: clientsRepository,
      readPosition: readCurrentPosition,
      authorized,
    });
  };

  showHome();
} catch (error) {
  appRoot.textContent = `TempoMax non è partito: ${errorMessage(error)}`;
}
