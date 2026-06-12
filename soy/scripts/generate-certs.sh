#!/usr/bin/env sh
# generate-certs.sh – Self-signed CA + per-service certs for mTLS and broker TLS.
# Idempotent: exits immediately if ca.crt already exists.
# Runs on the host via `./scripts/generate-certs.sh`
# or inside Docker cert-init container (mounts ./certs as /certs).

set -e

# Resolve output directory: Docker cert-init mounts /certs; on host use repo certs/
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CERTS_DIR="${CERTS_DIR:-${SCRIPT_DIR}/../certs}"
[ -d /certs ] && CERTS_DIR=/certs

DAYS=3650
SAN_FILE="${CERTS_DIR}/san.ext"

mkdir -p "$CERTS_DIR"

if [ -f "$CERTS_DIR/ca.crt" ]; then
  echo "[certs] Certificates already exist at $CERTS_DIR – skipping."
  # Still generate broker certs if missing (added later)
  BROKER_ONLY=true
else
  BROKER_ONLY=false
fi

if [ "$BROKER_ONLY" = "false" ]; then
  echo "[certs] Generating certificates in $CERTS_DIR ..."

  # ── Certificate Authority ────────────────────────────────
  openssl genrsa -out "$CERTS_DIR/ca.key" 4096 2>/dev/null
  openssl req -new -x509 -days $DAYS \
    -key  "$CERTS_DIR/ca.key" \
    -subj "/C=FR/ST=Occitanie/O=SoY-Research/CN=SoY-CA" \
    -out  "$CERTS_DIR/ca.crt"
  echo "[certs] ✓ CA"
fi

# ── Helper: generate a key + CSR + CA-signed cert ────────
gen_cert() {
  SERVICE="$1"
  CN="${2:-$SERVICE}"

  if [ -f "$CERTS_DIR/${SERVICE}.crt" ]; then
    echo "[certs] ✓ ${SERVICE} (already exists)"
    return
  fi

  # Write SAN extension to a temp file (portable; no process substitution)
  printf '[req]\ndistinguished_name=dn\n[dn]\n[SAN]\nsubjectAltName=DNS:%s,DNS:localhost\n' \
    "$CN" > "$SAN_FILE"

  openssl genrsa -out "$CERTS_DIR/${SERVICE}.key" 2048 2>/dev/null

  openssl req -new \
    -key  "$CERTS_DIR/${SERVICE}.key" \
    -subj "/C=FR/ST=Occitanie/O=SoY-Research/CN=${CN}" \
    -out  "$CERTS_DIR/${SERVICE}.csr"

  openssl x509 -req \
    -days "$DAYS" \
    -in   "$CERTS_DIR/${SERVICE}.csr" \
    -CA   "$CERTS_DIR/ca.crt" \
    -CAkey "$CERTS_DIR/ca.key" \
    -CAcreateserial \
    -extensions SAN \
    -extfile "$SAN_FILE" \
    -out  "$CERTS_DIR/${SERVICE}.crt" 2>/dev/null

  rm -f "$CERTS_DIR/${SERVICE}.csr"
  echo "[certs] ✓ ${SERVICE}"
}

if [ "$BROKER_ONLY" = "false" ]; then
  gen_cert gateway
  gen_cert ms-exercise
  gen_cert ms-other
  gen_cert nginx-exercise
  gen_cert nginx-other
fi

# ── Broker TLS certificates (RabbitMQ + Kafka) ──────────
# Generated even on subsequent runs if the files are missing.
gen_cert rabbitmq rabbitmq
gen_cert kafka    kafka

# ── Kafka JKS keystore (for Confluent cp-kafka SSL) ─────
KEYSTORE="$CERTS_DIR/kafka.server.keystore.jks"
TRUSTSTORE="$CERTS_DIR/kafka.server.truststore.jks"
STOREPASS="soy-broker-tls"

if [ ! -f "$KEYSTORE" ]; then
  KEYTOOL="${KEYTOOL:-$(which keytool 2>/dev/null || echo /usr/lib/jvm/java-1.21.0-openjdk-amd64/bin/keytool)}"

  if [ -x "$KEYTOOL" ]; then
    # Convert PEM → PKCS12 → JKS
    openssl pkcs12 -export \
      -in   "$CERTS_DIR/kafka.crt" \
      -inkey "$CERTS_DIR/kafka.key" \
      -out  "$CERTS_DIR/kafka.p12" \
      -name kafka \
      -CAfile "$CERTS_DIR/ca.crt" \
      -passout pass:"$STOREPASS" 2>/dev/null

    "$KEYTOOL" -importkeystore \
      -srckeystore "$CERTS_DIR/kafka.p12" \
      -srcstoretype PKCS12 \
      -srcstorepass "$STOREPASS" \
      -destkeystore "$KEYSTORE" \
      -deststoretype JKS \
      -deststorepass "$STOREPASS" \
      -noprompt 2>/dev/null

    "$KEYTOOL" -keystore "$TRUSTSTORE" \
      -alias CARoot \
      -import \
      -file "$CERTS_DIR/ca.crt" \
      -storepass "$STOREPASS" \
      -noprompt 2>/dev/null

    rm -f "$CERTS_DIR/kafka.p12"
    echo "[certs] ✓ kafka JKS keystore + truststore"
  else
    echo "[certs] ⚠  keytool not found – Kafka JKS keystores skipped (broker TLS won't work for topic pattern)"
  fi
else
  echo "[certs] ✓ kafka JKS (already exists)"
fi

rm -f "$SAN_FILE" "$CERTS_DIR/ca.srl"

# Make keys readable by container users (containers run as non-root uid)
chmod 644 "$CERTS_DIR"/*.key 2>/dev/null || true

echo "[certs] Done. Files in $CERTS_DIR:"
ls "$CERTS_DIR/"
