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

### T-009 Nota testuale alla visita
- Stato: [ ] (rimandato su richiesta dell'utente: la schermata principale deve restare essenziale)
- Obiettivo: aggiungere una nota testuale a una visita, in corso o chiusa.
- Dipende da: T-008b

### T-021 Assegnare il cliente a una visita in seguito
- Stato: [ ]
- Obiettivo: in una schermata secondaria, elenco delle visite recenti con la possibilità di assegnare o cambiare il cliente (o lasciarlo vuoto).
- Done quando: una visita senza cliente riceve un cliente e il JSON su Drive viene aggiornato.
- Dipende da: T-008b

### T-010 Deploy HTTPS + test su iPhone
- Stato: [ ]
- Obiettivo: pubblicazione su hosting statico HTTPS e test end-to-end su iPhone.
- Done quando: URL pubblico funzionante; checklist di test manuale in `docs/human/` eseguita ed esito annotato in PROGRESS.
- File: config di deploy (GitHub Actions), `vite.config.ts` (`base`), `docs/human/`
- Dipende da: T-008b
- Note: GitHub Pages, account `verbavolant`. L'origine OAuth di produzione è `https://verbavolant.github.io`; URL dell'app: `https://verbavolant.github.io/tempoMax/` (Vite `base: '/tempoMax/'`).

## Fase 2 — Fatturazione ore

### T-011 Foglio "Registro ore"
- Stato: [ ]
- Obiettivo: creare il Foglio dall'app e aggiungere o aggiornare una riga per ogni visita chiusa (data, cliente, inizio, fine, durata, nota).
- Done quando: chiusa una visita, la riga compare nel Foglio; riaprendo la stessa visita la riga non viene duplicata.
- Dipende da: Fase 1
- Note: scope `drive.file`, già verificato sulla doc ufficiale (ADR-001).

### T-012 Riepilogo mensile ore per cliente
- Stato: [ ]
- Obiettivo: totale delle ore per cliente e per mese, in app e/o in un foglio di riepilogo.
- Done quando: test sul calcolo dei totali in minuti esatti.
- Dipende da: T-011
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
