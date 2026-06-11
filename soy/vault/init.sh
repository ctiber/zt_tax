#!/bin/sh
# vault/init.sh – Bootstrap Vault for the SoY SR primitive.
# Runs once as vault-init container (profile: sr).
#
# Stores: JWT secret, cookie secret, DB password
# Creates: AppRole auth, per-service policies, renewal lease (30s rotation demo)

set -e

VAULT_ADDR="${VAULT_ADDR:-http://vault:8200}"
export VAULT_ADDR

echo "[vault-init] Waiting for Vault at $VAULT_ADDR..."
until vault status -format=json 2>/dev/null | grep -q '"sealed": false'; do
  sleep 1
done
echo "[vault-init] Vault is ready."

# ─── Enable KV v2 secrets engine ─────────────────────────
vault secrets enable -path=secret kv-v2 2>/dev/null || echo "[vault-init] kv-v2 already enabled"

# ─── Write application secrets ───────────────────────────
echo "[vault-init] Writing secrets to secret/soy ..."
vault kv put secret/soy \
  jwt_secret="${SECRET_JWT:-your_custom_jwt_secret}" \
  cookie_secret="${COOKIE_SECRET:-your_custom_cookie_secret}" \
  db_password="${POSTGRES_PASSWORD:-anonymous}" \
  db_user="${POSTGRES_USER:-plagedba}"

# ─── Policies ─────────────────────────────────────────────
echo "[vault-init] Applying policies..."

vault policy write soy-gateway - <<'EOF'
path "secret/data/soy" {
  capabilities = ["read"]
}
path "secret/metadata/soy" {
  capabilities = ["read"]
}
EOF

vault policy write soy-microservice - <<'EOF'
path "secret/data/soy" {
  capabilities = ["read"]
}
path "secret/metadata/soy" {
  capabilities = ["read"]
}
EOF

# ─── AppRole auth for automated secret fetching ──────────
vault auth enable approle 2>/dev/null || echo "[vault-init] approle already enabled"

# Gateway role (short TTL – represents frequent rotation)
vault write auth/approle/role/gateway \
  policies="soy-gateway" \
  token_ttl="5m" \
  token_max_ttl="1h" \
  secret_id_ttl="0"

# Microservice role
vault write auth/approle/role/microservice \
  policies="soy-microservice" \
  token_ttl="5m" \
  token_max_ttl="1h" \
  secret_id_ttl="0"

# Retrieve and print role IDs for reference
GATEWAY_ROLE_ID=$(vault read -field=role_id auth/approle/role/gateway/role-id)
MS_ROLE_ID=$(vault read -field=role_id auth/approle/role/microservice/role-id)

GATEWAY_SECRET_ID=$(vault write -force -field=secret_id auth/approle/role/gateway/secret-id)
MS_SECRET_ID=$(vault write -force -field=secret_id auth/approle/role/microservice/secret-id)

echo "[vault-init] ─────────────────────────────────────────"
echo "[vault-init] AppRole credentials (for service startup):"
echo "  gateway   role_id=${GATEWAY_ROLE_ID}  secret_id=${GATEWAY_SECRET_ID}"
echo "  services  role_id=${MS_ROLE_ID}       secret_id=${MS_SECRET_ID}"
echo "[vault-init] ─────────────────────────────────────────"
echo "[vault-init] Done."
