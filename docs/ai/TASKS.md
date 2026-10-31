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
- Stato: [ ]
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

### T-013 Registrazione audio
- Stato: [ ]
- Obiettivo: registrare, ascoltare ed eliminare uno o più audio durante la visita (MediaRecorder), scegliendo il formato supportato dal browser.
- Done quando: funziona su iPhone Safari; si scopre e si annota cosa succede quando lo schermo si blocca durante la registrazione.
- Dipende da: T-009

### T-014 Upload audio su Drive
- Stato: [ ]
- Obiettivo: caricare gli audio in `audio/AAAA/` e collegarli al JSON della visita.
- Done quando: l'audio si riproduce da Drive e il riferimento è nel JSON della visita.
- Dipende da: T-013, T-004

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
- Stato: [ ]
- Obiettivo: manifest, icone, service worker per la cache dell'app.
- Done quando: l'app si installa sulla schermata Home di iPhone e Android e si apre offline.
- Dipende da: T-018

### T-020 Test su Android
- Stato: [ ]
- Obiettivo: checklist di test manuale eseguita su Android/Chrome (GPS, audio webm, login, offline).
- Dipende da: T-019

---

## Bloccati / da chiarire
> Task fermi in attesa di una decisione umana o di un'informazione mancante.
- **T-012 Arrotondamento ore**: per ora si usano i minuti esatti (nessun arrotondamento). La regola definitiva (quarti d'ora, minimo per uscita, ecc.) la deciderà l'utente: implementarla come funzione isolata e sostituibile.
