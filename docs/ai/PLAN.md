# PLAN.md — Piano di sviluppo

> Visione e roadmap a fasi. Indica sempre quale fase è ATTIVA.

## Obiettivo
Webapp per telefono (PWA) che un giardiniere usa sul campo per:
- fare **check-in / check-out** con geolocalizzazione presso un cliente;
- registrare **audio** dal telefono su cosa ha fatto in quella visita;
- tenere un elenco persistente di **cose da fare** e **cose da comprare**, legate al cliente;
- avere le **ore per cliente** pronte per la **fatturazione**.

Tutti i dati vengono salvati sul **Google Drive dell'utente** (login Google).

Criteri di successo:
- check-in e check-out con **un tap ciascuno**, anche senza cliente;
- nessuna visita persa se manca la rete durante la visita;
- report mensile delle ore per cliente leggibile in un Foglio Google.

## Vincoli
- Il primo dispositivo è un **iPhone/Safari** (lo sviluppatore). Il destinatario userà **Android/Chrome**: entrambi vanno supportati e testati.
- Audio registrato **solo dal telefono** (niente upload da PC).
- Niente appuntamenti pianificati: il giardiniere **decide sul momento** dove andare. Niente integrazione Calendar.
- I clienti sono spesso gli stessi, ma non sempre: serve un'anagrafica, ma il check-in **non** deve richiedere un cliente (può essere indicato dopo, o mai).
- Nessun backend: tutto client-side + API Google (vedi ADR-001).
- HTTPS obbligatorio (GPS, microfono, OAuth).
- Il check-in automatico all'arrivo (geofencing in background) **non è possibile** in una webapp: il check-in resta manuale, con verifica della distanza.

## Fasi

### Fase 1 — MVP check-in/out  ← ATTIVA
- Scopo: login Google, **un pulsante unico check-in/check-out** con GPS, salvataggio su Drive. Cliente facoltativo; anagrafica clienti in una schermata secondaria.
- Principio UI (richiesta dell'utente, 2026-10-31): la schermata principale è visivamente essenziale; le funzioni si aggiungono un po' alla volta, fuori dalla schermata principale.
- Done: su iPhone reale (deploy HTTPS) si fa una visita completa e su Drive compare il JSON corretto.
- Task: T-001 … T-010, T-021

### Fase 2 — Fatturazione ore
- Scopo: Foglio Google "Registro" con una riga per visita, e riepilogo mensile delle ore per cliente.
- Dipende da: Fase 1
- Task: T-011 … T-012

### Fase 3 — Audio
- Scopo: registrare uno o più audio durante la visita, caricati su Drive e collegati alla visita.
- Dipende da: Fase 1
- Task: T-013 … T-014

### Fase 4 — Da fare / Da comprare
- Scopo: liste persistenti per cliente, aggiungibili durante la visita e chiudibili in qualsiasi momento, più una vista globale (es. la lista spesa al vivaio).
- Dipende da: Fase 1
- Task: T-015 … T-017

### Fase 5 — Robustezza e Android
- Scopo: coda offline completa (IndexedDB) per tutte le scritture, PWA installabile, test su Android.
- Dipende da: Fasi 1–4
- Task: T-018 … T-020

## Fuori scope (per ora)
- Trascrizione automatica degli audio.
- Integrazione con Google Calendar o appuntamenti pianificati.
- Generazione delle fatture (si producono solo le ore; la fattura resta fuori).
- Upload di audio da computer.
- Più utenti / account condivisi.
