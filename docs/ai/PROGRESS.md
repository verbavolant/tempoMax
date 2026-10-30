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
