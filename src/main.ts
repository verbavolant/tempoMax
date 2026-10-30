import { GoogleAuth, loadGoogleIdentityServices } from './auth/googleAuth';
import { GOOGLE_CLIENT_ID, GOOGLE_SCOPE } from './config';
import { DriveClient, DriveError } from './storage/drive';

function requireElement<T extends Element>(parent: ParentNode, selector: string): T {
  const element = parent.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Elemento ${selector} non trovato`);
  }
  return element;
}

const appRoot = requireElement<HTMLDivElement>(document, '#app');

// Schermata provvisoria di verifica (T-003/T-004): verrà sostituita dalla UI di T-007/T-008.
appRoot.innerHTML = `
  <h1>TempoMax</h1>
  <p id="status">Caricamento login Google…</p>
  <button id="connect" type="button" hidden>Accedi con Google</button>
  <button id="drive-test" type="button" hidden>Prova salvataggio su Drive</button>
  <button id="sign-out" type="button" hidden>Esci</button>
  <pre id="output"></pre>
`;

const statusText = requireElement<HTMLParagraphElement>(appRoot, '#status');
const connectButton = requireElement<HTMLButtonElement>(appRoot, '#connect');
const driveTestButton = requireElement<HTMLButtonElement>(appRoot, '#drive-test');
const signOutButton = requireElement<HTMLButtonElement>(appRoot, '#sign-out');
const output = requireElement<HTMLPreElement>(appRoot, '#output');

function showSignedOut(message: string): void {
  statusText.textContent = message;
  connectButton.textContent = 'Accedi con Google';
  connectButton.hidden = false;
  driveTestButton.hidden = true;
  signOutButton.hidden = true;
}

try {
  await loadGoogleIdentityServices();
  const auth = new GoogleAuth(GOOGLE_CLIENT_ID, GOOGLE_SCOPE);
  const drive = new DriveClient(() => auth.currentToken());
  showSignedOut('Non connesso');

  const runWithToken = (button: HTMLButtonElement, action: () => Promise<void>) => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        // requestToken() resta sincrono nel click quando il token manca: Safari blocca i popup dopo un await.
        if (!auth.currentToken()) {
          await auth.requestToken();
        }
        await action();
      } catch (error) {
        if (error instanceof DriveError && error.status === 401) {
          auth.invalidateToken();
        }
        statusText.textContent = error instanceof Error ? error.message : String(error);
      } finally {
        button.disabled = false;
      }
    });
  };

  runWithToken(connectButton, async () => {
    const user = await drive.getUser();
    statusText.textContent = `Connesso come ${user.displayName} (${user.emailAddress}) — verificato ${new Date().toLocaleTimeString('it-IT')}`;
    connectButton.textContent = 'Controlla connessione';
    driveTestButton.hidden = false;
    signOutButton.hidden = false;
  });

  runWithToken(driveTestButton, async () => {
    const folderId = await drive.ensureFolderPath(['TempoMax']);
    const written = { prova: true, scrittoAlle: new Date().toISOString() };
    const fileId = await drive.writeJson('prova.json', folderId, written);
    const readBack = await drive.readJson(fileId);
    const matches = JSON.stringify(readBack) === JSON.stringify(written);
    output.textContent = `cartella TempoMax: ${folderId}\nprova.json: ${fileId}\nriletto ${matches ? 'uguale ✓' : 'DIVERSO ✗'}:\n${JSON.stringify(readBack, null, 2)}`;
  });

  signOutButton.addEventListener('click', async () => {
    await auth.signOut();
    output.textContent = '';
    showSignedOut('Disconnesso');
  });
} catch (error) {
  statusText.textContent = error instanceof Error ? error.message : String(error);
}
