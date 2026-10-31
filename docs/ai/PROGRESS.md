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

## [2026-10-31] — T-031a, T-031b: ambiente di prova
- Fatto: ADR-008. T-031a: `src/config.ts` (`IS_STAGING`, `LOCAL_STORAGE_PREFIX`, `DRIVE_ROOT_FOLDER`), `src/vite-env.d.ts`, chiavi di localStorage e nome IndexedDB con prefisso, `ROOT_FOLDER` da configurazione, plugin `appEnvironment` in `vite.config.ts` (manifest generato, nome, icone e colore per ambiente; `base` da `VITE_BASE`), `index.html` con segnaposto e manifest relativo, `public/icons-dev/`, cache del service worker per scope. T-031b: repo pubblico `verbavolant/tempoMax-dev` (remote `staging`), Pages con build da workflow, workflow che ricava ambiente e base da `GITHUB_REPOSITORY`, ramo `dev` (copia anche su `origin/dev`), `docs/human/rilascio.md`.
- Stato: completo. Produzione **non** aggiornata (`main` locale avanti di 1 commit di documentazione, non pubblicato).
- Verifica: build locali di produzione e prova confrontate (titolo, manifest, icone, nomi Drive e storage). Prova offline su `vite preview`: cache `tempomax:<scope>:v1`, visita salvata. Action di tempoMax-dev verde; https://verbavolant.github.io/tempoMax-dev/ serve "TempoMax DEV" con manifest arancione; l'ufficiale è invariata.
- Prossimo passo: T-032 (nome dispositivo + Opzioni) sul ramo `dev`, pubblicato solo su prova.
- Trappole/note: il manifest generato non viene più riscritto da Vite: un `href` assoluto "/manifest.webmanifest" finiva fuori dall'app (404) → usato un `href` relativo. In sviluppo il manifest è servito da `configureServer`. Primo rilascio in produzione dopo questo cambio: il service worker vecchio (cache `tempomax-v1`) viene sostituito e la sua cache cancellata (`LEGACY_CACHE_NAME`).

## [2026-10-31] — Verifiche utente; nuove richieste: nome dispositivo e ambiente di prova
- Fatto: l'utente conferma su iPhone note vocali su Drive (T-014b/c), note libere e schermata Note (T-028b/c), orario di lavoro (T-029d). T-030 non ancora confermato.
- Stato: nuove richieste in fase di progettazione, nessun codice: (1) registrare in JSON e fogli il nome del dispositivo; (2) un binario di sviluppo separato, con pubblicazione su GitHub Pages "ufficiale" **solo dopo conferma esplicita dell'utente**.
- Verifica: —
- Prossimo passo: proposta all'utente (repo e Pages di prova, cartella Drive e archivio locale separati; nome dispositivo da Opzioni) e attesa conferma.
- Trappole/note: **da ora nessun push su `origin/main` senza conferma esplicita dell'utente** (ogni push su main pubblica in produzione). Questa voce è committata solo in locale.

## [2026-10-31] — T-030 dettaglio visite + bug della posizione persa offline
- Fatto: `src/ui/notePlayer.ts` estratto da `notes.ts` (`NotePlayer`, `loadNoteAudio`); `src/ui/visits.ts`: riepilogo "⚠️ senza cliente · tocca per abbinare" e "🎧 n", dettaglio con link Maps (visite senza cliente), abbinamento, registrazioni ▶/⏸ aggiornate senza ridisegnare la tendina; senza Drive mostra le visite locali. **Bug corretto** in `VisitSession.enqueueSync`: l'aggiornamento locale (posizione, cliente) avveniva dentro `authorized()`, quindi offline o con il popup bloccato la posizione veniva scartata. Ora `update()` parte subito e indipendente, e il salvataggio su Drive lo aspetta. Probabile causa dell'osservazione "in modalità aereo non registra la posizione" (T-027).
- Stato: T-030 parziale (prova su iPhone); bug corretto e coperto da test.
- Verifica: `npm test` (236): il nuovo test sulla posizione senza login falliva prima della correzione e ora passa. Chrome headless con GPS (`Emulation.setGeolocationOverride`) e microfono simulati: link Maps `…query=45.4642%2C9.19`, abbinamento visibile, nota riprodotta.
- Prossimo passo: prova dell'utente (checklist "Dettaglio visite", con modalità aereo); restano da provare T-014b/c, T-028b/c, T-029d; poi T-026 Opzioni/GPS.
- Trappole/note: per i test UI con GPS usare `Browser.grantPermissions` + `Emulation.setGeolocationOverride`. La sessione dell'orario non ha aggiornamenti locali asincroni, quindi non ha lo stesso problema.

## [2026-10-31] — T-029a–d: orario di lavoro (parziale)
- Fatto: richiesta dell'utente: due pulsanti per inizio/fine del lavoro con pause. T-029a: `src/model/work.ts`, `expectIsoDate`, `roundedMinutesBetween` condivisa con `visitDurationMinutes`, `src/storage/localWork.ts`. T-029b: `src/storage/sheetRegister.ts` estratto da `VisitRegister` (test del registro visite invariati e verdi), `WorkRegister`, `src/register/workRow.ts`, `WorkRepository` (un file per giorno). T-029c: `src/work/workSession.ts`. T-029d: `src/ui/workPanel.ts` in cima alla home; home compattata (pulsante tondo `min(62vw, 30vh, 300px)`, navigazione su una riga di tre pulsanti) per stare in uno schermo.
- Stato: T-029a/b/c completi; T-029d parziale (prova su iPhone con Drive).
- Verifica: `npm test` (232), typecheck, lint, build OK. Chrome headless 390×844 via CDP: i pulsanti si alternano, i periodi vengono salvati in localStorage, la home sta in uno schermo.
- Prossimo passo: prova dell'utente (checklist "Orario di lavoro"); restano da provare T-014b/c e T-028b/c; poi T-026 Opzioni/GPS.
- Trappole/note: il primo test di concorrenza di WorkSession non esercitava la gara (lo `stop()` arrivava prima che il salvataggio partisse): la controprova lo ha mostrato. Ora attende con `vi.waitFor` il primo salvataggio in corso. Scelte dichiarate all'utente: orario indipendente dalle visite, senza GPS; pausa = Fine + nuovo Inizio.

## [2026-10-31] — T-028a/b/c: note libere ed elenco delle note
- Fatto: richiesta dell'utente: nota vocale anche senza visita ("Note libere") e un elenco per riascoltare tutte le note. T-028a: `LocalVisitState.freeNotes`, `VisitSession.addFreeNote/removeFreeNote/syncAfter`, `uploadFreeNotes` e `uploadAudio` comuni, `appProperties` sui file audio (`audioAppProperties`), `DriveClient.uploadFile(..., appProperties)`. T-028b: 🎤 sempre visibile in `src/ui/home.ts`, ⏹ e FINE chiamano `session.syncAfter(finishRecording())` dentro il tocco. T-028c: `listFiles` restituisce anche `webViewLink`/`appProperties`, `downloadFile`, `src/storage/audioCatalog.ts`, `src/ui/notes.ts`, pulsante "🎧 Note vocali", `showSecondary` supporta il cleanup (ferma la riproduzione).
- Stato: T-028a completo; T-028b, T-028c parziali (prova con Drive reale). Resta in sospeso anche la prova di T-014b/c.
- Verifica: `npm test` (199), typecheck, lint, build OK. Chrome headless: nota libera registrata senza visita → elencata nella schermata Note (anche senza Drive) → ▶ avvia la riproduzione.
- Prossimo passo: prova dell'utente (checklist "Note vocali" e "Note libere ed elenco note"); poi T-026 Opzioni/GPS.
- Trappole/note: *da verificare*: che `appProperties` vengano salvate già nella creazione multipart (in caso contrario `catalogNoteFromDriveFile` ricava data, tipo e visita dal nome, senza ora né durata). I nomi dei clienti nell'elenco vengono dalle ultime 30 visite più quelle locali; per le altre compare "visita del …".

## [2026-10-31] — T-014a, T-014b, T-014c (parziali): audio su Drive
- Fatto: ADR-007 (note ≤ 5 MB invece del resumable: `Location` non esposto via CORS nella risposta 401, comportamento in caso di successo non verificabile). T-014a: `shouldStopForSize`, `MAX_RECORDING_SECONDS` (5 min) e callback `onLimitReached` in `src/audio/recorder.ts`; la home ferma la nota e lo dice. T-014b: `FileTooLargeError` e `uploadFile` in `src/storage/drive.ts`; `src/storage/audioUploader.ts`; `AudioNote.driveLink` (assente = null); `VisitSession.saveVisit(id)` carica le note pendenti, aggiorna id/link, cancella la copia locale, poi salva JSON e registro; ▶ apre `driveLink` se il file non è più sul telefono. T-014c: colonna I "Audio" (link uno per riga), intestazione riscritta anche sui fogli esistenti.
- Stato: T-014a completo; T-014b e T-014c parziali (prova reale).
- Verifica: `npm test` (186), typecheck, lint, build OK. Controprove: senza la gestione di `FileTooLargeError` fallisce il test dedicato. Registrazione in Chrome headless ancora OK.
- Prossimo passo: prova dell'utente (checklist → Note vocali); poi T-026 (Opzioni, GPS disattivabile).
- Trappole/note: `saveToDrive` ora toglie dalla coda la versione **restituita** da `saveVisit` (dopo l'upload la visita cambia). File troppo grande o mancante: avviso (`audioNotice`) senza bloccare la visita. Eliminare una nota già caricata toglie solo il riferimento: il file su Drive resta.

## [2026-10-31] — T-013b chiuso
- Fatto: nessun cambio al codice.
- Stato: completo. L'utente conferma che la registrazione funziona su iPhone con la versione che tenta i formati in sequenza.
- Verifica: prova dell'utente.
- Prossimo passo: T-014 (upload audio su Drive).
- Trappole/note: *ipotesi* sulla causa: Safari dichiarava supportato `audio/mp4;codecs=mp4a.40.2` ma il registratore non partiva; il formato scelto sull'iPhone non è stato osservato. Manca l'esito con lo schermo bloccato.

## [2026-10-31] — T-013b: errore microfono su iPhone (diagnosi in corso)
- Fatto: su iPhone (Safari, permesso "consenti mentre visiti il sito") compare "Microfono non disponibile: The request is not allowed by the user agent or the platform in the current context…" (NotAllowedError). Non riproducibile qui. `src/audio/recorder.ts`: messaggio che distingue "il telefono non ha concesso il microfono (…)" (getUserMedia) da "registratore non avviato (…)" (MediaRecorder), con `name` dell'errore e `cause`; `audioMimeTypeCandidates` + `firstThatWorks` tentano i formati in ordine e infine quello del browser.
- Stato: in attesa del nuovo messaggio dall'iPhone.
- Verifica: `npm test` (169), typecheck, lint OK; registrazione in Chrome headless ancora funzionante (AAC).
- Prossimo passo: se l'errore è "registratore non avviato" il fallback dovrebbe risolvere; se è "non ha concesso il microfono", controllare Impostazioni iOS → Safari → Microfono e le impostazioni del sito ("aA" → Impostazioni sito web).
- Trappole/note: piste dalle fonti (WebKit 221031, 217570, 252303): microfono negato a livello di iOS, richiesta fuori dal gesto (esclusa: `getUserMedia` parte in modo sincrono nel click), limiti di MediaRecorder. Il codec esplicito `mp4a.40.2` non era mai stato provato su Safari.

## [2026-10-31] — T-013a, T-013b (parziale): note vocali
- Fatto: T-013a: `AudioNote` e `Visit.audio` (assente nei JSON vecchi = `[]`), `src/storage/audioStore.ts` (IndexedDB, ArrayBuffer + tipo), `src/audio/recorder.ts` (MediaRecorder a blocchi da 1 s, `chooseAudioMimeType`), devDependency `fake-indexeddb@6.2.7`. T-013b: `VisitSession.addAudio/removeAudio` (solo in locale, tramite `updateVisit`), UI in `src/ui/home.ts` (pannello audio, elenco ridisegnato solo quando cambia), `AudioStore` creato in `src/main.ts`, stili. Aggiunto T-027 (GPS senza rete, da valutare) su osservazione dell'utente.
- Stato: T-013a completo; T-013b parziale (prova su iPhone, schermo bloccato).
- Verifica: `npm test` (168), typecheck, lint, build OK. Chrome headless con `--use-fake-device-for-media-stream` via CDP: registrazione di circa 2,6 s salvata (nota nella visita + file in IndexedDB), formato `audio/mp4;codecs=mp4a.40.2`; FINE durante la registrazione → visita chiusa con 1 nota.
- Prossimo passo: prova su iPhone (`docs/human/test-telefono.md` → Note vocali), poi T-014 (upload su Drive, resumable oltre 5 MB, colonna Audio nel registro).
- Trappole/note: Chrome 156 con il solo `audio/mp4` registra **Opus** in MP4. Per questo `audio/mp4;codecs=mp4a.40.2` (AAC-LC) è il primo della lista. Il primo tentativo di registrazione in un profilo Chrome nuovo non è partito, senza errori visibili, e non si è ripetuto. *Ipotesi*: permesso del microfono concesso con ritardo; da tenere d'occhio sul telefono. FINE durante la registrazione: prima `toggle()` (orario e token nel gesto), poi `finishRecording()` aggancia la nota alla visita chiusa.

## [2026-10-31] — T-019 chiuso
- Fatto: nessun cambio al codice.
- Stato: completo. L'utente ha verificato su iPhone: installazione, schermo intero, avvio e visita offline, salvataggio quando torna la rete.
- Verifica: prova manuale dell'utente.
- Prossimo passo: Fase 3 audio (T-013).
- Trappole/note: storage locale dell'app installata separato da Safari (verificato). Al ritorno della rete i salvataggi ripartono solo al tap successivo: non c'è sincronizzazione automatica sull'evento `online`. Possibile miglioramento, non richiesto.

## [2026-10-31] — T-019 PWA installabile (parziale)
- Fatto: nuovo ordine dei lavori concordato (PLAN.md: T-019 → audio → T-026 Opzioni/GPS → Fase 2). `public/manifest.webmanifest`, `public/sw.js`, `public/icons/{icon-192,icon-512,apple-touch-icon}.png`, `index.html` (manifest, theme-color, icone), override ESLint per `public/sw.js`. `src/main.ts`: service worker registrato in produzione; login Google caricato in background, così l'app parte anche offline; `authorized()` rifiuta subito se `navigator.onLine` è false.
- Stato: parziale. Manca l'installazione su iPhone (checklist aggiornata in `docs/human/test-telefono.md`).
- Verifica: `npm test` (156), typecheck, lint, build OK. Prova con Chrome headless via DevTools Protocol su `vite preview`: service worker attivo, 6 file in cache; con `Network.emulateNetworkConditions offline` l'app si apre e INIZIA salva la visita in localStorage con "nessuna connessione".
- Prossimo passo: l'utente installa su iPhone; poi Fase 3 audio (T-013).
- Trappole/note: prima l'app offline non partiva affatto (`await loadGoogleIdentityServices()` all'avvio). Il service worker non è un requisito di installabilità (MDN, web.dev), ma serve per l'avvio offline. Alla prima visita i file sono caricati prima del service worker: `precacheAppShell` rilegge `index.html` e mette in cache i file referenziati. Per aggiornare la strategia di cache cambiare `CACHE_NAME`. Verificato dall'utente: su iOS l'app installata ha uno storage locale separato da Safari (Drive in comune). Script di verifica CDP e generatore delle icone sono nello scratchpad della sessione, non nel repo.

## [2026-10-31] — T-021a, T-021b (parziale): assegnare il cliente dopo
- Fatto: T-021a: `DriveClient.listFiles`, `VisitsRepository.listRecent`, `VisitSession.assignClient` e `localVisits`. T-021b: `src/ui/visits.ts` (elenco, tendina dei clienti ordinata per distanza dal check-in, "nessun cliente"), pulsante "🕘 Visite" in `src/ui/home.ts`, `showSecondary` in `src/main.ts`, stile del `select`. `italianDate`/`clockTime` esportati da `src/register/visitRow.ts`.
- Stato: T-021a completo; T-021b parziale (prova sul telefono).
- Verifica: `npm test` (156), typecheck, lint, build OK; screenshot della home con i due pulsanti.
- Prossimo passo: prova dell'utente; poi, come da programma, Fase 2 → T-012 (riepilogo ore per cliente/mese) oppure T-019 (PWA), da concordare.
- Trappole/note: `assignClient` su una visita letta da Drive la mette in `unsyncedVisits`, così senza rete viene risalvata. L'elenco mostra solo l'anno corrente (vedi note di T-021a). La schermata unisce le visite locali (in corso o non sincronizzate) a quelle di Drive, preferendo la versione locale.

## [2026-10-31] — T-010 chiuso, T-024, T-025 (parziale)
- Fatto: T-010 verificato dall'utente su iPhone. T-024: "‹ Indietro" usa `.secondary-button`; rimosso `.link-button` (non più usato). T-025: `src/ui/clients.ts` legge il GPS in parallelo al caricamento e evidenzia (classe `.here`, "📍 Sei qui", in cima) il cliente di `findClientAtPosition`; `orderClientsForList` testato in `tests/ui/clients.test.ts`.
- Stato: T-024 completo; T-025 parziale (prova sul telefono).
- Verifica: `npm test` (146), typecheck, lint, build OK.
- Prossimo passo: T-021 (assegnare il cliente a una visita in seguito), come da programma.
- Trappole/note: la lettura GPS iniziale della pagina Clienti è gestita con `.then(ok, err)` per non lasciare promesse rifiutate senza gestione se il caricamento dei clienti fallisce.

## [2026-10-31] — T-010 app online
- Fatto: scope `workflow` aggiunto dall'utente, push riuscito; GitHub Action "Deploy static content to Pages" (run 41209809296) verde in 58 s, con lint, test e build.
- Stato: parziale. Manca la checklist `docs/human/test-telefono.md` su iPhone.
- Verifica: `https://verbavolant.github.io/tempoMax/` → 200; il bundle `/tempoMax/assets/index-*.js` → 200 e contiene il Client ID; nessun header COOP (il popup OAuth può funzionare).
- Prossimo passo: l'utente esegue la checklist e riporta gli esiti; i problemi diventano nuovi task.
- Trappole/note: annotazione di GitHub: `ubuntu-latest` passa a Ubuntu 26 dal 19/10/2026; il workflow non dipende dalla versione di Ubuntu.

## [2026-10-31] — T-011b chiuso, T-010 deploy (parziale)
- Fatto: errori Google con servizio e messaggio (`googleErrorMessage`, `serviceName` in `src/storage/drive.ts`); il 403 era la Sheets API non abilitata nel progetto Cloud. T-010: `.github/workflows/deploy.yml` (workflow ufficiale Vite con action fissate a SHA, più lint e test), `base: '/tempoMax/'` in `vite.config.ts`, Pages attivato via `gh api -X POST repos/verbavolant/tempoMax/pages -f build_type=workflow`, checklist `docs/human/test-telefono.md`.
- Stato: T-011b completo. T-010 parziale: il token `gh` non ha lo scope `workflow`, quindi il push del workflow viene rifiutato. L'utente deve lanciare `gh auth refresh -h github.com -s workflow`.
- Verifica: `npm test` (143), lint, build OK; `dist/index.html` punta a `/tempoMax/assets/…`.
- Prossimo passo: refresh dello scope → push → controllare l'esecuzione dell'Action → l'utente esegue `docs/human/test-telefono.md` su iPhone.
- Trappole/note: in locale l'app ora è su `http://localhost:5173/tempoMax/` (l'origine OAuth non cambia: le origini non hanno path). La doc Vite riporta le action fissate a SHA: per aggiornarle, ricopiare il file `docs/guide/static-deploy-github-pages.yaml` del repo vitejs/vite.

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
