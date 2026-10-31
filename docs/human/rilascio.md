# Versione di prova e versione ufficiale

| | Prova | Ufficiale |
|---|---|---|
| Indirizzo | https://verbavolant.github.io/tempoMax-dev/ | https://verbavolant.github.io/tempoMax/ |
| Nome sul telefono | **TempoMax DEV** (icona arancione) | **TempoMax** (icona verde) |
| Cartella su Google Drive | `TempoMax-dev` | `TempoMax` |
| Chi la usa | chi sviluppa e prova | il giardiniere |
| Si aggiorna | a ogni modifica pronta | **solo con l'ok esplicito del responsabile** |

Le due app si possono installare entrambe sullo stesso telefono: dati, archivio locale e fogli sono separati, quindi le prove non finiscono nei registri veri.

## Flusso
1. Lo sviluppo avviene sul ramo `dev`.
2. Ogni modifica verificata viene pubblicata sulla **prova**: `git push staging dev:main` → GitHub Actions del repo `verbavolant/tempoMax-dev`.
3. Si prova sul telefono con l'app **TempoMax DEV**.
4. Solo quando il responsabile scrive chiaramente di pubblicare sull'ufficiale:
   ```bash
   git switch main
   git merge --ff-only dev
   git push origin main      # → GitHub Actions di verbavolant/tempoMax pubblica la versione ufficiale
   git switch dev
   ```

Il workflow (`.github/workflows/deploy.yml`) è lo stesso nei due repo: ricava dal nome del repo l'indirizzo (`/tempoMax/` o `/tempoMax-dev/`) e l'ambiente (ufficiale o prova).
