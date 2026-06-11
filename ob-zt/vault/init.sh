#!/bin/sh
# Vault initialisation for ZT SR (Secret Rotation) primitive.
# Runs inside the vault-init container on startup.
set -e
sleep 3  # wait for Vault to be ready

echo "[vault-init] enabling KV secrets engine..."
vault secrets enable -path=secret kv 2>/dev/null || true

echo "[vault-init] writing JWT_SECRET..."
vault kv put secret/ob-zt/config \
  jwt_secret="${JWT_SECRET:-dev-secret-change-me-zt-tax-expr}"

echo "[vault-init] creating policy..."
vault policy write ob-zt-reader - <<EOF
path "secret/ob-zt/config" {
  capabilities = ["read"]
}
EOF

echo "[vault-init] enabling AppRole auth..."
vault auth enable approle 2>/dev/null || true

echo "[vault-init] creating AppRole..."
vault write auth/approle/role/ob-zt-agent \
  token_policies="ob-zt-reader" \
  token_ttl=1h \
  token_max_ttl=4h

ROLE_ID=$(vault read -field=role_id auth/approle/role/ob-zt-agent/role-id)
SECRET_ID=$(vault write -f -field=secret_id auth/approle/role/ob-zt-agent/secret-id)

echo "[vault-init] writing agent credentials..."
echo "$ROLE_ID"  > /vault/role_id
echo "$SECRET_ID" > /vault/secret_id

echo "[vault-init] done."
