# CLAUDE.md — Istruzioni operative per l'agente di sviluppo

> Questo file viene letto a ogni sessione. È volutamente breve.
> Il dettaglio sta nei file di stato in `docs/ai/`, non qui.
> Le stesse regole valgono per qualsiasi agente: copia o linka questo file come `AGENTS.md` per Continue/Zed/opencode.

---

## 0. Regola zero

1. **Prima di scrivere codice, leggi lo stato.** La fonte di verità è `docs/ai/`, non questa chat.
2. **Prima di affermare, verifica.** Niente API, firme, path o opzioni inventate.
3. **Se non sai, dillo.** Meglio una domanda o un `TODO` esplicito che una risposta plausibile e falsa.

---

## 1. File di stato — memoria persistente del progetto

Tutto lo stato vive in file versionati, così la sessione successiva (o un modello diverso) riparte senza dipendere dal contesto perso.

| File | Scopo |
|------|-------|
| `docs/ai/CONTEXT.md`   | Mappa del progetto: struttura, file chiave, convenzioni, glossario, comandi. **Cambia di rado.** |
| `docs/ai/PLAN.md`      | Visione e roadmap a fasi. Quale fase è attiva ora. |
| `docs/ai/TASKS.md`     | Backlog spezzato in task piccoli e verificabili, con stato. |
| `docs/ai/PROGRESS.md`  | Diario append-only: cosa è stato fatto, cosa viene dopo (**handoff**). |
| `docs/ai/DECISIONS.md` | ADR: decisioni architetturali con motivazione e alternative scartate. |
| `docs/ai/CONVENTIONS.md` | Regole di codice per linguaggio (Python/Bash/Java/C#): tooling, idiomi, layout. |

### A inizio sessione (sempre, in quest'ordine)
1. Leggi `CONTEXT.md`.
2. Leggi `PLAN.md` → individua la fase attiva.
3. Leggi le **ultime 1–2 voci** di `PROGRESS.md` (non tutto).
4. Leggi i task **aperti** in `TASKS.md`.
5. Riassumi in 3–4 righe: dove siamo, qual è il prossimo task, cosa farai. Attendi conferma se c'è ambiguità.

---

## 2. Ciclo di lavoro

```
pianifica → 1 task alla volta → implementa → verifica → aggiorna stato → commit
```

- **Un task alla volta.** Non aprire più fronti. Chiudi prima di passare al successivo.
- **Implementa** solo ciò che il task richiede. Niente extra "già che ci sono".
- **Verifica** sempre: test, esecuzione reale, lint. Non considerare fatto ciò che non hai visto funzionare.
- **Aggiorna stato** prima del commit (vedi §4).
- **Commit** atomico, messaggio in imperativo, riferito al task: `feat(parser): estrai PFN da BBS6 [T-014]`.

---

## 3. Pianificazione e suddivisione

Obiettivo: task piccoli abbastanza da stare in un contesto limitato, indipendenti, e verificabili da soli.

- Ogni task in `TASKS.md` ha: **ID**, una frase di obiettivo, criterio di "fatto", file coinvolti, dipendenze.
- Dimensione giusta: completabile e verificabile senza dover tenere in testa l'intero repo. Se un task tocca >5–6 file o richiede più "argomenti" mentali, **spezzalo**.
- Se durante il lavoro emergono nuovi task, **scrivili in `TASKS.md`** invece di farli al volo: protegge il focus e il contesto.
- Prima di una fase nuova o di un refactor ampio: scrivi/aggiorna `PLAN.md` e crea i task, **poi** chiedi conferma. Non partire a codificare un piano grosso senza che sia scritto.

---

## 4. Continuità tra sessioni e modelli

Lo stato deve bastare a chiunque (modello o umano) per riprendere a freddo.

A **fine task** (o prima di chiudere per limiti di contesto/token), aggiungi a `PROGRESS.md`:

```
## [DATA] — T-XXX <titolo>
- Fatto: <cosa è cambiato, in concreto: file/funzioni>
- Stato: <completo | parziale + cosa manca>
- Verifica: <comando lanciato + esito>
- Prossimo passo: <istruzione operativa per chi riprende>
- Trappole/note: <cose non ovvie scoperte qui>
```

Regole di handoff:
- Scrivi per un lettore **senza il tuo contesto attuale**. Niente "come dicevo prima".
- Path assoluti dalla root del repo, nomi reali di file/funzioni.
- Una decisione architetturale → va in `DECISIONS.md`, non solo nel diario.
- Non lasciare mai il repo in stato non compilabile/non eseguibile a fine sessione: o finisci, o committi con un `WIP` chiaro e una nota su come ripartire.

---

## 5. Anti-allucinazione (non negoziabile)

- **Non inventare** firme di funzione, API di librerie, opzioni di config, nomi di file, comandi. Se non l'hai letto nel codice o nella doc, verificalo prima.
- Per usare una libreria/funzione: **leggi il codice reale** (`grep`/apertura file) o la doc ufficiale. Niente "di solito si chiama così".
- **Niente algoritmi a memoria** dove conta la correttezza (parsing, calcoli fiscali, finanziari, conversioni, date). Usa una fonte/standard di riferimento e **scrivi un test** che lo dimostri. Se l'algoritmo è non banale, cita la fonte in un commento o in `DECISIONS.md`.
- Distingui sempre: *"questo l'ho verificato"* vs *"questa è un'ipotesi"*. L'ipotesi va marcata, non spacciata per fatto.
- Se manca un'informazione per procedere correttamente: **fermati e chiedi**, oppure lascia un `TODO:` esplicito con cosa va verificato. Non riempire il vuoto con codice verosimile.
- Numeri, soglie, aliquote, costanti di dominio: **mai a memoria**. Vanno da fonte o input, mai inventati.

---

## 6. Pulizia del codice

> Regole per-linguaggio (tooling, idiomi, cosa evitare) in `docs/ai/CONVENTIONS.md`. Leggilo quando tocchi un linguaggio per la prima volta nella sessione.

- **Diff minimo.** Cambia solo ciò che serve al task. Niente riformattazioni di righe non toccate.
- **Niente codice morto:** zero blocchi commentati, import/variabili inutilizzati, funzioni mai chiamate.
- **Aderisci alle convenzioni esistenti** del progetto (stile, naming, struttura). Se non c'è una convenzione, segui quella idiomatica del linguaggio.
- **YAGNI:** niente astrazioni, parametri, "framework" o generalizzazioni non richiesti dal task corrente.
- **Niente ottimizzazioni premature.** Prima corretto e leggibile; ottimizza solo con un motivo misurato.
- **Commenti = perché, non cosa.** Il codice dice *cosa*; il commento spiega *perché* solo dove non è ovvio.
- **Nomi espliciti.** Niente abbreviazioni criptiche, niente `data2`, `tmp`, `helper3`.
- **Errori espliciti:** gestisci o propaga, non ingoiare eccezioni in silenzio.
- Prima di consegnare: rileggi il diff e togli tutto ciò che non è strettamente necessario.

---

## 7. Comunicazione

- **Diretto, denso, niente riempitivi.** Vai al punto: cosa hai fatto, perché, cosa manca.
- Niente preamboli di cortesia, niente riepiloghi auto-celebrativi a fine risposta.
- Mostra il diff/codice rilevante e una motivazione breve. Non riscrivere file interi se basta un blocco.
- Se una richiesta è ambigua o rischiosa, **una domanda secca** prima di procedere, non tre paragrafi di ipotesi.
- Lingua: italiano per spiegazioni e doc; codice/identificatori secondo convenzione del progetto.

---

## 8. Economia di contesto e token

- Leggi **solo** i file rilevanti al task. Non scansionare il repo "per sicurezza".
- Non ri-leggere ciò che è già nel contesto.
- Sintetizza lo stato nei file di `docs/ai/` invece di tenere tutto in chat: scaricare la memoria su file **è** la strategia anti-allucinazione e anti-deriva.
- Risposte lunghe solo quando servono. Per il resto, conciso.

---

## 9. Documentazione: due binari

- **Per l'umano** → `docs/human/` e `README.md`: cosa fa il software, come si installa/usa, esempi. Niente dettagli interni di processo AI.
- **Per l'AI** → `docs/ai/`: stato, piano, decisioni, handoff (i file della §1).
- Le due cose non si mescolano. Aggiorna la doc umana quando cambia un comportamento osservabile dall'utente; aggiorna la doc AI a ogni task.

---

## 10. Cosa NON fare (riepilogo)

- ❌ Scrivere codice senza aver letto lo stato.
- ❌ Inventare API, costanti, algoritmi, fonti.
- ❌ Aprire più task insieme.
- ❌ Lasciare il repo rotto a fine sessione senza nota di ripresa.
- ❌ Refactor ampi non richiesti / non pianificati.
- ❌ Commenti che ripetono il codice, codice morto, diff rumorosi.
- ❌ Risposte gonfie di cortesie e riepiloghi.
