#!/usr/bin/env bash
set -euo pipefail

# Eseguire SUL server Nextcloud come root o utente con accesso a occ:
#   NC_OCC="sudo -u www-data php /var/www/nextcloud/occ" \
#   SUPABASE_DISCOVERY_URI="https://PROJECT.supabase.co/auth/v1/.well-known/openid-configuration" \
#   SUPABASE_OAUTH_CLIENT_ID="..." SUPABASE_OAUTH_CLIENT_SECRET="..." \
#   bash scripts/configure-nextcloud-oidc.sh

: "${NC_OCC:?Impostare NC_OCC (comando completo per eseguire occ)}"

read -r -a OCC <<< "$NC_OCC"

"${OCC[@]}" app:install user_oidc
"${OCC[@]}" app:enable user_oidc

if [[ "${INSTALL_ONLY:-0}" == "1" ]]; then
  echo "user_oidc installato. Aprire le impostazioni OpenID Connect per copiare il callback URL."
  exit 0
fi

: "${SUPABASE_DISCOVERY_URI:?Impostare SUPABASE_DISCOVERY_URI}"
: "${SUPABASE_OAUTH_CLIENT_ID:?Impostare SUPABASE_OAUTH_CLIENT_ID}"
: "${SUPABASE_OAUTH_CLIENT_SECRET:?Impostare SUPABASE_OAUTH_CLIENT_SECRET}"
"${OCC[@]}" user_oidc:provider solair-crm \
  --clientid="$SUPABASE_OAUTH_CLIENT_ID" \
  --clientsecret="$SUPABASE_OAUTH_CLIENT_SECRET" \
  --discoveryuri="$SUPABASE_DISCOVERY_URI"

# Conserva il backend locale per recovery amministrativo tramite /login?direct=1.
"${OCC[@]}" config:app:set --type=string --value=1 user_oidc allow_multiple_user_backends

"${OCC[@]}" user_oidc:provider solair-crm

echo "Configurazione base completata. In Impostazioni amministratore > OpenID Connect impostare:"
echo "- scope: openid email profile"
echo "- User ID mapping: email"
echo "- Email mapping: email"
echo "- Display name mapping: email (oppure name se aggiunto al token)"
echo "- Soft auto provisioning: attivo"
