import './style.css';
import { GoogleAuth, loadGoogleIdentityServices } from './auth/googleAuth';
import { GOOGLE_CLIENT_ID, GOOGLE_SCOPE } from './config';
import { readCurrentPosition } from './geo/currentPosition';
import { ClientsRepository } from './storage/clientsRepository';
import { DriveClient, DriveError } from './storage/drive';
import { AudioStore } from './storage/audioStore';
import { AudioUploader } from './storage/audioUploader';
import { LocalVisitStore } from './storage/localVisits';
import { VisitRegister } from './storage/visitRegister';
import { VisitsRepository } from './storage/visitsRepository';
import { mountClientsScreen } from './ui/clients';
import { errorMessage, requireElement } from './ui/dom';
import { mountHomeScreen } from './ui/home';
import { mountVisitsScreen } from './ui/visits';
import { mountNotesScreen } from './ui/notes';
import { AudioCatalog } from './storage/audioCatalog';
import { formatLocalIsoDateTime } from './model/time';
import { VisitSession } from './visits/visitSession';

const appRoot = requireElement<HTMLDivElement>(document, '#app');

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // Cache dei file dell'app: permette l'avvio senza rete (public/sw.js).
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error: unknown) => {
    console.error('Service worker non registrato', error);
  });
}

try {
  // Il login Google si carica in background: senza rete l'app deve partire lo stesso,
  // le visite restano sul telefono e il caricamento si ritenta al tap successivo.
  let auth: GoogleAuth | null = null;
  let authLoading: Promise<void> | null = null;
  const loadAuth = (): Promise<void> => {
    authLoading ??= loadGoogleIdentityServices().then(
      () => {
        auth = new GoogleAuth(GOOGLE_CLIENT_ID, GOOGLE_SCOPE);
      },
      (error: unknown) => {
        authLoading = null;
        throw error;
      },
    );
    return authLoading;
  };
  // Un fallimento qui è atteso senza rete: si manifesta (con messaggio) alla prima azione che usa Google.
  loadAuth().catch(() => undefined);

  const drive = new DriveClient(() => auth?.currentToken() ?? null);
  const clientsRepository = new ClientsRepository(drive);
  const visitsRepository = new VisitsRepository(drive);

  const authorized = async <T>(action: () => Promise<T>): Promise<T> => {
    // Offline il popup di login si aprirebbe vuoto: meglio lasciare la visita in attesa e dirlo.
    if (!navigator.onLine) {
      throw new Error('nessuna connessione');
    }
    const currentAuth = auth;
    if (!currentAuth) {
      loadAuth().catch(() => undefined);
      throw new Error('login Google non disponibile, controlla la connessione');
    }
    // requestToken() resta sincrono nel tap quando il token manca: Safari blocca i popup dopo un await.
    if (!currentAuth.currentToken()) {
      await currentAuth.requestToken();
    }
    try {
      return await action();
    } catch (error) {
      if (error instanceof DriveError && error.status === 401) {
        currentAuth.invalidateToken();
      }
      throw error;
    }
  };

  const audioStore = new AudioStore();
  const session = new VisitSession({
    store: new LocalVisitStore(window.localStorage),
    repository: visitsRepository,
    register: new VisitRegister(drive),
    audio: new AudioUploader(drive, audioStore),
    loadClients: () => clientsRepository.load(),
    readPosition: readCurrentPosition,
    authorized,
    now: () => new Date(),
  });

  let unmountCurrent: () => void = () => undefined;

  const showHome = () => {
    unmountCurrent();
    unmountCurrent = mountHomeScreen(appRoot, session, audioStore, {
      openClients: showClients,
      openVisits: showVisits,
      openNotes: showNotes,
    });
  };

  /**
   * Schermata secondaria con "Indietro"; `mount` va chiamato senza await precedenti, per il popup di login nel tap.
   * Se `mount` restituisce una funzione, viene chiamata quando si lascia la schermata.
   */
  const showSecondary = (mount: (container: HTMLDivElement) => Promise<void | (() => void)>) => {
    unmountCurrent();
    let cleanup: void | (() => void);
    // L'anagrafica può essere cambiata: il prossimo check-in la rilegge.
    unmountCurrent = () => {
      session.invalidateClients();
      cleanup?.();
    };
    appRoot.innerHTML = `
      <button id="back-home" type="button" class="secondary-button">‹ Indietro</button>
      <div id="secondary-screen"></div>
    `;
    requireElement<HTMLButtonElement>(appRoot, '#back-home').addEventListener('click', showHome);
    void mount(requireElement<HTMLDivElement>(appRoot, '#secondary-screen')).then((result) => {
      cleanup = result;
    });
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

  const showNotes = () =>
    showSecondary((container) =>
      mountNotesScreen(container, {
        catalog: new AudioCatalog(drive),
        audioStore,
        visitsRepository,
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
