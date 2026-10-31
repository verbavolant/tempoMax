# DECISIONS.md — Registro delle decisioni (ADR)

> Una voce per decisione architetturale o di approccio non ovvia.
> Serve a NON rimettere in discussione scelte già prese a ogni cambio di sessione/modello.

<!-- Template:

## ADR-XXX — <titolo della decisione>
- Data:
- Stato: <accettata | superata da ADR-YYY>
- Contesto: <il problema/la scelta da fare>
- Decisione: <cosa è stato deciso>
- Motivazione: <perché>
- Alternative scartate: <e perché no>
- Conseguenze: <cosa comporta, vincoli che introduce>

-->

## ADR-001 — PWA client-only su Google Drive, senza backend
- Data: 2026-10-30
- Stato: accettata
- Contesto: i dati devono finire sul Google Drive del giardiniere; l'utente è uno solo e il budget è zero.
- Decisione: PWA statica (hosting gratuito con HTTPS, es. GitHub Pages) che chiama direttamente le API di Google con un token OAuth ottenuto lato client tramite Google Identity Services. Scope: `drive.file`; Sheets API sul foglio creato dall'app.
- Motivazione: niente server da mantenere né costi; i dati non passano da terzi; `drive.file` dà accesso solo ai file creati dall'app.
- Alternative scartate: backend proprio (costi, manutenzione, gestione dei token); Firebase o un altro DB (i dati non starebbero sul suo Drive); Google Apps Script come web app (UI limitata, PWA e offline più difficili).
- Conseguenze (verificate sulla doc ufficiale il 2026-10-30):
  - Serve un progetto Google Cloud con client ID OAuth web e origini autorizzate (T-002).
  - `drive.file` è "Recommended, non-sensitive" anche per la Sheets API, quindi basta un solo scope per Drive e Sheets.
  - Con soli scope non-sensitive la verifica dell'app non è obbligatoria e non compare l'avviso "app non verificata": l'app si pubblica direttamente "In production".
  - In stato "Testing" invece le autorizzazioni scadono dopo 7 giorni, c'è un limite di 100 utenti di test e compare un avviso. Per questo l'app va messa "In production".
  - Il token di accesso ha vita breve (la durata in secondi arriva in `expires_in`). Si rinnova chiamando `requestAccessToken()` da un gesto dell'utente; con `prompt: ''` il consenso viene chiesto solo la prima volta (gestione in T-003).
  - Fonti: developers.google.com/workspace/drive/api/guides/api-specific-auth, developers.google.com/workspace/sheets/api/scopes, support.google.com/cloud/answer/13463073, support.google.com/cloud/answer/15549945, developers.google.com/identity/oauth2/web/reference/js-reference

## ADR-002 — Vite + TypeScript, senza framework UI
- Data: 2026-10-30
- Stato: accettata
- Contesto: app piccola (4–5 schermate) da usare su telefoni anche modesti.
- Decisione: TypeScript con Vite; DOM manipolato direttamente con piccoli moduli per schermata; test con Vitest.
- Motivazione: bundle minimo, nessuna dipendenza da aggiornare, i tipi aiutano sul modello dati.
- Alternative scartate: React/Vue/Svelte (sovradimensionati per questo scopo); JS puro senza build (niente tipi né test comodi).
- Conseguenze: se la UI cresce molto, valutare un framework leggero con un nuovo ADR.

## ADR-003 — Formato dati: JSON su Drive come fonte di verità, Foglio come vista
- Data: 2026-10-30
- Stato: accettata
- Contesto: servono dati strutturati (visite, task, clienti) e un registro ore leggibile per fatturare.
- Decisione: un file JSON per visita (`visite/AAAA/...`), `clienti.json` e `task.json` come file unici, audio come file separati. Il Foglio "Registro ore" viene derivato dalle visite.
- Motivazione: un file per visita limita i conflitti e la perdita di dati in caso di errore; il Foglio è comodo per l'umano ma fragile come database (può essere modificato a mano).
- Alternative scartate: tutto nel Foglio (modifiche manuali rompono il formato, gli audio non ci stanno); un unico JSON (rischio di sovrascrittura e file che cresce senza limiti).
- Conseguenze: serve una funzione che rigenera o aggiorna le righe del Foglio a partire dalle visite.

## ADR-004 — Check-in manuale con verifica di distanza
- Data: 2026-10-30
- Stato: accettata
- Contesto: si voleva un check-in "quando si trova sul posto".
- Decisione: il check-in è un tap. L'app legge la posizione, propone il cliente più vicino e, se la distanza supera il raggio del cliente, mostra un avviso ma permette di procedere. Vengono salvate posizione e precisione GPS.
- Motivazione: una webapp non può monitorare la posizione in background (niente geofencing automatico).
- Alternative scartate: app nativa con geofencing (costo e complessità sproporzionati).
- Conseguenze: la distanza si calcola con la formula di Haversine, coperta da test su coppie di coordinate con distanza nota da fonte esterna (T-006). Raggio: R1 di GRS80 = 6 371 008,7714 m (Moritz, IUGG 1979). Riferimento di test: Rosetta Code "Haversine formula" (BNA→LAX), più identità esatte (1° di meridiano = R·π/180, antipodi = π·R). `accuracy` del GPS è in metri con confidenza 95% (MDN): servirà in T-008 per decidere l'avviso "fuori raggio".

## ADR-005 — Validazione dei dati scritta a mano, senza librerie
- Data: 2026-10-30
- Stato: accettata
- Contesto: i JSON letti da Drive possono essere vecchi, corrotti o modificati a mano; vanno validati prima dell'uso.
- Decisione: piccole funzioni `expect*` in `src/model/validation.ts` e un parser `parse*` per ogni documento, che lancia `ValidationError` con il percorso del campo (es. `clienti.clients[0].location.latitude`). Ogni documento ha `schemaVersion`, controllato per primo.
- Motivazione: pochi tipi e semplici; nessuna dipendenza (coerente con ADR-002); messaggi in italiano.
- Alternative scartate: zod/valibot (dipendenza in più per circa 5 tipi).
- Conseguenze: aggiungere un campo significa aggiornare sia l'interfaccia sia il parser. Un cambio incompatibile richiede di incrementare `SCHEMA_VERSION` e di scrivere una migrazione. Gli orari devono avere sempre il fuso (`Z` o `±HH:MM`): `Date.parse` senza fuso usa l'ora locale e accetta date inesistenti (30 febbraio → 2 marzo), verificato su Node 26.

## ADR-006 — Visita senza cliente obbligatorio; schermata principale a pulsante unico
- Data: 2026-10-31
- Stato: accettata
- Contesto: dopo aver provato l'anagrafica, l'utente giudica la UI troppo complicata per il giardiniere. Vuole un pulsante grande che faccia check-in e check-out anche senza aver identificato il cliente, che si potrà indicare dopo o mai.
- Decisione: `Visit.clientId` diventa `string | null`. La schermata principale ha solo il pulsante INIZIA/FINE e il tempo trascorso. Anagrafica e assegnazione del cliente vivono in schermate secondarie.
- Motivazione: registrare l'orario non deve dipendere da nessuna scelta; il dato più importante (le ore) non va mai perso.
- Alternative scartate: scegliere il cliente al check-in, come previsto prima in T-008 (attrito sul campo).
- Conseguenze: il registro ore (T-011) e i riepiloghi (T-012) devono gestire le visite "senza cliente". Nessuna visita è ancora stata salvata, quindi il cambio non richiede una nuova `SCHEMA_VERSION`. `Task.clientId` resta obbligatorio per ora: da rivedere in Fase 4.
