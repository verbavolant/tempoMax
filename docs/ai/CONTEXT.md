# CONTEXT.md — Mappa del progetto

> Stato stabile del progetto. Cambia di rado. Leggilo a inizio sessione.

## Cos'è
TempoMax: una PWA per un giardiniere. Check-in/out geolocalizzato presso i clienti, note audio, liste "da fare" e "da comprare", ore per la fatturazione. I dati stanno sul suo Google Drive.

## Stack
- Linguaggio/runtime: TypeScript, nel browser (Safari iOS, Chrome Android).
- Framework/librerie: nessun framework UI; Vite come build tool; Vitest per i test (ADR-002).
- Storage: Google Drive (JSON + file audio) e un Foglio Google come registro ore; IndexedDB/localStorage come cache e coda locale.
- Servizi esterni: Google Identity Services (login OAuth, token client-side), Google Drive API v3, Google Sheets API v4.
- API del browser: Geolocation, MediaRecorder, IndexedDB, Service Worker.

## Struttura del repo
```
index.html        # entry di Vite
src/main.ts       # bootstrap dell'app
src/              # cartelle previste: auth/, storage/, geo/, model/, ui/
tests/            # test Vitest (*.test.ts), speculari a src/
docs/ai/          # stato per agenti AI
docs/human/       # documentazione per l'utente/setup
```

## File/moduli chiave
| Path | Responsabilità |
|------|----------------|
| `src/main.ts` | bootstrap: `authorized()` (token nel gesto + `invalidateToken` su 401), `VisitSession`, navigazione Home ↔ Clienti. Nessuna schermata di login: il token si chiede al primo tap |
| `src/style.css` | stile mobile, chiaro/scuro |
| `src/ui/dom.ts` | `requireElement`, `errorMessage` |
| `src/visits/visitSession.ts` | `VisitSession`: `toggle()` (check-in/out al tap), GPS e cliente in background, coda di salvataggi su Drive, `view()` / `subscribe()` |
| `src/ui/home.ts` | `mountHomeScreen`: pulsante unico INIZIA/FINE con timer, nome cliente, avvisi, pulsante "👥 Clienti"; blocco del doppio tap per 2 s |
| `src/ui/clients.ts` | `mountClientsScreen`: lista, form nuovo/modifica, "Sono qui adesso" |
| `src/geo/mapsLink.ts` | `googleMapsUrl` (Maps URLs, azione search) |
| `src/register/visitRow.ts` | `REGISTER_HEADER`, `visitToRow`, `REGISTER_ID_COLUMN_INDEX` |
| `src/storage/layout.ts` | nomi di cartelle e file su Drive |
| `src/storage/localVisits.ts` | `LocalVisitStore` (localStorage `tempomax.visits`: `openVisit` + `unsyncedVisits`), `upsertVisit` |
| `src/storage/visitsRepository.ts` | `VisitsRepository.save()` → `TempoMax/visite/AAAA/AAAA-MM-GG_<id>.json` |
| `src/storage/clientsRepository.ts` | `ClientsRepository.load()` / `save()` su `TempoMax/clienti.json` |
| `src/model/time.ts` | `formatLocalIsoDateTime` (ora locale + fuso), `formatElapsed` (`H:MM:SS`) |
| `src/config.ts` | `GOOGLE_CLIENT_ID`, `GOOGLE_SCOPE` (non segreti) |
| `src/auth/googleAuth.ts` | `GoogleAuth`: token GIS in memoria, `currentToken()`, `requestToken()` (solo dentro un click), `invalidateToken()`, `signOut()` |
| `src/storage/drive.ts` | `DriveClient`: `getUser`, `ensureFolderPath` (con cache), `findFile`, `readJson`, `writeJson` (crea o sostituisce), `createFile` (multipart ≤ 5 MB), `updateFile`; `DriveError` con status |
| `src/geo/distance.ts` | `distanceMeters` (Haversine, raggio GRS80), `findNearestClient`, `findClientAtPosition` (il più vicino tra i clienti che contengono la posizione nel raggio) |
| `src/geo/currentPosition.ts` | `readCurrentPosition()` → `MeasuredPosition`; `GeolocationError` con `reason` |
| `src/model/validation.ts` | `ValidationError` (con percorso del campo), helper `expect*`, `SCHEMA_VERSION` |
| `src/model/position.ts` | `Coordinates`, `MeasuredPosition` (con `accuracyMeters`) |
| `src/model/client.ts` | `Client`, `ClientsDocument` (`clienti.json`), `parseClientsDocument`, `buildClient`, `newClientIdentity`, `DEFAULT_CLIENT_RADIUS_METERS` (200) |
| `src/model/visit.ts` | `Visit` (`clientId` nullable), `VisitEvent`, `parseVisit`, `startVisit`, `endVisit`, `visitStorageLocation`, `visitDurationMinutes` (provvisoria: arrotonda al minuto) |
| `src/model/task.ts` | `Task` (`todo` / `purchase`), `TasksDocument` (`task.json`), `parseTasksDocument` |
| `vite.config.ts` | config di Vite + Vitest |
| `eslint.config.js` | lint (flat config, typescript-eslint) |
| `tsconfig.json` | type check (strict, solo `noEmit`: il build lo fa Vite) |

## Comandi
- Setup: `npm install` (Node ≥ 22.12; verificato con Node 26.4)
- Dev: `npm run dev` → http://localhost:5173
- Test: `npm test`
- Lint/typecheck: `npm run lint` / `npm run typecheck`
- Build: `npm run build` (typecheck + `vite build` → `dist/`)

## Layout dati su Drive (ADR-003)
```
TempoMax/
  clienti.json
  task.json                         # da fare + da comprare
  visite/AAAA/AAAA-MM-GG_<idVisita>.json
  audio/AAAA/<idVisita>_<n>.<m4a|webm>
  Registro ore (Foglio Google)
```

## Convenzioni del progetto
- Identificatori e codice in inglese; UI e documentazione in italiano.
- Orari salvati in ISO 8601 con offset; la durata si calcola, non si memorizza come fonte di verità.
- Ogni scrittura su Drive passa da `storage/`: la UI non chiama mai le API Google direttamente.
- Da evitare: framework UI pesanti, dipendenze non necessarie, chiamate a servizi diversi da Google.

## Glossario di dominio
| Termine | Significato |
|---------|-------------|
| Cliente | Luogo/persona dove il giardiniere lavora; ha delle coordinate e un raggio di tolleranza |
| Visita | Intervallo tra un check-in e un check-out presso un cliente |
| Check-in / Check-out | Inizio/fine di una visita, con orario e posizione GPS |
| Raggio | Distanza massima (metri) dal punto del cliente oltre la quale il check-in mostra un avviso |
| Da fare | Lavoro ancora da svolgere per un cliente; resta aperto finché non viene chiuso |
| Da comprare | Materiale da acquistare per un cliente |
| Registro ore | Foglio Google con una riga per visita, base per la fatturazione |
