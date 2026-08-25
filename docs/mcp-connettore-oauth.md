# Connettore MCP: OAuth e accesso multi-utente

Stato: attivo su `develop` dal 25/08/2026.

Fino a questa data il server MCP (`/api/mcp`, 79 tool) aveva **un solo
utente**: un bearer statico condiviso (`MCP_ACCESS_TOKEN`) e un'identita' fissa
letta da `VITO_USER_ID`. Ora qualunque persona del CRM con ruolo
**SUPERADMIN**, **ADMIN** o **DIRECTOR** puo' collegare il proprio account
Claude, autenticandosi con le stesse credenziali che usa per il CRM.

I tre ruoli hanno **lo stesso perimetro**: nessuna differenza fra loro in
questo modulo. Cio' che l'uno vede e l'altro no dipende dalla RLS di Supabase,
esattamente come dentro il CRM.

---

## Come collegare un utente (procedura)

Da fare una volta per persona, dal browser di quella persona.

1. **Requisiti**: account CRM attivo, ruolo SUPERADMIN/ADMIN/DIRECTOR, password
   definitiva gia' impostata (chi ha ancora quella temporanea viene fermato con
   un messaggio esplicito).
2. Su **claude.ai › Impostazioni › Connettori › Aggiungi connettore
   personalizzato**.
3. Come URL del server indicare:

   ```
   https://crm.solairgroup.it/api/mcp
   ```

   **Nessun header e nessun token da incollare.** Claude scopre da solo che il
   server richiede OAuth.
4. Claude apre la pagina di accesso del CRM. Se la sessione e' gia' aperta in
   quel browser, si salta direttamente al passo 5.
5. Compare la schermata **"Collega il CRM a Claude"** con nome, email e ruolo
   di chi sta autorizzando. Premere **Autorizza Claude**.
6. Il connettore risulta collegato. I 79 tool sono disponibili subito.

Se il ruolo non e' fra i tre ammessi, il passo 5 mostra il motivo del rifiuto e
**non viene generato nessun codice**: il collegamento non si completa.

---

## Cosa succede sotto

```
claude.ai                          CRM (crm.solairgroup.it)
    |
    |-- GET /.well-known/oauth-protected-resource/api/mcp ---> chi ti protegge?
    |-- GET /.well-known/oauth-authorization-server -------->  quali endpoint?
    |-- POST /api/oauth-mcp/register ---------------------->   dammi un client_id
    |-- GET  /oauth/mcp/authorize?... --------------------->   login CRM + consenso
    |<-- 303 https://claude.ai/api/mcp/auth_callback?code=...
    |-- POST /api/oauth-mcp/token (code + code_verifier) -->   access + refresh token
    |-- POST /api/mcp  Authorization: Bearer <access token>
```

| Endpoint | Cosa fa |
| --- | --- |
| `/.well-known/oauth-authorization-server` | Metadata RFC 8414 (riscritto su `/api/oauth-mcp/authorization-server`) |
| `/.well-known/oauth-protected-resource[/api/mcp]` | Metadata RFC 9728 |
| `POST /api/oauth-mcp/register` | Registrazione dinamica del client (RFC 7591) |
| `GET /oauth/mcp/authorize` | Login CRM + schermata di consenso |
| `POST /api/oauth-mcp/authorize` | Conferma → authorization code |
| `POST /api/oauth-mcp/token` | `authorization_code` e `refresh_token` |
| `POST /api/oauth-mcp/revoke` | Revoca di un refresh token (RFC 7009) |

`/authorize`, `/token` e `/register` rispondono **anche sulla radice del
dominio**: e' la rete di sicurezza per il difetto noto di claude.ai
([anthropics/claude-ai-mcp#644](https://github.com/anthropics/claude-ai-mcp/issues/644)),
che in certi casi ignora l'header statico e prova OAuth contro l'origine,
prendendo 404 su `/authorize`.

---

## Le decisioni di sicurezza, e perche'

**Il login non e' riscritto.** `/oauth/mcp/authorize` non ha un proprio form
password: se manca la sessione rimanda al `/login` del CRM. Cosi' la password
passa dall'unico percorso che ha throttle per IP, blocco IP, soglia tentativi e
registrazione in audit. Una seconda porta d'ingresso con meno protezioni della
prima sarebbe stata il punto debole dell'intero lavoro.

**Whitelist rigida dei `redirect_uri`**, confronto per stringa esatta:

- `https://claude.ai/api/mcp/auth_callback`
- `https://claude.com/api/mcp/auth_callback`

Niente `startsWith`, che accetterebbe `https://claude.ai.attaccante.tld/...`.
Deliberatamente esclusi i redirect di loopback che userebbe Claude Code da
terminale: l'obiettivo e' il connettore di claude.ai, e ogni voce in piu' e' un
posto in piu' dove un codice puo' finire.

**PKCE S256 obbligatorio**, `plain` non supportato. Il client e' pubblico:
nessun `client_secret`, che dentro un'applicazione incapace di custodirlo
sarebbe sicurezza solo apparente.

**Authorization code**: monouso, TTL 60 secondi, salvato come hash. Un codice
gia' speso che ritorna fa revocare tutti i refresh token nati da quel codice —
o e' un replay, o qualcuno ha intercettato il redirect.

**Refresh token**: 30 giorni, **ruotato a ogni uso**. Se ne ritorna uno gia'
revocato si stacca l'intera famiglia, cosi' l'accesso muore anche per chi lo ha
rubato.

**Controlli a ogni richiesta, non solo al login.** `/api/mcp` rilegge dal
database: utente esistente → attivo → ruolo ammesso *adesso*. Chi viene
disattivato o retrocesso perde l'accesso alla chiamata successiva, senza
aspettare la scadenza del token. E' il motivo per cui un access token non
revocabile da un'ora non e' un problema.

**Password**: mai registrate, mai in query string, mai lette da questo modulo —
il modulo non le vede proprio, le gestisce `/api/auth/login`.

---

## Tabelle

Tutte con RLS attiva e **zero policy**: da PostgREST non esistono per nessun
ruolo, ci scrive e ci legge solo il `service_role`. Stesso regime di
`mcp_tool_log`.

| Tabella | Contenuto |
| --- | --- |
| `mcp_oauth_clients` | Client registrati dinamicamente |
| `mcp_oauth_codes` | Authorization code (hash, TTL 60s, `usato_at`) |
| `mcp_refresh_tokens` | Refresh token (hash, `revoked_at`, `sostituito_da`) |
| `mcp_tool_log.utente_id` | Chi ha chiamato il tool |

Le righe di `mcp_tool_log` scritte **prima** del 25/08/2026 hanno `utente_id`
nullo e vanno lette come "Vito": fino a quella data il server aveva un utente
solo. Non sono state migrate — inventare un id a posteriori renderebbe il
registro meno affidabile, non piu'.

Nessuna foreign key verso `utenti`: sono un registro di credenziali con vita
propria, e il controllo che conta si rifa' comunque a ogni richiesta.

---

## Variabili d'ambiente

| Variabile | Ambiente | Note |
| --- | --- | --- |
| `MCP_OAUTH_SIGNING_KEY` | Production (Sensitive) | Firma degli access token. `openssl rand -base64 48`. Senza, OAuth e' spento e resta solo il bearer statico |
| `MCP_ACCESS_TOKEN` | Production (Sensitive) | Bearer statico storico — vedi sotto |
| `VITO_USER_ID` | Production (Sensitive) | `auth.users.id` associato al bearer statico |
| `MCP_OAUTH_ISSUER` | opzionale | Solo se l'origine pubblica non e' deducibile dalle intestazioni inoltrate |

Come le altre variabili MCP, esistono **solo in Production**: sui deployment di
Preview `/api/mcp` risponde `503`, ed e' atteso.

**Ruotare la chiave di firma** invalida tutti gli access token in circolazione
(i client rifanno il refresh da soli) ma non i refresh token, che vivono su
tabella.

---

## Il bearer statico: cosa ne resta

`MCP_ACCESS_TOKEN` continua a funzionare e mappa su `VITO_USER_ID`, cosi' il
connettore gia' configurato non si e' staccato durante il passaggio. **Non
salta nessun controllo**: ruolo e stato dell'account vengono verificati anche
su quel percorso.

Quando Vito avra' ricollegato il connettore via OAuth, quella coppia di
variabili puo' essere rimossa da Vercel: il codice che la legge sta tutto in
`lib/mcp/oauth/identita.ts` e sparisce con una funzione.

---

## Staccare una persona

```sql
-- revoca i refresh token attivi di un utente
update public.mcp_refresh_tokens
   set revoked_at = now()
 where utente_id = '<utenti.id>' and revoked_at is null;
```

Non serve nemmeno: disattivare l'account (`utenti.attivo = false`) o cambiargli
ruolo blocca l'accesso alla chiamata successiva. La revoca dei refresh token
serve a chiudere anche la possibilita' di rinnovo.

---

## Diagnostica

| Sintomo | Causa probabile |
| --- | --- |
| Claude dice che il server non supporta OAuth | `MCP_OAUTH_SIGNING_KEY` assente: `/authorize` risponde "connettore non configurato" |
| 404 su `/authorize` | Riscritture di `next.config.mjs` non distribuite |
| `invalid_redirect_uri` in registrazione | Claude ha proposto un callback fuori whitelist (dominio nuovo?) |
| 403 `ruolo_non_ammesso` | Ruolo diverso dai tre ammessi, oppure cambiato dopo il collegamento |
| 403 `senza_account_auth` | La riga in `utenti` non ha `auth_user_id`: la persona non ha proprio un accesso al CRM |
| 401 dopo un po' di inattivita' | Refresh token scaduto (30 giorni) o revocato: basta ricollegare |

I log applicativi usano i prefissi `[mcp-oauth]` (autenticazione) e `[mcp]`
(protocollo e tool).
