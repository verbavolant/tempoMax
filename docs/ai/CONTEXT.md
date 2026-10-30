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
| `src/main.ts` | bootstrap: monta l'app in `#app` |
| `src/model/validation.ts` | `ValidationError` (con percorso del campo), helper `expect*`, `SCHEMA_VERSION` |
| `src/model/position.ts` | `Coordinates`, `MeasuredPosition` (con `accuracyMeters`) |
| `src/model/client.ts` | `Client`, `ClientsDocument` (`clienti.json`), `parseClientsDocument` |
| `src/model/visit.ts` | `Visit`, `VisitEvent`, `parseVisit` (un file per visita) |
| `src/model/task.ts` | `Task` (`todo` / `purchase`), `TasksDocument` (`task.json`), `parseTasksDocument` |
| `vite.config.ts` | config di Vite + Vitest |
| `eslint.config.js` | lint (flat config, typescript-eslint) |
| `tsconfig.json` | type check (strict, solo `noEmit`: il build lo fa Vite) |

## Comandi
- Setup: `npm install` (Node ≥ 22.12; verificato con Node 26.4)
- Dev: `npm run dev` → http://localhost:5173
- Test: `npm test`
- Lint/typecheck: `npm run lint` / `npm run typecheck`
- Build: `npm run build` (typecheck + `vite build` → `dist/`)

## Layout dati su Drive (ADR-003)
```
TempoMax/
  clienti.json
  task.json                         # da fare + da comprare
  visite/AAAA/AAAA-MM-GG_<idVisita>.json
  audio/AAAA/<idVisita>_<n>.<m4a|webm>
  Registro ore (Foglio Google)
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
