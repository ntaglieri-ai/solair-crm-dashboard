# SSO Nextcloud con Supabase OIDC

## Architettura

Supabase Auth e' l'Identity Provider OIDC. Nextcloud e' il client OIDC tramite
l'app ufficiale `user_oidc`. La pagina CRM `/oauth/consent` approva soltanto il
client identificato da `SUPABASE_OAUTH_NEXTCLOUD_CLIENT_ID`.

## 1. Installazione iniziale Nextcloud

Per ottenere il callback URL, installare prima l'app:

`NC_OCC="sudo -u www-data php /var/www/nextcloud/occ" INSTALL_ONLY=1 bash scripts/configure-nextcloud-oidc.sh`

Aprire quindi le impostazioni amministrative OpenID Connect e copiare il
callback URL mostrato.

## 2. Supabase Dashboard

In **Authentication > OAuth Server**:

1. Abilitare OAuth 2.1 Server.
2. Impostare Authorization Path: `/oauth/consent`.
3. Verificare che il progetto usi una signing key asimmetrica (RS256/ES256).

In **Authentication > OAuth Apps** creare un client confidenziale:

- nome: `Solair Nextcloud`
- redirect URI: copiare esattamente il callback mostrato da Nextcloud nella
  configurazione `user_oidc`
- token endpoint auth method: `client_secret_basic`

Salvare Client ID e Client Secret. Il secret viene mostrato una sola volta.

## 3. Server Nextcloud

Eseguire `scripts/configure-nextcloud-oidc.sh` sul server impostando:

- `NC_OCC`
- `SUPABASE_DISCOVERY_URI`
- `SUPABASE_OAUTH_CLIENT_ID`
- `SUPABASE_OAUTH_CLIENT_SECRET`

La discovery URI e':

`https://PROJECT_REF.supabase.co/auth/v1/.well-known/openid-configuration`

Dopo lo script completare i mapping nell'interfaccia amministrativa OpenID
Connect come indicato dall'output. Mantenere il login locale disponibile per il
recovery admin; si raggiunge con `/login?direct=1`.

## 4. Variabili CRM/Vercel

Impostare:

- `SUPABASE_OAUTH_NEXTCLOUD_CLIENT_ID`: Client ID creato su Supabase
- `NEXTCLOUD_OIDC_LOGIN_URL`: URL del pulsante/provider OIDC mostrato da
  Nextcloud dopo la configurazione

Eseguire un nuovo deploy dopo aver configurato le variabili.

## 5. Collaudo

1. Accedere al CRM.
2. Aprire Documenti e premere **Apri Nextcloud**.
3. Il browser deve tornare su Nextcloud senza richiedere password.
4. Verificare l'utente esistente `atravelscope@gmail.com` e un nuovo utente.
5. Verificare `/login?direct=1` con l'account admin locale prima di considerare
   conclusa la configurazione.

Non disabilitare il backend locale finche' tutti gli utenti esistenti non sono
stati verificati: un mapping UID errato puo' creare account Nextcloud duplicati.

## 6. Cambio utente del browser (Roberta -> Nando)

`user_oidc` 8.11.0 riutilizza una sessione Nextcloud gia' aperta senza ripetere
OIDC. Per questo il solo logout Supabase non cambia l'utente Nextcloud.

Il nuovo flusso e':

1. `/api/auth/nextcloud/open` verifica utente, provisioning, permessi e callback
   configurati sul provider. Salva un cookie HttpOnly firmato, valido 180 secondi,
   con utente CRM e destinazione. Usa la chiave `NEXTCLOUD_CRED_ENC_KEY` esistente
   con un prefisso di firma dedicato; nessuna password va nel browser.
2. Nextcloud `/apps/user_oidc/login/3?redirectUrl=/apps/user_oidc/sls` assicura
   una sessione OIDC anche alla prima apertura, poi ne esegue il logout.
3. Il provider richiama `/api/auth/nextcloud/resume`. Questa route NON chiude
   Supabase: consuma il cookie, ricontrolla identita'/permessi e avvia il vero
   login OIDC verso il documento richiesto. Un cambio account durante il
   passaggio lo annulla: l'utente deve premere nuovamente Apri Nextcloud.

Un logout manuale Nextcloud, senza apertura pendente, torna a Documenti e non
riaccede automaticamente. Il cambio interessa le schede dello stesso profilo
browser, non gli altri dispositivi. Due aperture simultanee condividono il cookie:
l'ultima destinazione prevale; non avviare piu' cambi contemporaneamente.

### Attivazione coordinata, senza SSH

Pubblicare PRIMA le route CRM, POI aggiornare il provider. Fino all'attivazione,
il nuovo pulsante fallisce con un messaggio esplicito, senza aprire la sessione
del vecchio utente. WebDAV e gli altri moduli CRM non vengono modificati.

Lo script `scripts/configure-nextcloud-session-switch.mjs` e' read-only per
default. Legge il provider e controlla `HEAD /api/auth/nextcloud/resume`, che deve
rispondere 204 con `X-Nextcloud-Session-Switch: v1`:

```powershell
node --env-file=.env.local scripts/configure-nextcloud-session-switch.mjs
```

Per applicare, fornire la password PRINCIPALE Admin tramite la sola variabile
di processo `NEXTCLOUD_SETUP_PASSWORD` e passare `--apply`. Non salvare la password
nel repository o nella cronologia dei comandi. `NEXTCLOUD_CRM_ORIGIN` consente
di usare un'origine diversa da `https://crm.solairgroup.it`.

Lo script imposta sia `endSessionEndpoint` sia `postLogoutUri` al callback CRM,
preservando scope, mapping, client ID e client secret. Rilegge il risultato e
tenta il ripristino della configurazione precedente in caso di errore.
Il callback e' deliberatamente un ritorno locale al CRM, NON un logout Supabase.

Requisiti Nextcloud: `single_logout` abilitato (default), sessioni del provider
OIDC configurato. Un account entrato con login LOCALE Nextcloud non contiene
il provider nella sessione: con backend multipli abilitati `/sls` non sa dove
tornare. Per quel caso fare prima logout manuale; tenere l'Admin locale in un
profilo browser separato per il recovery. Non viene disabilitato il login locale.

### Collaudo prima di considerare attivo il cambio

- Prima apertura senza sessione Nextcloud: login automatico e cartella Solair.
- Roberta nel CRM/Nextcloud, logout CRM, login Nando, Apri Nextcloud: Nando.
- Ripetere Nando -> Roberta e verificare i rispettivi permessi.
- File/cartelle con spazi, `&`, `#` e accenti mantengono la destinazione.
- Logout manuale Nextcloud non provoca un ciclo di rientro automatico.
- Sessione CRM scaduta, account cambiato a meta' flusso e cookie scaduto/manomesso
  non completano il passaggio.
- Confermare che una sessione su un altro dispositivo rimanga aperta.

I test automatici coprono route, cookie, permessi e payload di configurazione;
non sostituiscono questo collaudo con le sessioni reali di Nextcloud.
