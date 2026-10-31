# PROGRESS.md — Diario di avanzamento (append-only)

> Una voce per task chiuso (o per chiusura di sessione).
> Scritto per chi riprende SENZA il contesto attuale. Voce più recente in alto.

<!-- Template di una voce:

## [AAAA-MM-GG] — T-XXX <titolo>
- Fatto: <cosa è cambiato in concreto: file, funzioni>
- Stato: <completo | parziale + cosa manca>
- Verifica: <comando lanciato + esito>
- Prossimo passo: <istruzione operativa per chi riprende>
- Trappole/note: <cose non ovvie scoperte qui>

-->

## [2026-10-31] — T-022, T-023, T-011a, T-011b (registro parziale)
- Fatto: T-008b confermato dall'utente. T-022: `DEFAULT_CLIENT_RADIUS_METERS` = 200 (i clienti già salvati tengono il loro raggio). T-023: "👥 Clienti" è un pulsante (`.secondary-button`). T-011a: `src/geo/mapsLink.ts`, `visitDurationMinutes`, `src/register/visitRow.ts`. T-011b: `createEmptyFile` e `request` pubblico in `DriveClient`, `src/storage/visitRegister.ts`, `VisitSession` salva il JSON e poi la riga del registro, wiring in `src/main.ts`.
- Stato: T-022, T-023, T-011a completi; T-011b parziale (manca la prova reale).
- Verifica: `npm test` (141), typecheck, lint, build OK. Controprova: con "aggiungi sempre" al posto di "aggiorna la riga" fallisce il test anti-duplicati.
- Prossimo passo: l'utente fa INIZIA/FINE e controlla `TempoMax/Registro visite` (intestazione + una riga, link cliccabili); poi T-010.
- Trappole/note: creare il Foglio con Drive `files.create` + mimeType spreadsheet è documentato nella guida Sheets "Create" (non in quella Drive). Intervalli senza nome del foglio solo nella forma limitata "A1:B2" (documentata): ricerca dell'ID in `H1:H10000`. *Ipotesi*: un URL scritto RAW è cliccabile; da verificare. La durata usa l'arrotondamento al minuto più vicino (provvisorio, in `visitDurationMinutes`).

## [2026-10-31] — T-008b Pulsante unico INIZIA / FINE (parziale)
- Fatto: `src/visits/visitSession.ts`, `src/ui/home.ts`, `formatElapsed` in `src/model/time.ts`, `src/main.ts` riscritto (Home all'avvio, Clienti come schermata secondaria; tolti i pulsanti "Accedi" ed "Esci"), stile del pulsante grande in `src/style.css`. Test: `tests/visits/visitSession.test.ts` (9), `formatElapsed` (6); totale 124.
- Stato: parziale. Manca la prova manuale: INIZIA → ricarica → FINE con login e GPS reali, poi il JSON su Drive.
- Verifica: `npm test`, typecheck, lint e build OK. Screenshot headless della home: pulsante centrato (a 390 px Chrome headless sposta il layout, a 500 px è corretto).
- Prossimo passo: prova dell'utente → chiudere T-008b → T-010 (deploy + iPhone).
- Trappole/note: un test ha trovato un bug vero. Con un check-out prima della risposta GPS del check-in, l'operazione del check-in salvava su Drive una versione intermedia e la toglieva dalla coda, e la posizione del check-out andava persa. Risolto con `latestVisits`, che conserva l'ultima versione di ogni visita della sessione. La coda delle operazioni vive solo in memoria: dopo una ricarica, le visite in `unsyncedVisits` si risalvano al primo tap. Il nome del cliente sulla home compare solo dopo il primo caricamento dell'anagrafica nella sessione.

## [2026-10-31] — T-008a Visite: modello, archivio locale, Drive
- Fatto: `src/model/visit.ts` (`clientId` nullable, `startVisit`, `endVisit`, `visitStorageLocation`), `src/storage/localVisits.ts`, `src/storage/visitsRepository.ts`, `VISITS_FOLDER` in `layout.ts`, `findClientAtPosition` in `src/geo/distance.ts`. T-008 diviso in T-008a/T-008b (troppi file per un solo task). Test: 109 passati.
- Stato: completo.
- Verifica: `npm test`, typecheck, lint OK. Controprova: con "il più vicino in assoluto" al posto di "il più vicino tra quelli che contengono la posizione" fallisce il test dedicato.
- Prossimo passo: T-008b (`src/visits/visitSession.ts` + `src/ui/home.ts`, pulsante unico).
- Trappole/note: anno e nome del file vengono dalla stringa locale `checkIn.at` (`slice`), non da `Date`, così una visita a mezzanotte e mezza del 1° gennaio finisce nel giorno locale giusto. *Ipotesi da verificare*: Safari può cancellare il localStorage dei siti non usati da giorni (ITP); per una PWA installata dovrebbe non valere. Le visite non sincronizzate restano a rischio finché non arrivano su Drive: verificare in T-010/T-019.

## [2026-10-31] — T-007 chiuso + ripianificazione della schermata principale
- Fatto: T-007 verificato dall'utente. Su sua richiesta la UI principale diventa un pulsante unico, con il cliente facoltativo: aggiornati `PLAN.md`, `TASKS.md` (T-008 riscritto, T-009 rimandato, nuovo T-021) e ADR-006.
- Stato: in attesa della risposta dell'utente sull'associazione automatica del cliente (TASKS → Bloccati).
- Verifica: —
- Prossimo passo: con la risposta → T-008.
- Trappole/note: l'utente vuole aggiungere le funzioni un po' alla volta, senza appesantire la schermata principale.

## [2026-10-30] — T-007 Anagrafica clienti (parziale)
- Fatto: `src/model/time.ts`, `buildClient`/`newClientIdentity`/`DEFAULT_CLIENT_RADIUS_METERS` in `src/model/client.ts`, `src/storage/layout.ts`, `src/storage/clientsRepository.ts`, `src/ui/dom.ts`, `src/ui/clients.ts`, `src/style.css`; `src/main.ts` riscritto (via la schermata di prova di Drive). Test: `tests/model/time.test.ts`, `buildClient` in `tests/model/client.test.ts`, `tests/storage/clientsRepository.test.ts`.
- Stato: parziale. Manca la prova manuale: creare e modificare un cliente con "Sono qui adesso" e controllare `TempoMax/clienti.json` su Drive.
- Verifica: `npm test` (89 passati), typecheck, lint e build OK. Controprova: invertendo il segno del fuso falliscono i 6 test di `time.test.ts`.
- Prossimo passo: prova dell'utente → chiudere T-007 → T-008 (check-in).
- Trappole/note: "+ Nuovo cliente" resta disattivato finché `load()` non riesce, altrimenti un salvataggio partendo da una lista vuota sovrascriverebbe `clienti.json`. Nei test usare `vi.stubEnv('TZ', …)` (niente `@types/node` nel progetto). `authorized()` deve essere chiamato prima di qualsiasi `await` nel gestore del click. Non c'è ancora l'eliminazione dei clienti (non richiesta: le visite li referenziano).

## [2026-10-30] — T-006 Geolocalizzazione + distanza
- Fatto: `src/geo/distance.ts` (`EARTH_MEAN_RADIUS_METERS`, `distanceMeters`, `findNearestClient`), `src/geo/currentPosition.ts` (`readCurrentPosition`, `GeolocationError`). Test in `tests/geo/` (13). Fonti in ADR-004.
- Stato: completo.
- Verifica: `npm test` (74 passati), typecheck e lint OK. Controprova: togliendo un fattore coseno dalla formula falliscono il test Rosetta e quello di simmetria.
- Prossimo passo: T-007 (anagrafica clienti: lista, "sono qui adesso", modifica, salvataggio in `TempoMax/clienti.json`). Da decidere con l'utente il raggio di default dei nuovi clienti.
- Trappole/note: `readCurrentPosition` non è ancora stato provato su un dispositivo reale (solo test con `navigator` finto); lo si proverà in T-007. Timeout 20 s e `maximumAge` 30 s sono scelte di prodotto (costanti in `currentPosition.ts`). ESLint `no-loss-of-precision`: i letterali di riferimento vanno scritti nella forma più breve che rappresenta esattamente il double (es. `2886.4444428379834`).

## [2026-10-30] — T-004 Modulo storage Drive (chiuso)
- Fatto: nessun cambio al codice rispetto alla voce precedente.
- Stato: completo.
- Verifica: l'utente ha cliccato due volte "Prova salvataggio su Drive": "riletto uguale ✓", stesso file id alla seconda scrittura, un solo `TempoMax/prova.json` su Drive. Multipart e PATCH media confermati sull'API reale.
- Prossimo passo: T-006 (geolocalizzazione + Haversine, test su distanze note da fonte citata).
- Trappole/note: su Drive resta `TempoMax/prova.json`: l'utente può cancellarlo a mano.

## [2026-10-30] — T-004 Modulo storage Drive (parziale)
- Fatto: `src/storage/drive.ts` riscritto attorno a `DriveClient(getAccessToken)`; `fetchDriveUser` è diventato `getUser()`. `src/main.ts` ha un pulsante provvisorio "Prova salvataggio su Drive" (scrive e rilegge `TempoMax/prova.json`). Test in `tests/storage/drive.test.ts` (14).
- Stato: parziale. Manca la prova sul Drive reale.
- Verifica: `npm test` (61 passati), typecheck e lint OK. Controprove: senza escaping e senza pulizia della cache falliscono i test attesi.
- Prossimo passo: l'utente clicca due volte "Prova salvataggio su Drive" (1ª volta crea, 2ª aggiorna lo stesso file id), controlla su drive.google.com che esista un solo `TempoMax/prova.json`, poi si chiude T-004.
- Trappole/note: l'alias `root` dei parents non è documentato nelle pagine Drive consultate, quindi non lo uso: la cartella radice si cerca per nome senza vincolo di genitore (con `drive.file` sono visibili solo i file dell'app). Upload multipart limitato a 5.000.000 byte (doc: "5 MB or less"): l'audio lungo richiederà l'upload resumable (TODO in T-014). La cache delle cartelle vive solo in memoria: se l'utente cancella la cartella su Drive durante la sessione, le scritture falliscono con 404 fino al ricaricamento. Con file omonimi `findOne` prende il più vecchio (`orderBy=createdTime`).

## [2026-10-30] — T-003 Login Google (chiuso)
- Fatto: nessun cambio al codice rispetto alla voce precedente.
- Stato: completo. T-002 completo: l'app è "In production".
- Verifica: l'utente ha fatto login da `localhost:5173` e la pagina mostra "Connesso come …" (about.get OK).
- Prossimo passo: T-004 (modulo storage Drive: cartella `TempoMax/`, lettura/scrittura JSON, upload binari).
- Trappole/note: il rinnovo del token dopo la scadenza reale (circa 1 h) non è ancora stato osservato: va inserito nella checklist di T-010.

## [2026-10-30] — T-003 Login Google (parziale)
- Fatto: `src/config.ts` (Client ID + scope), `src/auth/googleAuth.ts` (`loadGoogleIdentityServices`, `GoogleAuth`, `AuthError`), `src/storage/drive.ts` (`fetchDriveUser` → about.get), schermata provvisoria in `src/main.ts`. Aggiunto `@types/google.accounts@0.0.18` (in `tsconfig.json` → `types`). Test: `tests/auth/googleAuth.test.ts` (GIS finto), `tests/storage/drive.test.ts` (fetch simulato).
- Stato: parziale. Manca la prova manuale con login reale (Safari su Mac, `localhost:5173`), compreso il rinnovo dopo la scadenza.
- Verifica: `npm test` (50 passati), typecheck, lint, build OK; il dev server non invia l'header COOP.
- Prossimo passo: l'utente prova il login; se va, segnare T-003 [x] e passare a T-004 (il resto del modulo Drive).
- Trappole/note: il token sta **solo in memoria**: a ogni ricarica della pagina serve un tap su "Accedi" (senza consenso, `prompt: ''`). Valutare la persistenza (es. localStorage con scadenza) dopo la prova su iPhone in T-010, scrivendo un ADR. Nei tipi `expires_in` è una `string`: si converte con `Number()`. In caso di 401 si usa `invalidateToken()` e non `signOut()`: con un token già invalido non è documentato se `revoke` chiami la callback.

## [2026-10-30] — T-005 Modello dati
- Fatto: `src/model/validation.ts`, `position.ts`, `client.ts`, `visit.ts`, `task.ts` con interfacce e parser; test in `tests/model/` (35). Rimosso `passWithNoTests` da `vite.config.ts`. ADR-005 (validazione scritta a mano).
- Stato: completo.
- Verifica: `npm test` (35 passati), `npm run typecheck`, `npm run lint`, `npm run build` → OK. Controprova: disattivato il controllo del calendario, falliscono i 3 test attesi.
- Prossimo passo: T-006 (geolocalizzazione + Haversine, con test su distanze note da fonte citata). T-003 resta in attesa del Client ID (T-002).
- Trappole/note: `Visit.checkIn.position` / `checkOut.position` possono essere `null` (GPS negato o assente): il check-in non va bloccato. `Client.location` è facoltativa. `Task.clientId` è obbligatorio (ogni voce è legata a un cliente). Il raggio di default per i nuovi clienti non è nel modello: si decide in T-007. Durata della visita e audio non sono campi: la durata si calcola (T-012), l'audio arriva con la Fase 3 e una nuova versione dello schema se serve.

## [2026-10-30] — T-002 Guida setup Google Cloud (parziale)
- Fatto: `docs/human/setup-google.md`: progetto, API Drive+Sheets, Branding/Audience External, scope `drive.file`, client Web con origini `https://verbavolant.github.io`, `http://localhost`, `http://localhost:5173`, pubblicazione "In production". Passaggi verificati sulla doc ufficiale (fonti nella guida).
- Stato: parziale. L'utente deve eseguire la guida e fornire il Client ID.
- Verifica: confronto con la doc Google (link nella guida). Non eseguita nella console dall'agente.
- Prossimo passo: con il Client ID → T-003. Senza → T-005 (modello dati), che non dipende da Google.
- Trappole/note: le origini non hanno path (niente `/tempoMax/`). La posizione esatta del pulsante "Publish app" (pagina Audience) non è documentata con precisione: da confermare a schermo. Il Client secret non serve (token model client-side).

## [2026-10-30] — T-001 Scaffold progetto
- Fatto: `package.json` (script dev/build/test/lint/typecheck), `tsconfig.json`, `vite.config.ts` (Vitest), `eslint.config.js` (flat config, `defineConfig` da `eslint/config`), `index.html`, `src/main.ts`. Aggiunta la sezione TypeScript a `docs/ai/CONVENTIONS.md`; comandi e file chiave in `CONTEXT.md`.
- Stato: completo.
- Verifica: `npm run typecheck`, `npm run lint`, `npm test` (exit 0, nessun test) e `npm run build` → OK; `npx vite` serve `index.html` su :5173.
- Prossimo passo: T-002 (guida Google Cloud in `docs/human/setup-google.md`, poi console a cura dell'utente) oppure T-005 (modello dati), che non dipende da Google.
- Trappole/note: TypeScript fissato a `~6.0.3`, perché `typescript-eslint@8.72.1` non supporta la 7.x. `tseslint.config()` è deprecato: usare `defineConfig`. `passWithNoTests` è temporaneo (da togliere in T-005). Il `base: '/tempoMax/'` per GitHub Pages arriva in T-010.

## [2026-10-30] — Creazione repository GitHub
- Fatto: `git init` (branch `main`), `.gitignore` di base, repo pubblico https://github.com/verbavolant/tempoMax con push del piano. Installato `gh` via Homebrew, autenticato come `verbavolant` (protocollo https).
- Stato: completo.
- Verifica: `git status -sb` → `main...origin/main`.
- Prossimo passo: T-001 (scaffold Vite + TS + Vitest); in parallelo l'utente esegue T-002 (Google Cloud, app in "In production").
- Trappole/note: repo pubblico perché GitHub Pages gratis lo richiede; non committare mai dati dei clienti o token.

## [2026-10-30] — Pianificazione iniziale
- Fatto: compilati `docs/ai/PLAN.md` (5 fasi), `CONTEXT.md`, `DECISIONS.md` (ADR-001…004) e `TASKS.md` (T-001…T-020). Nessun codice scritto.
- Stato: completo; il piano è in attesa di conferma da parte dell'utente.
- Verifica: —
- Prossimo passo: dopo la conferma, eseguire T-001 (scaffold, con `git init`). T-002 (Google Cloud) lo fa l'utente in parallelo.
- Trappole/note: primo test su iPhone, poi Android. Ore usate per fatturare: la regola di arrotondamento è ancora da decidere (vedi "Bloccati" in TASKS). La Sheets API con il solo scope `drive.file` è un'ipotesi da verificare.

## [AAAA-MM-GG] — Inizializzazione
- Fatto: creata struttura `docs/ai/`, importato `CLAUDE.md`.
- Stato: completo.
- Verifica: —
- Prossimo passo: compilare `CONTEXT.md` e `PLAN.md`, poi creare i primi task in `TASKS.md`.
- Trappole/note: —
