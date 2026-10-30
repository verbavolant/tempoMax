# TempoMax

Webapp per telefono pensata per un giardiniere: check-in e check-out geolocalizzati presso i clienti, note audio, liste "da fare" e "da comprare" e ore pronte per la fatturazione. I dati vengono salvati sul Google Drive dell'utente.

> In sviluppo: per ora c'è solo lo scheletro del progetto.

## Requisiti
- Node.js ≥ 22.12

## Installazione
```bash
npm install
```

## Uso (sviluppo)
```bash
npm run dev      # http://localhost:5173
```

## Sviluppo
- Test: `npm test`
- Lint/typecheck: `npm run lint` / `npm run typecheck`
- Build: `npm run build` (output in `dist/`)
- Note per chi sviluppa con assistenza AI: vedi `CLAUDE.md` e `docs/ai/`.
