import './style.css';
import { GoogleAuth, loadGoogleIdentityServices } from './auth/googleAuth';
import { GOOGLE_CLIENT_ID, GOOGLE_SCOPE } from './config';
import { readCurrentPosition } from './geo/currentPosition';
import { ClientsRepository } from './storage/clientsRepository';
import { DriveClient, DriveError } from './storage/drive';
import { mountClientsScreen } from './ui/clients';
import { errorMessage, requireElement } from './ui/dom';

const appRoot = requireElement<HTMLDivElement>(document, '#app');

appRoot.innerHTML = `
  <header class="row">
    <h1>TempoMax</h1>
    <button id="sign-out" type="button" hidden>Esci</button>
  </header>
  <p id="status" role="status">Caricamento login Google…</p>
  <button id="connect" type="button" class="primary" hidden>Accedi con Google</button>
  <main id="screen"></main>
`;

const statusText = requireElement<HTMLParagraphElement>(appRoot, '#status');
const connectButton = requireElement<HTMLButtonElement>(appRoot, '#connect');
const signOutButton = requireElement<HTMLButtonElement>(appRoot, '#sign-out');
const screen = requireElement<HTMLElement>(appRoot, '#screen');

try {
  await loadGoogleIdentityServices();
  const auth = new GoogleAuth(GOOGLE_CLIENT_ID, GOOGLE_SCOPE);
  const drive = new DriveClient(() => auth.currentToken());

  const authorized = async <T>(action: () => Promise<T>): Promise<T> => {
    // requestToken() resta sincrono nel click quando il token manca: Safari blocca i popup dopo un await.
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

  const showSignedOut = (message: string) => {
    statusText.textContent = message;
    connectButton.hidden = false;
    signOutButton.hidden = true;
    screen.replaceChildren();
  };

  showSignedOut('Non connesso');

  connectButton.addEventListener('click', async () => {
    connectButton.disabled = true;
    try {
      const user = await authorized(() => drive.getUser());
      statusText.textContent = `Connesso come ${user.displayName || user.emailAddress}`;
      connectButton.hidden = true;
      signOutButton.hidden = false;
      await mountClientsScreen(screen, {
        repository: new ClientsRepository(drive),
        readPosition: readCurrentPosition,
        authorized,
      });
    } catch (error) {
      statusText.textContent = errorMessage(error);
    } finally {
      connectButton.disabled = false;
    }
  });

  signOutButton.addEventListener('click', async () => {
    await auth.signOut();
    showSignedOut('Disconnesso');
  });
} catch (error) {
  statusText.textContent = errorMessage(error);
}
