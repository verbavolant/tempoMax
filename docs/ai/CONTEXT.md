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
> Prevista: va confermata da T-001.
```
src/            # codice applicazione (TS)
  auth/         # login Google, gestione token
  storage/      # accesso a Drive/Sheets, coda locale
  geo/          # geolocalizzazione, distanza
  model/        # tipi e validazione del dominio
  ui/           # schermate
tests/          # test vitest
docs/ai/        # stato per agenti AI
docs/human/     # documentazione per l'utente/setup
```

## File/moduli chiave
| Path | Responsabilità |
|------|----------------|
| (da compilare dopo T-001) | |

## Comandi
> Da confermare in T-001.
- Setup: `npm install`
- Dev: `npm run dev`
- Test: `npm test`
- Lint/typecheck: `npm run lint` / `npm run typecheck`
- Build: `npm run build`

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
