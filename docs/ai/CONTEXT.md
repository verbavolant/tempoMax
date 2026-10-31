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
| `src/main.ts` | bootstrap: registra il service worker (solo build), login Google caricato in background (l'app parte anche offline), `authorized()` (offline → errore immediato; token nel gesto; `invalidateToken` su 401), `VisitSession`, navigazione Home ↔ Clienti / Visite (`showSecondary`). Nessuna schermata di login: il token si chiede al primo tap |
| `src/style.css` | stile mobile, chiaro/scuro |
| `vite.config.ts` → `manifest.webmanifest` | manifest PWA generato per ambiente (nome, icone 192/512 + maskable, standalone) |
| `public/sw.js` | service worker: precache della pagina e dei file referenziati, network-first, solo stessa origine; cache `tempomax:<scope>:v1` |
| `public/icons/`, `public/icons-dev/` | icone PNG (Pillow: cronometro bianco su verde / arancione per la prova) |
| `src/ui/dom.ts` | `requireElement`, `errorMessage` |
| `src/visits/visitSession.ts` | `VisitSession`: `toggle()` (check-in/out al tap), `assignClient()`, `addAudio()`/`removeAudio()` (solo in locale), `addFreeNote()`, `syncAfter(task)`, GPS e cliente in background, coda di salvataggi su Drive, `view()` / `subscribe()` |
| `src/ui/home.ts` | `mountHomeScreen`: pulsante unico INIZIA/FINE con timer, nome cliente, avvisi, "🎤 Nota vocale" (sempre: a visita aperta va alla visita, altrimenti nota libera; ⏹ avvia il salvataggio), riga di navigazione Clienti / Visite / Note / Opzioni; in cima l'avviso "Dai un nome a questo telefono" (se manca) e il pannello dell'orario di lavoro; blocco del doppio tap per 2 s |
| `src/ui/visits.ts` | `mountVisitsScreen`: ultime 20 visite (Drive + locali; senza Drive solo locali), dettaglio con link Maps (se senza cliente), abbinamento, registrazioni ▶; `orderClientsByDistance`, `mergeVisits` |
| `src/ui/notePlayer.ts` | `NotePlayer` (un lettore per schermata), `loadNoteAudio` (telefono, altrimenti Drive con cache) |
| `src/device.ts` | `DeviceSettings` (localStorage `<prefisso>.device`), `guessDeviceName`, `normalizeDeviceName` (max 40 caratteri) |
| `src/ui/options.ts` | `mountOptionsScreen`: nome di questo telefono (qui arriverà il GPS disattivabile) |
| `src/ui/clients.ts` | `mountClientsScreen`: lista (cliente "📍 Sei qui" in cima, evidenziato), form nuovo/modifica, "Sono qui adesso"; `orderClientsForList` |
| `src/geo/mapsLink.ts` | `googleMapsUrl` (Maps URLs, azione search) |
| `src/register/visitRow.ts` | `REGISTER_HEADER` (A–I: … ID visita, Audio), `visitToRow`, `REGISTER_ID_COLUMN_INDEX`, `italianDate`, `clockTime` |
| `src/storage/layout.ts` | nomi di cartelle e file su Drive |
| `src/storage/audioStore.ts` | `AudioStore` (IndexedDB `tempomax`/`audio`): `put`/`get`/`delete` per id della nota, salva ArrayBuffer + tipo |
| `src/audio/recorder.ts` | `AudioRecording.start(onLimitReached)` / `stop()` (MediaRecorder, blocchi da 1 s, tetto 5 MB / 5 min), `audioMimeTypeCandidates`, `firstThatWorks`, `shouldStopForSize` |
| `src/storage/audioUploader.ts` | `AudioUploader.upload(visit | null, note)` → `TempoMax/audio/AAAA/` con `appProperties` (kind, recordedAt, durationSeconds, visitId), `deleteLocal`; `audioFileName`, `audioAppProperties`, `audioFileExtension` |
| `src/storage/localVisits.ts` | `LocalVisitStore` (localStorage `tempomax.visits`: `openVisit`, `unsyncedVisits`, `freeNotes`), `upsertVisit` |
| `src/storage/audioCatalog.ts` | `AudioCatalog.listYear` (una richiesta: file di `audio/AAAA` con `appProperties`), `download`; `catalogNoteFromDriveFile`, `mergeCatalog` |
| `src/ui/notes.ts` | `mountNotesScreen`: "Note libere" e "Note delle visite", ▶/⏸ da telefono o da Drive; senza Drive mostra quelle locali |
| `src/storage/visitsRepository.ts` | `VisitsRepository.save()` → `TempoMax/visite/AAAA/AAAA-MM-GG_<id>.json`; `listRecent(year, limit)` |
| `src/storage/sheetRegister.ts` | `SheetRegister.saveRow(id, row)`: Foglio generico in `TempoMax/` (intestazione, colonna ID, aggiorna o aggiunge) |
| `src/storage/visitRegister.ts` | `VisitRegister.save(visit, clientName)` → Foglio "Registro visite" (ID in colonna H) |
| `src/model/work.ts` | `WorkPeriod`, `WorkDayDocument`, `startWorkPeriod`, `endWorkPeriod`, `workedMilliseconds`, `workPeriodDate` |
| `src/storage/localWork.ts` | `LocalWorkStore` (localStorage `tempomax.work`: periodi recenti + `unsyncedIds`), `pruneLocalWork` |
| `src/storage/workRepository.ts` | `WorkRepository.save(period)`: lettura-modifica-scrittura di `lavoro/AAAA/AAAA-MM-GG.json` |
| `src/storage/workRegister.ts` | `WorkRegister.save(period)` → Foglio "Orario di lavoro" |
| `src/register/workRow.ts` | `WORK_REGISTER_HEADER`, `workPeriodToRow` |
| `src/work/workSession.ts` | `WorkSession.start()/stop()`, `view()` (periodo in corso, totale di oggi), coda verso Drive |
| `src/ui/workPanel.ts` | `mountWorkPanel`: "▶ Inizio lavoro" / "⏸ Fine lavoro" e riepilogo del giorno |
| `src/storage/clientsRepository.ts` | `ClientsRepository.load()` / `save()` su `TempoMax/clienti.json` |
| `src/model/time.ts` | `formatLocalIsoDateTime` (ora locale + fuso), `formatElapsed` (`H:MM:SS`), `formatHoursMinutes` (`H:MM`), `roundedMinutesBetween` (regola provvisoria) |
| `src/config.ts` | `GOOGLE_CLIENT_ID`, `GOOGLE_SCOPE` (non segreti) |
| `src/auth/googleAuth.ts` | `GoogleAuth`: token GIS in memoria, `currentToken()`, `requestToken()` (solo dentro un click), `invalidateToken()`, `signOut()` |
| `src/storage/drive.ts` | `DriveClient`: `getUser`, `ensureFolderPath` (con cache), `findFile`, `readJson`, `writeJson` (crea o sostituisce), `createFile` (multipart ≤ 5 MB), `updateFile`, `createEmptyFile`, `listFiles` (con `webViewLink` e `appProperties`), `uploadFile` (id + `webViewLink`, `appProperties`), `downloadFile`, `request` (anche per Sheets); `FileTooLargeError`; `DriveError` con status |
| `src/geo/distance.ts` | `distanceMeters` (Haversine, raggio GRS80), `findNearestClient`, `findClientAtPosition` (il più vicino tra i clienti che contengono la posizione nel raggio) |
| `src/geo/currentPosition.ts` | `readCurrentPosition()` → `MeasuredPosition`; `GeolocationError` con `reason` |
| `src/model/validation.ts` | `ValidationError` (con percorso del campo), helper `expect*`, `SCHEMA_VERSION` |
| `src/model/position.ts` | `Coordinates`, `MeasuredPosition` (con `accuracyMeters`) |
| `src/model/client.ts` | `Client`, `ClientsDocument` (`clienti.json`), `parseClientsDocument`, `buildClient`, `newClientIdentity`, `DEFAULT_CLIENT_RADIUS_METERS` (200) |
| `src/model/visit.ts` | `Visit` (`clientId` nullable, `audio: AudioNote[]`, assente nei JSON vecchi = `[]`), `VisitEvent`, `parseVisit`, `startVisit`, `endVisit`, `visitStorageLocation`, `visitDurationMinutes` (provvisoria: arrotonda al minuto) |
| `src/model/task.ts` | `Task` (`todo` / `purchase`), `TasksDocument` (`task.json`), `parseTasksDocument` |
| `vite.config.ts` | config di Vite + Vitest |
| `eslint.config.js` | lint (flat config, typescript-eslint) |
| `tsconfig.json` | type check (strict, solo `noEmit`: il build lo fa Vite) |

## Comandi
- Setup: `npm install` (Node ≥ 22.12; verificato con Node 26.4)
- Dev: `npm run dev` → http://localhost:5173/tempoMax/
- Prova: ramo `dev` → `git push staging dev:main` → https://verbavolant.github.io/tempoMax-dev/ ("TempoMax DEV", Drive `TempoMax-dev`)
- Produzione: **solo con conferma esplicita dell'utente** → merge `dev` in `main` → `git push origin main` → https://verbavolant.github.io/tempoMax/ (procedura in `docs/human/rilascio.md`, ADR-008)
- Test: `npm test`
- Lint/typecheck: `npm run lint` / `npm run typecheck`
- Build: `npm run build` (typecheck + `vite build` → `dist/`)
- Build di prova in locale: `VITE_APP_ENV=staging VITE_BASE=/tempoMax-dev/ npm run build`
- Ambienti (ADR-008): `src/config.ts` (`IS_STAGING`, `LOCAL_STORAGE_PREFIX`, `DRIVE_ROOT_FOLDER`), plugin `appEnvironment` in `vite.config.ts` (nome, icone, manifest generato)

## Layout dati su Drive (ADR-003)
```
TempoMax/
  clienti.json
  task.json                         # da fare + da comprare
  lavoro/AAAA/AAAA-MM-GG.json       # periodi di lavoro del giorno (inizio/fine, pause)
  Registro visite                   # Foglio Google: una riga per visita, link Maps e Audio (vista derivata)
  Orario di lavoro                  # Foglio Google: una riga per periodo di lavoro (vista derivata)
  visite/AAAA/AAAA-MM-GG_<idVisita>.json
  audio/AAAA/AAAA-MM-GG_<idVisita>_<idNota>.m4a   # note delle visite (≤ 5 MB, ADR-007)
  audio/AAAA/AAAA-MM-GG_libera_<idNota>.m4a       # note libere (senza visita)
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
