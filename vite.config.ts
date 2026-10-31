import { type Plugin, loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

type AppEnvironment = 'production' | 'staging';

/**
 * Nome, colori e icone dell'app secondo l'ambiente (ADR-008): la versione di prova si installa
 * come app distinta ("TempoMax DEV", arancione). Il manifest è generato qui invece che statico in public/.
 */
function appEnvironment(environment: AppEnvironment): Plugin {
  const staging = environment === 'staging';
  const name = staging ? 'TempoMax DEV' : 'TempoMax';
  const iconDirectory = staging ? 'icons-dev' : 'icons';
  const themeColor = staging ? '#d35400' : '#2f7d32';
  const manifest = JSON.stringify(
    {
      name,
      short_name: name,
      description: 'Check-in e check-out delle visite, con salvataggio su Google Drive',
      lang: 'it',
      start_url: './',
      scope: './',
      display: 'standalone',
      background_color: '#f6f7f2',
      theme_color: themeColor,
      icons: [
        { src: `${iconDirectory}/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: `${iconDirectory}/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: `${iconDirectory}/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    null,
    2,
  );
  return {
    name: 'tempomax-app-environment',
    transformIndexHtml: {
      // Prima dell'elaborazione di Vite, che poi aggiunge il prefisso `base` agli indirizzi.
      order: 'pre',
      handler: (html) =>
        html
          .replaceAll('%APP_NAME%', name)
          .replaceAll('%ICON_DIR%', iconDirectory)
          .replaceAll('%THEME_COLOR%', themeColor),
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        // Il progetto non include i tipi di Node (codice per il browser): `url` è il campo di http.IncomingMessage.
        const { url } = request as { url?: string };
        if (url?.endsWith('/manifest.webmanifest')) {
          response.setHeader('Content-Type', 'application/manifest+json');
          response.end(manifest);
          return;
        }
        next();
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: manifest });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Solo variabili d'ambiente (impostate dal workflow), niente file .env.
  const env = loadEnv(mode, false, 'VITE_');
  const environment: AppEnvironment = env.VITE_APP_ENV === 'staging' ? 'staging' : 'production';
  return {
    // GitHub Pages pubblica ogni repo sotto /<nome-repo>/ (doc Vite "Deploying a Static Site").
    base: env.VITE_BASE ?? '/tempoMax/',
    plugins: [appEnvironment(environment)],
    test: {
      include: ['tests/**/*.test.ts'],
    },
  };
});
