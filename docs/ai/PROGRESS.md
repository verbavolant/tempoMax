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
