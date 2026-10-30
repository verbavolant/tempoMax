const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

// Un token che scade durante una richiesta a Drive causerebbe un 401: lo consideriamo scaduto un po' prima.
const EXPIRY_MARGIN_MS = 60_000;

export type AuthErrorReason =
  | google.accounts.oauth2.ClientConfigError['type']
  | 'scope_not_granted'
  | 'invalid_response'
  | 'token_error';

export class AuthError extends Error {
  readonly reason: AuthErrorReason;

  constructor(reason: AuthErrorReason, message: string) {
    super(message);
    this.name = 'AuthError';
    this.reason = reason;
  }
}

interface AccessToken {
  value: string;
  expiresAt: number;
}

interface PendingRequest {
  promise: Promise<string>;
  resolve: (token: string) => void;
  reject: (error: AuthError) => void;
}

export function loadGoogleIdentityServices(): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Impossibile caricare il login Google: controlla la connessione'));
    document.head.append(script);
  });
}

export class GoogleAuth {
  private token: AccessToken | null = null;
  private pending: PendingRequest | null = null;
  private readonly tokenClient: google.accounts.oauth2.TokenClient;

  constructor(
    clientId: string,
    private readonly scope: string,
    private readonly now: () => number = Date.now,
  ) {
    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope,
      // Il consenso viene chiesto solo la prima volta; i rinnovi successivi non lo ripropongono.
      prompt: '',
      callback: (response) => this.handleTokenResponse(response),
      error_callback: (error) => this.settle(new AuthError(error.type, describeClientError(error.type))),
    });
  }

  /** Token ancora valido, oppure null se serve chiamare `requestToken()`. */
  currentToken(): string | null {
    if (this.token && this.token.expiresAt - EXPIRY_MARGIN_MS > this.now()) {
      return this.token.value;
    }
    return null;
  }

  /**
   * Apre il popup di Google. Va chiamato in modo sincrono dentro un gestore di click:
   * Safari blocca i popup aperti dopo un `await`.
   */
  requestToken(): Promise<string> {
    if (this.pending) {
      return this.pending.promise;
    }
    let resolve!: (token: string) => void;
    let reject!: (error: AuthError) => void;
    const promise = new Promise<string>((onResolve, onReject) => {
      resolve = onResolve;
      reject = onReject;
    });
    this.pending = { promise, resolve, reject };
    this.tokenClient.requestAccessToken();
    return promise;
  }

  /** Da usare quando Google rifiuta il token (401) prima della scadenza prevista. */
  invalidateToken(): void {
    this.token = null;
  }

  signOut(): Promise<void> {
    const token = this.token;
    this.token = null;
    if (!token) {
      return Promise.resolve();
    }
    return new Promise((resolve) => google.accounts.oauth2.revoke(token.value, resolve));
  }

  private handleTokenResponse(response: google.accounts.oauth2.TokenResponse): void {
    if (response.error) {
      this.settle(new AuthError('token_error', `Accesso Google non riuscito: ${response.error}`));
      return;
    }
    if (!google.accounts.oauth2.hasGrantedAllScopes(response, this.scope)) {
      this.settle(
        new AuthError('scope_not_granted', "Serve il permesso di salvare i file su Google Drive: riprova e accettalo"),
      );
      return;
    }
    const lifetimeSeconds = Number(response.expires_in);
    if (!response.access_token || !Number.isFinite(lifetimeSeconds) || lifetimeSeconds <= 0) {
      this.settle(new AuthError('invalid_response', 'Risposta di Google non valida'));
      return;
    }
    this.token = { value: response.access_token, expiresAt: this.now() + lifetimeSeconds * 1000 };
    this.settle(response.access_token);
  }

  private settle(outcome: string | AuthError): void {
    const pending = this.pending;
    this.pending = null;
    if (!pending) {
      return;
    }
    if (outcome instanceof AuthError) {
      pending.reject(outcome);
    } else {
      pending.resolve(outcome);
    }
  }
}

function describeClientError(type: google.accounts.oauth2.ClientConfigError['type']): string {
  switch (type) {
    case 'popup_closed':
      return 'Finestra di accesso chiusa prima di completare il login';
    case 'popup_failed_to_open':
      return 'Il browser ha bloccato la finestra di accesso Google';
    case 'unknown':
      return 'Errore sconosciuto durante il login Google';
  }
}
