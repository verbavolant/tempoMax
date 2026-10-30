import { GoogleAuth, loadGoogleIdentityServices } from './auth/googleAuth';
import { GOOGLE_CLIENT_ID, GOOGLE_SCOPE } from './config';
import { DriveError, fetchDriveUser } from './storage/drive';

function requireElement<T extends Element>(parent: ParentNode, selector: string): T {
  const element = parent.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Elemento ${selector} non trovato`);
  }
  return element;
}

const appRoot = requireElement<HTMLDivElement>(document, '#app');

appRoot.innerHTML = `
  <h1>TempoMax</h1>
  <p id="status">Caricamento login Google…</p>
  <button id="connect" type="button" hidden>Accedi con Google</button>
  <button id="sign-out" type="button" hidden>Esci</button>
`;

const statusText = requireElement<HTMLParagraphElement>(appRoot, '#status');
const connectButton = requireElement<HTMLButtonElement>(appRoot, '#connect');
const signOutButton = requireElement<HTMLButtonElement>(appRoot, '#sign-out');

function showSignedOut(message: string): void {
  statusText.textContent = message;
  connectButton.textContent = 'Accedi con Google';
  connectButton.hidden = false;
  signOutButton.hidden = true;
}

try {
  await loadGoogleIdentityServices();
  const auth = new GoogleAuth(GOOGLE_CLIENT_ID, GOOGLE_SCOPE);
  showSignedOut('Non connesso');

  connectButton.addEventListener('click', async () => {
    connectButton.disabled = true;
    try {
      // requestToken() resta sincrono nel click quando il token manca: Safari blocca i popup dopo un await.
      const token = auth.currentToken() ?? (await auth.requestToken());
      const user = await fetchDriveUser(token);
      statusText.textContent = `Connesso come ${user.displayName} (${user.emailAddress}) — verificato ${new Date().toLocaleTimeString('it-IT')}`;
      connectButton.textContent = 'Controlla connessione';
      signOutButton.hidden = false;
    } catch (error) {
      if (error instanceof DriveError && error.status === 401) {
        auth.invalidateToken();
      }
      statusText.textContent = error instanceof Error ? error.message : String(error);
    } finally {
      connectButton.disabled = false;
    }
  });

  signOutButton.addEventListener('click', async () => {
    await auth.signOut();
    showSignedOut('Disconnesso');
  });
} catch (error) {
  statusText.textContent = error instanceof Error ? error.message : String(error);
}
