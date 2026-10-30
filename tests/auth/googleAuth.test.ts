import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthError, GoogleAuth } from '../../src/auth/googleAuth';

const SCOPE = 'https://www.googleapis.com/auth/drive.file';

type TokenClientConfig = google.accounts.oauth2.TokenClientConfig;
type TokenResponse = google.accounts.oauth2.TokenResponse;
type ClientErrorType = google.accounts.oauth2.ClientConfigError['type'];

function installFakeGoogleIdentityServices() {
  let config: TokenClientConfig | undefined;
  const requestAccessToken = vi.fn();
  const revoke = vi.fn((_token: string, done: () => void) => done());
  vi.stubGlobal('google', {
    accounts: {
      oauth2: {
        initTokenClient: (clientConfig: TokenClientConfig) => {
          config = clientConfig;
          return { requestAccessToken };
        },
        hasGrantedAllScopes: (response: TokenResponse, scope: string) => response.scope.split(' ').includes(scope),
        revoke,
      },
    },
  });
  const requireConfig = () => {
    if (!config) throw new Error('initTokenClient non chiamato');
    return config;
  };
  return {
    requestAccessToken,
    revoke,
    config: requireConfig,
    respond: (response: Partial<TokenResponse>) =>
      requireConfig().callback({ scope: SCOPE, expires_in: '3599', ...response } as TokenResponse),
    fail: (type: ClientErrorType) =>
      requireConfig().error_callback?.({ type, message: type, name: 'Error' }),
  };
}

describe('GoogleAuth', () => {
  let gis: ReturnType<typeof installFakeGoogleIdentityServices>;
  let now: number;
  let auth: GoogleAuth;

  beforeEach(() => {
    gis = installFakeGoogleIdentityServices();
    now = 1_000_000;
    auth = new GoogleAuth('client-id', SCOPE, () => now);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('configura il token client con consenso solo al primo accesso', () => {
    expect(gis.config()).toMatchObject({ client_id: 'client-id', scope: SCOPE, prompt: '' });
  });

  it('restituisce il token ricevuto e lo considera valido fino a poco prima della scadenza', async () => {
    const tokenPromise = auth.requestToken();
    gis.respond({ access_token: 'abc', expires_in: '3600' });
    await expect(tokenPromise).resolves.toBe('abc');

    now += 3600_000 - 60_001;
    expect(auth.currentToken()).toBe('abc');
    now += 1;
    expect(auth.currentToken()).toBeNull();
  });

  it('non ha token prima del login', () => {
    expect(auth.currentToken()).toBeNull();
  });

  it('richieste concorrenti condividono lo stesso popup', async () => {
    const first = auth.requestToken();
    const second = auth.requestToken();
    expect(gis.requestAccessToken).toHaveBeenCalledTimes(1);
    gis.respond({ access_token: 'abc' });
    await expect(first).resolves.toBe('abc');
    await expect(second).resolves.toBe('abc');
  });

  it('rifiuta se il popup viene chiuso, e permette di riprovare', async () => {
    const failed = auth.requestToken();
    gis.fail('popup_closed');
    await expect(failed).rejects.toMatchObject({ reason: 'popup_closed' });

    const retried = auth.requestToken();
    expect(gis.requestAccessToken).toHaveBeenCalledTimes(2);
    gis.respond({ access_token: 'abc' });
    await expect(retried).resolves.toBe('abc');
  });

  it('rifiuta se Google restituisce un errore', async () => {
    const tokenPromise = auth.requestToken();
    gis.respond({ error: 'access_denied' });
    await expect(tokenPromise).rejects.toMatchObject({ reason: 'token_error' });
  });

  it('rifiuta se il permesso Drive non è stato concesso', async () => {
    const tokenPromise = auth.requestToken();
    gis.respond({ access_token: 'abc', scope: 'email profile' });
    await expect(tokenPromise).rejects.toMatchObject({ reason: 'scope_not_granted' });
    expect(auth.currentToken()).toBeNull();
  });

  it.each(['', '0', 'non-numero'])('rifiuta una durata non valida (%j)', async (expiresIn) => {
    const tokenPromise = auth.requestToken();
    gis.respond({ access_token: 'abc', expires_in: expiresIn });
    await expect(tokenPromise).rejects.toBeInstanceOf(AuthError);
  });

  it('invalidateToken dimentica il token senza revocarlo', async () => {
    const tokenPromise = auth.requestToken();
    gis.respond({ access_token: 'abc' });
    await tokenPromise;
    auth.invalidateToken();
    expect(auth.currentToken()).toBeNull();
    expect(gis.revoke).not.toHaveBeenCalled();
  });

  it('signOut revoca il token e lo dimentica', async () => {
    const tokenPromise = auth.requestToken();
    gis.respond({ access_token: 'abc' });
    await tokenPromise;
    await auth.signOut();
    expect(gis.revoke).toHaveBeenCalledWith('abc', expect.any(Function));
    expect(auth.currentToken()).toBeNull();
  });
});
