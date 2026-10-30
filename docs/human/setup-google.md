# Setup Google Cloud per TempoMax

Serve **una sola volta**. Lo scopo è ottenere un **Client ID OAuth**: è il codice che permette alla pagina di mostrare "Accedi con Google" e di salvare i file sul Drive di chi fa il login.

- È gratis e non serve una carta di credito.
- Il progetto lo crei con **il tuo** account Google. I dati però finiscono sul Drive di **chi usa l'app** (il giardiniere): il progetto non ti dà accesso ai suoi file.
- Tempo: circa 15 minuti.

> Passaggi verificati sulla documentazione ufficiale di Google il 2026-10-30. Se nella console un nome di menu è diverso, segui il significato del passo e segnalalo, così aggiorniamo questa guida.

---

## 1. Crea il progetto
1. Apri https://console.cloud.google.com/projectcreate
2. **Project Name**: `TempoMax`.
3. **Location**: lascia "No organization".
4. Clicca **Create** e attendi qualche secondo.
5. In alto, accanto al logo, controlla che sia selezionato il progetto **TempoMax**.

## 2. Abilita le API
Menu ☰ → **APIs & Services** → **Library**. Cerca e abilita (pulsante **Enable**):
- [ ] **Google Drive API**
- [ ] **Google Sheets API**

## 3. Configura la schermata di consenso
Menu ☰ → **Google Auth platform** → **Branding**. Se compare "Google Auth platform not configured yet", clicca **Get Started**.

1. **App Information**
   - App name: `TempoMax`
   - User support email: la tua email
   - **Next**
2. **Audience**: scegli **External**. Con un account Gmail personale è l'unica opzione. **Next**.
3. **Contact Information**: la tua email. **Next**.
4. **Finish**: spunta "I agree to the Google API Services: User Data Policy", poi **Continue** → **Create**.

## 4. Dichiara il permesso (scope)
Menu ☰ → **Google Auth platform** → **Data Access** → **Add or Remove Scopes**.
- Cerca e seleziona **solo** `https://www.googleapis.com/auth/drive.file`, descritto come "See, edit, create, and delete only the specific Google Drive files you use with this app".
- **Update** → **Save**.

⚠️ Non aggiungere altri scope Drive o Sheets (`drive`, `spreadsheets`, …): sono "sensibili" o "riservati" e farebbero partire la verifica da parte di Google. `drive.file` basta sia per Drive sia per Sheets.

## 5. Crea il Client ID
Menu ☰ → **Google Auth platform** → **Clients** → **Create client**.
1. **Application type**: **Web application**.
2. **Name**: `TempoMax web`.
3. **Authorized JavaScript origins**: aggiungi questi tre (solo schema e host, **senza** `/tempoMax/` e senza `/` finale):
   - `https://verbavolant.github.io`
   - `http://localhost`
   - `http://localhost:5173`
4. **Authorized redirect URIs**: lasciali vuoti, non servono.
5. **Create**.
6. Copia il **Client ID**: finisce con `.apps.googleusercontent.com`.

🔒 Viene creato anche un **Client secret**: **non serve e non va condiviso**. Il Client ID invece non è segreto e starà nel codice pubblico.

## 6. Pubblica l'app ("In production")
Menu ☰ → **Google Auth platform** → **Audience** → sotto "Publishing status" clicca **Publish app** e conferma.

Perché farlo:
- in modalità **Testing** l'autorizzazione **scade dopo 7 giorni**, quindi il giardiniere dovrebbe rifare il login ogni settimana;
- in Testing serve anche una lista di utenti di test (massimo 100) e compare un avviso.

Con il solo scope `drive.file` (non sensibile) la verifica di Google **non è obbligatoria** e non compare l'avviso "app non verificata". Nome e logo dell'app sulla schermata di login richiedono una "brand verification" facoltativa: senza, il login funziona lo stesso.

---

## Fatto? Mandami
- [ ] il **Client ID** (`….apps.googleusercontent.com`)
- [ ] conferma che lo stato è **In production**
- [ ] eventuali passi in cui la console era diversa da questa guida

## Fonti
- Creare un progetto: https://developers.google.com/workspace/guides/create-project
- Abilitare le API: https://developers.google.com/workspace/guides/enable-apis
- Schermata di consenso: https://developers.google.com/workspace/guides/configure-oauth-consent
- Client ID web e origini: https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid
- Testing e produzione: https://support.google.com/cloud/answer/15549945
- Verifica non obbligatoria per gli scope non sensibili: https://support.google.com/cloud/answer/13463073
- Scope di Drive: https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- Scope di Sheets: https://developers.google.com/workspace/sheets/api/scopes
