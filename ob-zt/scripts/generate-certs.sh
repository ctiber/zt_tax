#!/usr/bin/env bash
# Generates a self-signed CA and per-service TLS certificates for mTLS.
set -euo pipefail
cd "$(dirname "$0")/.."

CERTS_DIR="certs"
DAYS=825

mkdir -p "$CERTS_DIR"
cd "$CERTS_DIR"

echo ">>> Generating CA..."
openssl genrsa -out ca.key 4096
openssl req -new -x509 -key ca.key -sha256 -days "$DAYS" -out ca.crt \
  -subj "/CN=ob-zt-ca/O=ZT-Research"

issue_cert() {
  local name="$1"
  echo "    issuing cert for $name..."
  openssl genrsa -out "${name}.key" 2048
  openssl req -new -key "${name}.key" -out "${name}.csr" \
    -subj "/CN=${name}/O=ZT-Research"
  openssl x509 -req -in "${name}.csr" -CA ca.crt -CAkey ca.key \
    -CAcreateserial -out "${name}.crt" -days "$DAYS" -sha256 \
    -extfile <(printf "subjectAltName=DNS:%s,DNS:localhost\n" "$name")
  rm -f "${name}.csr"
}

for svc in frontend zt-gateway checkoutservice cartservice productcatalogservice \
           shippingservice paymentservice currencyservice emailservice \
           recommendationservice adservice; do
  issue_cert "$svc"
done

echo ">>> Certificates written to certs/"
