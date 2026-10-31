# TASKS.md — Backlog

> Task piccoli, indipendenti, verificabili da soli.
> Stato: `[ ]` aperto · `[~]` in corso · `[x]` fatto · `[!]` bloccato

## Legenda di un task
```
### T-XXX <titolo breve>
- Stato: [ ]
- Obiettivo: <una frase>
- Done quando: <criterio verificabile>
- File: <path coinvolti>
- Dipende da: <T-YYY | nessuno>
- Note:
```

---

## Fase 1 — MVP check-in/out

### T-001 Scaffold progetto
- Stato: [x]
- Obiettivo: repo git con Vite + TypeScript + Vitest + lint.
- Done quando: `npm run build`, `npm test` e `npm run lint` passano con un test vuoto; `.gitignore` presente; sezione TypeScript aggiunta a `CONVENTIONS.md`; comandi aggiornati in `CONTEXT.md`.
- File: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`, `tests/`, `.gitignore`
- Dipende da: nessuno
- Note: repo git già inizializzato e pubblicato su https://github.com/verbavolant/tempoMax (pubblico, branch `main`); `.gitignore` di base già presente.

### T-002 Setup Google Cloud + guida
- Stato: [x] Client ID in `src/config.ts`; app "In production" (confermato dall'utente)
- Obiettivo: progetto Google Cloud con Drive API e Sheets API abilitate, schermata di consenso OAuth, client ID web.
- Done quando: il client ID esiste, le origini autorizzate sono configurate (dev + produzione) e i passaggi sono documentati in `docs/human/setup-google.md`.
- File: `docs/human/setup-google.md`
- Dipende da: nessuno
- Note: lo fa **l'umano** nella console; l'agente scrive la guida verificando sulla documentazione ufficiale. Unico scope: `drive.file` (non-sensitive, vale anche per Sheets). Mettere l'app "In production" (vedi ADR-001): in "Testing" le autorizzazioni scadono dopo 7 giorni.

### T-003 Login Google
- Stato: [x] login reale verificato dall'utente; rinnovo dopo la scadenza (>1 h) non ancora osservato: da ricontrollare in T-010
- Obiettivo: login/logout con Google Identity Services (token model), scope `drive.file`, rinnovo del token alla scadenza.
- Done quando: in locale (Safari su Mac, `localhost:5173`) si fa il login, si ottiene il token, si chiama `about.get` di Drive e il token si rinnova dopo la scadenza senza perdere lo stato. La prova su iPhone avviene dopo il deploy (T-010), perché un'origine `http://<IP-LAN>` non è tra quelle autorizzate.
- File: `src/auth/`
- Dipende da: T-001, T-002
- Note: il rinnovo passa da `requestAccessToken()` chiamato in un gesto dell'utente (ADR-001). Rischio da verificare su iPhone: Safari blocca i popup aperti dopo un'operazione asincrona. Strategia: controllare la scadenza (`expires_in`) *prima* che l'utente tocchi un pulsante e, se il token è scaduto, chiedere il rinnovo nel tap stesso. Le scritture in attesa restano in locale. Il popup richiede che la pagina non imposti `Cross-Origin-Opener-Policy: same-origin` (va bene `same-origin-allow-popups` o nessun header; GitHub Pages non lo imposta).

### T-004 Modulo storage Drive
- Stato: [x] verificato dall'utente su Drive reale
- Obiettivo: creare o trovare la cartella `TempoMax/`, leggere e scrivere file JSON, caricare file binari.
- Done quando: test con `fetch` simulato per ogni operazione + verifica manuale su un Drive reale.
- File: `src/storage/drive.ts`, `tests/storage/`
- Dipende da: T-003

### T-005 Modello dati
- Stato: [x]
- Obiettivo: tipi e validazione per Cliente, Visita, Task (da fare / da comprare), con versione dello schema.
- Done quando: test di validazione e serializzazione passano. Rimuovere `passWithNoTests` da `vite.config.ts`.
- File: `src/model/`, `tests/model/`
- Dipende da: T-001

### T-006 Geolocalizzazione + distanza
- Stato: [x]
- Obiettivo: lettura della posizione con gestione di errori e precisione; Haversine; ricerca del cliente più vicino.
- Done quando: test di Haversine su coppie di coordinate con distanza nota (fonte citata nel test); test del cliente più vicino.
- File: `src/geo/`, `tests/geo/`
- Dipende da: T-005

### T-007 Anagrafica clienti
- Stato: [x] verificato dall'utente in Safari su Mac (creazione, modifica, GPS, `clienti.json`)
- Obiettivo: lista dei clienti, creazione con "sono qui adesso" (posizione attuale), modifica, salvataggio su `clienti.json`.
- Done quando: si crea un cliente (in Safari su Mac; su iPhone dopo T-010) e compare in `clienti.json` su Drive.
- File: `src/ui/clients.ts`, `src/storage/`
- Dipende da: T-004, T-006

### T-008a Visite: modello, archivio locale, salvataggio su Drive
- Stato: [x]
- Obiettivo: `Visit.clientId` nullable; helper `startVisit` / `endVisit` / `visitStorageLocation`; `LocalVisitStore` (localStorage: visita aperta + visite non ancora salvate su Drive); `VisitsRepository.save` in `TempoMax/visite/AAAA/AAAA-MM-GG_<id>.json`; `findClientAtPosition` (il cliente più vicino tra quelli che contengono la posizione nel loro raggio).
- Done quando: test su modello, archivio locale, repository e ricerca del cliente.
- File: `src/model/visit.ts`, `src/storage/localVisits.ts`, `src/storage/visitsRepository.ts`, `src/storage/layout.ts`, `src/geo/distance.ts`, test
- Dipende da: T-004, T-006

### T-008b Schermata principale: pulsante unico INIZIA / FINE
- Stato: [x] provato dall'utente ("Bene", 2026-10-31)
- Obiettivo: un solo pulsante grande. INIZIA fa il check-in, FINE (con il tempo trascorso) fa il check-out. L'orario si registra **al tap**; GPS, cliente automatico e salvataggio su Drive avvengono dopo, in sequenza, e se falliscono la visita resta in locale con l'indicazione "da salvare su Drive". Sotto il pulsante, in piccolo, il nome del cliente se riconosciuto. Link secondario "Clienti ›".
- Done quando: check-in → ricarico → la visita in corso c'è ancora; check-out → JSON chiuso su Drive con orari e posizioni; funziona senza clienti e senza GPS.
- File: `src/visits/visitSession.ts` (logica testabile), `src/ui/home.ts`, `src/main.ts`, `src/style.css`, test
- Dipende da: T-008a
- Note: cliente automatico **sì**, se la posizione è entro il raggio di un cliente (decisione dell'utente del 2026-10-31); si potrà cambiare dopo (T-021).

### T-022 Raggio predefinito 200 m
- Stato: [x]
- Obiettivo: i nuovi clienti partono con un raggio di 200 m (richiesta dell'utente del 2026-10-31); quelli già salvati tengono il proprio.
- File: `src/model/client.ts`

### T-023 Pulsante "Clienti" nella home
- Stato: [x]
- Obiettivo: "Clienti" nella home diventa un pulsante vero, non un link.
- File: `src/ui/home.ts`, `src/style.css`

### T-024 Pulsante "Indietro" nella pagina Clienti
- Stato: [x]
- Obiettivo: "‹ Indietro" diventa un pulsante vero, come "👥 Clienti" nella home (richiesta dell'utente del 2026-10-31).
- File: `src/main.ts`

### T-025 Evidenziare il cliente presso cui ci si trova
- Stato: [~] codice e test pronti; da verificare sul telefono in un punto dentro il raggio di un cliente
- Obiettivo: aprendo la pagina Clienti si legge il GPS e si evidenzia il cliente dato da `findClientAtPosition` (stessa regola del check-in). Se il GPS non risponde, non si evidenzia nulla.
- Done quando: in un punto dentro il raggio di un cliente, quel cliente appare evidenziato con "📍 Sei qui".
- File: `src/ui/clients.ts`, `src/style.css`
- Dipende da: T-006, T-007

### T-009 Nota testuale alla visita
- Stato: [ ] (rimandato su richiesta dell'utente: la schermata principale deve restare essenziale)
- Obiettivo: aggiungere una nota testuale a una visita, in corso o chiusa.
- Dipende da: T-008b

### T-021a Visite recenti e assegnazione del cliente: dati
- Stato: [x]
- Obiettivo: `DriveClient.listFiles` (ordinati per nome decrescente); `VisitsRepository.listRecent(limit)` legge le ultime visite dell'anno corrente, ordinate per check-in decrescente; `VisitSession.assignClient(visit, clientId | null)` aggiorna la visita passando dalla coda (locale → JSON → registro).
- Done quando: test per listFiles, listRecent e assignClient (visita in corso, in coda, già su Drive; offline).
- File: `src/storage/drive.ts`, `src/storage/visitsRepository.ts`, `src/visits/visitSession.ts`, test
- Dipende da: T-008b, T-011b
- Note: solo l'anno corrente (per non creare cartelle di anni vuoti): a inizio gennaio le visite di dicembre non compaiono. Da rivedere se serve.

### T-021b Visite recenti e assegnazione del cliente: schermata
- Stato: [~] codice e test pronti; da provare sul telefono (assegnare il cliente a una visita, controllare JSON e registro)
- Obiettivo: pulsante "🕘 Visite" nella home → elenco delle ultime 20 visite (data, orari, cliente o "senza cliente"); tocco su una visita → scelta del cliente (quello più vicino alla posizione del check-in proposto per primo) oppure "nessuno" → salvataggio.
- Done quando: una visita senza cliente riceve un cliente; JSON e riga del registro aggiornati.
- File: `src/ui/visits.ts`, `src/ui/home.ts`, `src/main.ts`, `src/style.css`
- Dipende da: T-021a

### T-010 Deploy HTTPS + test su iPhone
- Stato: [x] online e verificato dall'utente su iPhone ("funziona come volevo", 2026-10-31)
- Obiettivo: pubblicazione su hosting statico HTTPS e test end-to-end su iPhone.
- Done quando: URL pubblico funzionante; checklist di test manuale in `docs/human/` eseguita ed esito annotato in PROGRESS.
- File: config di deploy (GitHub Actions), `vite.config.ts` (`base`), `docs/human/`
- Dipende da: T-008b
- Note: GitHub Pages, account `verbavolant`. L'origine OAuth di produzione è `https://verbavolant.github.io`; URL dell'app: `https://verbavolant.github.io/tempoMax/` (Vite `base: '/tempoMax/'`).

## Fase 2 — Fatturazione ore

### T-011a Registro: righe del foglio
- Stato: [x]
- Obiettivo: funzioni pure per il registro: link Google Maps da coordinate, durata in minuti (regola provvisoria: arrotondamento al minuto più vicino), riga del foglio da una visita, intestazione.
- Colonne (richiesta dell'utente del 2026-10-31: link Maps per controllare le posizioni la sera dal PC): Data · Inizio · Fine · Durata (min) · Cliente · Mappa inizio · Mappa fine · ID visita.
- Done quando: test su link, durata e righe (visita aperta, chiusa, senza posizione, senza cliente).
- File: `src/geo/mapsLink.ts`, `src/model/visit.ts`, `src/register/visitRow.ts`, test
- Dipende da: T-008a

### T-011b Registro: Foglio Google su Drive
- Stato: [x] verificato dall'utente (dopo aver abilitato la Sheets API); link cliccabili da confermare nella checklist di T-010
- Obiettivo: creare `TempoMax/Registro visite` (Drive `files.create` con mimeType `application/vnd.google-apps.spreadsheet`, come indicato dalla guida Sheets "create"), scrivere l'intestazione, aggiornare la riga della visita (cercando l'ID in colonna H) o aggiungerla in fondo. Si chiama dalla coda di `VisitSession` dopo il JSON.
- Done quando: dopo check-in e check-out nel foglio c'è **una sola** riga per la visita, con i link che aprono Maps.
- File: `src/storage/drive.ts`, `src/storage/visitRegister.ts`, `src/storage/layout.ts`, `src/visits/visitSession.ts`, `src/main.ts`, test
- Dipende da: T-011a
- Note: il JSON resta la fonte di verità (ADR-003). Scope `drive.file` verificato (ADR-001). *Da verificare*: che un URL scritto con `valueInputOption=RAW` sia cliccabile nel foglio.

### T-012 Riepilogo mensile ore per cliente
- Stato: [ ]
- Obiettivo: totale delle ore per cliente e per mese, in app e/o in un foglio di riepilogo.
- Done quando: test sul calcolo dei totali in minuti esatti.
- Dipende da: T-011b
- Note: arrotondamento provvisorio = minuti esatti; la regola finale arriverà dall'utente (vedi sotto).

## Fase 3 — Audio

### T-013a Audio: modello, archivio locale, registratore
- Stato: [x]
- Obiettivo: `Visit.audio: AudioNote[]` (compatibile: se il campo manca vale `[]`); archivio locale degli audio in IndexedDB (ArrayBuffer + tipo, per prudenza su Safari); wrapper di `MediaRecorder` con scelta del formato tramite `MediaRecorder.isTypeSupported` (Safari: MP4/AAC, fonte WebKit blog 11353).
- Done quando: test su modello, archivio (con `fake-indexeddb`) e scelta del formato.
- File: `src/model/visit.ts`, `src/storage/audioStore.ts`, `src/audio/recorder.ts`, test
- Dipende da: T-008b

### T-013b Audio: schermata
- Stato: [x] funziona su iPhone (dopo i tentativi in sequenza dei formati). Comportamento con lo schermo bloccato non ancora riportato
- Obiettivo: durante una visita, sotto FINE, il pulsante "🎤 Nota vocale" (diventa "⏹ Ferma" con il tempo); elenco delle note della visita con ▶ ascolta e 🗑 elimina; `VisitSession.addAudio/removeAudio` passando dalla coda.
- Done quando: su iPhone si registra, si ascolta e si elimina una nota; si annota cosa succede se lo schermo si blocca durante la registrazione.
- File: `src/ui/home.ts`, `src/visits/visitSession.ts`, `src/style.css`, test
- Dipende da: T-013a

### T-014a Tetto di dimensione delle note (ADR-007)
- Stato: [x]
- Obiettivo: il registratore somma la dimensione dei blocchi e si ferma da solo prima di 5.000.000 byte (limite multipart), avvisando "lunghezza massima raggiunta".
- Done quando: test sulla logica del tetto; la UI salva la nota fermata automaticamente.
- File: `src/audio/recorder.ts`, `src/ui/home.ts`, test
- Dipende da: T-013b

### T-014b Caricamento delle note su Drive
- Stato: [x] verificato dall'utente su iPhone (2026-10-31)
- Obiettivo: prima di salvare il JSON della visita, le note con `driveFileId` null vengono caricate in `TempoMax/audio/AAAA/` (nome `AAAA-MM-GG_<idVisita>_<idNota>.<m4a|webm>`), con id e `webViewLink` salvati nella nota (`driveLink`, campo nuovo: assente = null); dopo il caricamento la copia locale si elimina.
- Done quando: test della sessione (upload, errore, file locale mancante); su Drive c'è l'audio e il JSON ne contiene id e link.
- File: `src/storage/drive.ts`, `src/storage/audioUploader.ts`, `src/model/visit.ts`, `src/visits/visitSession.ts`, `src/main.ts`, test
- Dipende da: T-014a

### T-014c Colonna "Audio" nel registro
- Stato: [x] verificato dall'utente su iPhone (2026-10-31)
- Obiettivo: colonna I "Audio" con i link alle note (uno per riga della cella); l'intestazione si aggiorna anche sui fogli già esistenti.
- File: `src/register/visitRow.ts`, `src/storage/visitRegister.ts`, test
- Dipende da: T-014b

### T-028a Note libere e catalogo audio: dati
- Stato: [x]
- Obiettivo: note vocali registrate senza visita ("Note libere", richiesta dell'utente del 2026-10-31). `LocalVisitState.freeNotes` (assente = `[]`), `VisitSession.addFreeNote` e `syncAfter(task)`, caricamento in `TempoMax/audio/AAAA/AAAA-MM-GG_libera_<idNota>.<ext>`; ogni file audio (anche delle visite) ha `appProperties` `kind` (`visit`/`free`), `recordedAt`, `durationSeconds`, `visitId` per elencarle con una sola richiesta.
- Done quando: test su archivio locale, sessione (nota libera caricata e tolta dalla coda; errori) e uploader (nome e proprietà).
- File: `src/storage/localVisits.ts`, `src/storage/audioUploader.ts`, `src/storage/drive.ts`, `src/visits/visitSession.ts`, test
- Dipende da: T-014b
- Note: *da verificare con la prova reale*: che `appProperties` si possano impostare già nella creazione (la guida "properties" mostra solo l'update; il campo non è output-only).

### T-028b Nota vocale anche senza visita
- Stato: [x] verificato dall'utente su iPhone (2026-10-31)
- Obiettivo: 🎤 visibile anche con il timer fermo (nota libera); al tocco su ⏹ si avvia subito il salvataggio su Drive (`syncAfter`, token nel gesto).
- File: `src/ui/home.ts`
- Dipende da: T-028a

### T-028c Schermata "🎧 Note vocali"
- Stato: [x] verificato dall'utente su iPhone (2026-10-31)
- Obiettivo: elenco delle note dell'anno (Drive + quelle ancora sul telefono), divise in "Note libere" e "Note delle visite", con data e ora, durata ed eventuale cliente; ▶ riproduce (file locale o scaricato da Drive).
- File: `src/storage/audioCatalog.ts`, `src/ui/notes.ts`, `src/ui/home.ts`, `src/main.ts`, test
- Dipende da: T-028a

### T-029a Orario di lavoro: modello e archivio locale
- Stato: [x]
- Obiettivo: richiesta dell'utente del 2026-10-31: segnare inizio e fine del lavoro, comprese le pause (pausa = fine + nuovo inizio). `WorkPeriod {id, start, end|null}`, documento giornaliero `{schemaVersion, date, periods}`, `startWorkPeriod`/`endWorkPeriod`, totale lavorato del giorno; `roundedMinutesBetween` condivisa con `visitDurationMinutes`; `LocalWorkStore` (localStorage `tempomax.work`: periodi di oggi + id non ancora su Drive).
- Done quando: test di modello, durate e archivio locale.
- File: `src/model/work.ts`, `src/model/time.ts`, `src/model/visit.ts`, `src/storage/localWork.ts`, test
- Note: indipendente dalle visite e senza GPS (scelte dichiarate all'utente, da confermare).

### T-029b Orario di lavoro: Drive e Foglio "Orario di lavoro"
- Stato: [x]
- Obiettivo: `TempoMax/lavoro/AAAA/AAAA-MM-GG.json` (lettura-modifica-scrittura del giorno); registro generico riusato per il Foglio "Orario di lavoro" (Data · Inizio · Fine · Durata (min) · ID periodo), una riga per periodo.
- File: `src/storage/workRepository.ts`, `src/storage/sheetRegister.ts` (estratto da `visitRegister.ts`), `src/register/workRow.ts`, test
- Dipende da: T-029a

### T-029c Orario di lavoro: logica dei pulsanti
- Stato: [x]
- Obiettivo: `WorkSession.start()/stop()`: orario al tocco, salvataggio locale, coda verso Drive (JSON del giorno + riga del foglio), riprova al tocco successivo.
- File: `src/work/workSession.ts`, test
- Dipende da: T-029b

### T-029d Orario di lavoro: home
- Stato: [x] verificato dall'utente su iPhone (2026-10-31)
- Obiettivo: in cima alla home "▶ Inizio lavoro" / "⏸ Fine lavoro" affiancati (attivo solo quello sensato) e riga "Al lavoro da … · oggi …" / "In pausa · oggi …".
- File: `src/ui/home.ts`, `src/main.ts`, `src/style.css`
- Dipende da: T-029c

### T-030 Visite: luogo, abbinamento e registrazioni
- Stato: [~] codice pronto e provato in Chrome (GPS e microfono simulati); manca la prova su iPhone
- Obiettivo: richiesta dell'utente del 2026-10-31. Nell'elenco visite: "⚠️ senza cliente · tocca per abbinare" e il numero di note (🎧 n); nel dettaglio: "📍 Apri in Maps" (posizione del check-in) per le visite senza cliente, l'abbinamento al cliente (già presente) e l'elenco delle registrazioni della visita con ▶. Riproduzione comune con la schermata Note vocali (`src/ui/notePlayer.ts`).
- Done quando: test di `loadNoteAudio`; su iPhone si apre Maps, si abbina un cliente e si ascolta una nota della visita.
- File: `src/ui/notePlayer.ts`, `src/ui/notes.ts`, `src/ui/visits.ts`, `src/main.ts`, `src/style.css`, test
- Dipende da: T-021b, T-028c

### T-031a Ambiente di prova: configurazione nel codice
- Stato: [x]
- Obiettivo: `VITE_APP_ENV` (`production` | `staging`) e `VITE_BASE` decidono nome dell'app ("TempoMax" / "TempoMax DEV"), icone (verdi / arancioni), cartella Drive (`TempoMax` / `TempoMax-dev`), prefisso dell'archivio locale e del database IndexedDB, cache del service worker separata per scope. Manifest generato da `vite.config.ts` (non più statico in `public/`).
- Done quando: build di produzione invariata nei nomi; build di staging con nomi, icone e cartella diversi; test verdi.
- File: `src/config.ts`, `src/storage/layout.ts`, `src/storage/localVisits.ts`, `src/storage/localWork.ts`, `src/storage/audioStore.ts`, `vite.config.ts`, `index.html`, `public/sw.js`, `public/icons-dev/*`
- Note: decisione dell'utente del 2026-10-31 (ADR-008).

### T-031b Ambiente di prova: repo, Pages e flusso di rilascio
- Stato: [x] repo `verbavolant/tempoMax-dev` creato, Pages attivo, prima pubblicazione verde
- Obiettivo: repo pubblico `verbavolant/tempoMax-dev` (Pages: https://verbavolant.github.io/tempoMax-dev/); workflow che imposta ambiente e base dal nome del repo; ramo locale `dev` → `staging/main`; produzione (`origin/main`) **solo con conferma esplicita dell'utente**. Procedura in `docs/human/rilascio.md`.
- Dipende da: T-031a

### T-032a Nome del dispositivo: dati
- Stato: [x]
- Obiettivo: campo `device: string | null` (assente nei dati vecchi = null) in `Visit`, `AudioNote`, `WorkPeriod`; `appProperties.device` sugli audio; colonna "Dispositivo" in fondo ai due fogli; `DeviceSettings` (localStorage `<prefisso>.device`, max 40 caratteri) e `guessDeviceName(userAgent)`; le sessioni ricevono `deviceName()`.
- Done quando: test di modello, righe, sessioni e impostazioni.
- File: `src/model/visit.ts`, `src/model/work.ts`, `src/device.ts`, `src/register/*.ts`, `src/storage/audioUploader.ts`, `src/visits/visitSession.ts`, `src/work/workSession.ts`, test
- Note: richiesta dell'utente del 2026-10-31; il nome lo scrive l'utente perché il web non può leggere il nome del telefono.

### T-032b Nome del dispositivo: schermata Opzioni
- Stato: [ ]
- Obiettivo: schermata "⚙️ Opzioni" con "Nome di questo telefono" (precompilato da `guessDeviceName`); finché non è impostato la home mostra "📱 Dai un nome a questo telefono"; pulsante ⚙️ nella riga di navigazione. Qui arriverà anche il GPS disattivabile (T-026).
- File: `src/ui/options.ts`, `src/ui/home.ts`, `src/main.ts`, `src/style.css`
- Dipende da: T-032a

### T-027 Posizione senza rete (da valutare)
- Stato: [!] probabilmente risolto da un bug corretto il 2026-10-31: senza login (offline) l'aggiornamento della posizione veniva scartato. Da riverificare in modalità aereo prima di toccare il timeout.
- Contesto: in modalità aereo l'utente ha visto visite senza posizione. *Ipotesi*: il GPS dell'iPhone può funzionare anche senza rete, ma l'aggancio è più lento e supera il timeout di 20 s (`POSITION_TIMEOUT_MS`). Possibili soluzioni: timeout più lungo, oppure un nuovo tentativo in background che aggiorna la visita.

## Fase 4 — Da fare / Da comprare

### T-015 Modello e storage task
- Stato: [ ]
- Obiettivo: `task.json` con le voci "da fare" e "da comprare" (cliente, visita di origine, stato, date).
- Dipende da: T-005, T-004

### T-016 Aggiunta task dalla visita
- Stato: [ ]
- Obiettivo: aggiungere voci "da fare" e "da comprare" durante la visita; vedere quelle aperte del cliente al check-in.
- Dipende da: T-015, T-009

### T-017 Vista globale liste
- Stato: [ ]
- Obiettivo: elenco di tutti i task aperti, raggruppati per cliente, con un filtro "da comprare" per il vivaio; chiusura con un tap.
- Dipende da: T-016

## Fase 5 — Robustezza e Android

### T-018 Coda offline
- Stato: [ ]
- Obiettivo: tutte le scritture passano da una coda in IndexedDB, sincronizzata con Drive quando torna la rete.
- Done quando: una visita completa in modalità aereo viene sincronizzata alla riconnessione, senza duplicati.
- Dipende da: Fasi 1–4

### T-019 PWA installabile
- Stato: [x] verificato dall'utente su iPhone: installata, schermo intero, avvio e visita offline, salvataggio al ritorno della rete
- Obiettivo: manifest, icone, service worker (cache dell'app, network-first), avvio **senza rete**: il login Google si carica in background e la sua assenza non blocca il pulsante.
- Done quando: l'app si installa sulla schermata Home di iPhone (e Android in T-020) e si apre in modalità aereo, registrando la visita in locale.
- File: `public/manifest.webmanifest`, `public/sw.js`, `public/icons/*`, `index.html`, `src/main.ts`, `eslint.config.js`
- Dipende da: T-008b (anticipato rispetto a T-018 su richiesta dell'utente)

### T-020 Test su Android
- Stato: [ ]
- Obiettivo: checklist di test manuale eseguita su Android/Chrome (GPS, audio webm, login, offline).
- Dipende da: T-019

---

## Opzioni

### T-026 Schermata Opzioni: GPS disattivabile
- Stato: [ ]
- Obiettivo: schermata "Opzioni" con un interruttore per disattivare il tracciamento GPS (privacy). Con il GPS spento: visite senza posizione e senza cliente automatico, nessuna lettura GPS nelle altre schermate.
- Dipende da: T-019, T-014 (ordine concordato)

---

## Bloccati / da chiarire
> Task fermi in attesa di una decisione umana o di un'informazione mancante.
- **T-012 Arrotondamento ore**: per ora si usano i minuti esatti (nessun arrotondamento). La regola definitiva (quarti d'ora, minimo per uscita, ecc.) la deciderà l'utente: implementarla come funzione isolata e sostituibile.
