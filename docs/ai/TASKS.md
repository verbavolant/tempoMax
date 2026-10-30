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
- Stato: [ ]
- Obiettivo: repo git con Vite + TypeScript + Vitest + lint.
- Done quando: `npm run build`, `npm test` e `npm run lint` passano con un test vuoto; `.gitignore` presente; sezione TypeScript aggiunta a `CONVENTIONS.md`; comandi aggiornati in `CONTEXT.md`.
- File: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`, `tests/`, `.gitignore`
- Dipende da: nessuno
- Note: repo git già inizializzato e pubblicato su https://github.com/verbavolant/tempoMax (pubblico, branch `main`); `.gitignore` di base già presente.

### T-002 Setup Google Cloud + guida
- Stato: [ ]
- Obiettivo: progetto Google Cloud con Drive API e Sheets API abilitate, schermata di consenso OAuth, client ID web.
- Done quando: il client ID esiste, le origini autorizzate sono configurate (dev + produzione) e i passaggi sono documentati in `docs/human/setup-google.md`.
- File: `docs/human/setup-google.md`
- Dipende da: nessuno
- Note: lo fa **l'umano** nella console; l'agente scrive la guida verificando sulla documentazione ufficiale. Unico scope: `drive.file` (non-sensitive, vale anche per Sheets). Mettere l'app "In production" (vedi ADR-001): in "Testing" le autorizzazioni scadono dopo 7 giorni.

### T-003 Login Google
- Stato: [ ]
- Obiettivo: login/logout con Google Identity Services (token model), scope `drive.file`, rinnovo del token alla scadenza.
- Done quando: su iPhone si fa il login, si ottiene il token, si chiama `about.get` di Drive e il token si rinnova dopo la scadenza senza perdere lo stato.
- File: `src/auth/`
- Dipende da: T-001, T-002
- Note: il rinnovo passa da `requestAccessToken()` chiamato in un gesto dell'utente (ADR-001). Rischio da verificare su iPhone: Safari blocca i popup aperti dopo un'operazione asincrona. Strategia: controllare la scadenza (`expires_in`) *prima* che l'utente tocchi un pulsante e, se il token è scaduto, chiedere il rinnovo nel tap stesso. Le scritture in attesa restano in locale.

### T-004 Modulo storage Drive
- Stato: [ ]
- Obiettivo: creare o trovare la cartella `TempoMax/`, leggere e scrivere file JSON, caricare file binari.
- Done quando: test con `fetch` simulato per ogni operazione + verifica manuale su un Drive reale.
- File: `src/storage/drive.ts`, `tests/storage/`
- Dipende da: T-003

### T-005 Modello dati
- Stato: [ ]
- Obiettivo: tipi e validazione per Cliente, Visita, Task (da fare / da comprare), con versione dello schema.
- Done quando: test di validazione e serializzazione passano.
- File: `src/model/`, `tests/model/`
- Dipende da: T-001

### T-006 Geolocalizzazione + distanza
- Stato: [ ]
- Obiettivo: lettura della posizione con gestione di errori e precisione; Haversine; ricerca del cliente più vicino.
- Done quando: test di Haversine su coppie di coordinate con distanza nota (fonte citata nel test); test del cliente più vicino.
- File: `src/geo/`, `tests/geo/`
- Dipende da: T-005

### T-007 Anagrafica clienti
- Stato: [ ]
- Obiettivo: lista dei clienti, creazione con "sono qui adesso" (posizione attuale), modifica, salvataggio su `clienti.json`.
- Done quando: si crea un cliente su iPhone e compare in `clienti.json` su Drive.
- File: `src/ui/clients.ts`, `src/storage/`
- Dipende da: T-004, T-006

### T-008 Check-in
- Stato: [ ]
- Obiettivo: schermata "Oggi" con il cliente più vicino proposto, avviso se fuori raggio, cliente nuovo creato al volo; la visita aperta viene salvata subito in locale e poi su Drive.
- Done quando: dopo il check-in, ricaricando la pagina, la visita in corso è ancora presente; il JSON della visita è su Drive.
- File: `src/ui/today.ts`, `src/storage/`
- Dipende da: T-007

### T-009 Check-out + nota
- Stato: [ ]
- Obiettivo: schermata della visita in corso con timer, nota testuale e check-out con posizione; il JSON della visita viene chiuso.
- Done quando: una visita completa su Drive ha orari, posizioni, durata calcolabile e nota.
- File: `src/ui/visit.ts`
- Dipende da: T-008

### T-010 Deploy HTTPS + test su iPhone
- Stato: [ ]
- Obiettivo: pubblicazione su hosting statico HTTPS e test end-to-end su iPhone.
- Done quando: URL pubblico funzionante; checklist di test manuale in `docs/human/` eseguita ed esito annotato in PROGRESS.
- File: config di deploy (GitHub Actions), `vite.config.ts` (`base`), `docs/human/`
- Dipende da: T-009
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
