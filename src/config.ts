// Il Client ID OAuth non è un segreto: identifica l'app verso Google (docs/human/setup-google.md).
export const GOOGLE_CLIENT_ID = '372673515542-he937sbg1831d8kldccs2vjrk77u6517.apps.googleusercontent.com';

// Unico scope: non sensibile, vale per Drive e Sheets sui soli file creati dall'app (ADR-001).
export const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
