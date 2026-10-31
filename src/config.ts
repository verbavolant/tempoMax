// Il Client ID OAuth non è un segreto: identifica l'app verso Google (docs/human/setup-google.md).
export const GOOGLE_CLIENT_ID = '372673515542-he937sbg1831d8kldccs2vjrk77u6517.apps.googleusercontent.com';

// Unico scope: non sensibile, vale per Drive e Sheets sui soli file creati dall'app (ADR-001).
export const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

/** Versione di prova (ADR-008): impostata dal workflow del repo `tempoMax-dev`. */
export const IS_STAGING = import.meta.env.VITE_APP_ENV === 'staging';

// Le due versioni condividono l'origine verbavolant.github.io, quindi localStorage e IndexedDB:
// prefissi diversi tengono separati i dati sul telefono.
export const LOCAL_STORAGE_PREFIX = IS_STAGING ? 'tempomax-dev' : 'tempomax';

/** Cartella principale su Drive: le prove non finiscono nei dati veri. */
export const DRIVE_ROOT_FOLDER = IS_STAGING ? 'TempoMax-dev' : 'TempoMax';
