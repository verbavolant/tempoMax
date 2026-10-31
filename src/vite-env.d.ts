interface ImportMetaEnv {
  /** Ambiente di build (ADR-008): `staging` per la versione di prova; assente = produzione. */
  readonly VITE_APP_ENV?: 'production' | 'staging';
}
