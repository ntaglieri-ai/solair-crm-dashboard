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
