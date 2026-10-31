# Prova di TempoMax sul telefono

App: **https://verbavolant.github.io/tempoMax/**

Annota l'esito di ogni passo (✓ / ✗ con il testo esatto di eventuali messaggi).

## Installazione sulla schermata Home
- **iPhone (Safari)**: apri l'indirizzo → pulsante **Condividi** (quadrato con freccia) → **Aggiungi alla schermata Home** → **Aggiungi**.
- **Android (Chrome)**: apri l'indirizzo → menu **⋮** → **Installa app** (o **Aggiungi a schermata Home**).
- [ ] Sulla Home compare l'icona verde con il cronometro, nome **TempoMax**.
- [ ] Aprendola, l'app si vede a schermo intero, senza la barra del browser.
- [ ] Con la **modalità aereo** attiva l'app si apre lo stesso e INIZIA registra la visita ("…non ancora su Drive: nessuna connessione").

> Attenzione: su iPhone l'app installata ha un archivio separato da Safari (verificato il 2026-10-31). Le visite in corso non passano dall'una all'altra; i dati su Drive sono comuni. **Usa sempre l'app installata.**

## Preparazione
- [ ] Apri l'indirizzo in **Safari** (iPhone) o **Chrome** (Android).
- [ ] Compare il pulsante verde **INIZIA** e sotto **👥 Clienti**.

## Clienti
- [ ] Tocca **Clienti**: al primo uso compare il login Google. Accedi e accetta il permesso Drive.
- [ ] Il telefono chiede il permesso di **posizione**: consenti.
- [ ] Crea un cliente dove ti trovi con **📍 Sono qui adesso** e salva. Annota la precisione mostrata (±… m).
- [ ] Torna indietro.

## Visita
- [ ] Tocca **INIZIA**: il pulsante diventa rosso **FINE** con il tempo che scorre; sotto compare il nome del cliente.
- [ ] Blocca il telefono per qualche minuto, poi riaprilo: il tempo è andato avanti.
- [ ] Chiudi la scheda del browser e riapri l'indirizzo: la visita è ancora in corso.
- [ ] Tocca **FINE**.

## Note vocali
- [ ] Durante una visita tocca **🎤 Nota vocale**: il telefono chiede il microfono, consenti. Il pulsante diventa rosso **⏹ Ferma** con il tempo.
- [ ] Parla qualche secondo, tocca **⏹ Ferma**: compare "🎧 Nota 1 · 0:00:0x".
- [ ] **▶** riproduce la nota; **🗑** la elimina (chiede conferma).
- [ ] Avvia una nota e **blocca lo schermo** per 20 secondi, poi riapri: la registrazione continua? Fermandola, la nota dura circa quanto il tempo trascorso?
- [ ] Avvia una nota e tocca direttamente **FINE**: la visita si chiude e la nota non va persa.
- [ ] Dopo FINE (con rete), su Drive in `TempoMax/audio/2026/` c'è il file `.m4a` della nota e si ascolta.
- [ ] Nel **Registro visite** la colonna **Audio** (I) contiene il link della nota, che apre il file su Drive.

## Note libere ed elenco note
- [ ] **Senza visita in corso** tocca 🎤, parla, ⏹: compare "Nota libera salvata.".
- [ ] Su Drive, in `TempoMax/audio/2026/`, c'è il file `AAAA-MM-GG_libera_….m4a`.
- [ ] **🎧 Note vocali**: le note sono divise in "Note libere" e "Note delle visite", con data e ora (le note delle visite anche con il cliente).
- [ ] ▶ riproduce una nota già su Drive (si scarica) e una appena registrata.

## Orario di lavoro
- [ ] In cima alla home: **▶ Inizio lavoro** (attivo) e **⏸ Fine lavoro** (grigio). Tocca **Inizio lavoro**: si scambiano, sotto compare "Al lavoro da 0:00 · oggi 0:00".
- [ ] Pausa: **Fine lavoro** → "In pausa · oggi …"; poi **Inizio lavoro** di nuovo.
- [ ] Il totale di "oggi" non conta il tempo di pausa.
- [ ] Su Drive: `TempoMax/lavoro/2026/AAAA-MM-GG.json` con i periodi e il Foglio **Orario di lavoro** con una riga per periodo.
- [ ] La home sta in una schermata senza scorrere.

## Dettaglio visite
- [ ] **🕘 Visite**: una visita senza cliente mostra "⚠️ senza cliente · tocca per abbinare" e "🎧 n" se ha note.
- [ ] Toccandola: "📍 Apri in Maps il luogo della visita" apre Maps sul punto del check-in.
- [ ] "Abbina a un cliente" → scegli → Salva: la visita mostra il cliente (e nel registro la colonna Cliente).
- [ ] "Registrazioni": ▶ riproduce la nota della visita, ⏸ la ferma.
- [ ] In **modalità aereo**: INIZIA e FINE → poi, con la rete, la visita in Visite ha il link Maps (la posizione ora si salva anche offline).

## Senza rete
- [ ] Attiva la modalità aereo, tocca **INIZIA**: compare "Salvata sul telefono, non ancora su Drive…".
- [ ] Togli la modalità aereo, tocca **FINE**: l'avviso sparisce.

## Controllo dal PC
- [ ] Su Drive, in `TempoMax/visite/2026/`, ci sono i file delle visite.
- [ ] In `TempoMax/Registro visite` c'è **una riga per visita**, con orari e durata.
- [ ] I link nelle colonne **Mappa inizio / Mappa fine** si aprono con un clic (o vanno copiati?) e mostrano il punto giusto.

## Login dopo un'ora
- [ ] Lascia passare più di un'ora senza usare l'app, poi tocca il pulsante: se compare il login Google, si chiude da solo o con un tocco e la visita viene salvata.
