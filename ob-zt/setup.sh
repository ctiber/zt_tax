#!/usr/bin/env bash
# Clones OB, patches service sources with ZT ac4a wiring, and generates certs.
# Run once before first experiment: bash setup.sh
set -euo pipefail
cd "$(dirname "$0")"

OB_TAG="${1:-v0.10.1}"
OB_DIR="online-boutique"

echo ">>> Cloning Online Boutique $OB_TAG..."
if [ -d "$OB_DIR/.git" ]; then
  echo "    Already cloned. Skipping."
else
  git clone --depth 1 --branch "$OB_TAG" \
    https://github.com/GoogleCloudPlatform/microservices-demo.git "$OB_DIR"
fi

echo ">>> Copying ac4a middleware into service source trees..."
for svc in frontend checkoutservice productcatalogservice shippingservice; do
  dest="$OB_DIR/src/$svc/ac4a"
  mkdir -p "$dest"
  cp ac4a/go/ac4a.go          "$dest/"
  cp ac4a/go/ac4a_http.go     "$dest/"
  cp ac4a/go/ac4a_propagate.go "$dest/"
done
for svc in emailservice recommendationservice; do
  cp ac4a/python/ac4a.py "$OB_DIR/src/$svc/"
done
for svc in currencyservice paymentservice; do
  cp ac4a/nodejs/ac4a.js "$OB_DIR/src/$svc/"
done
cp ac4a/java/Ac4aInterceptor.java \
  "$OB_DIR/src/adservice/src/main/java/hipstershop/"
cp ac4a/csharp/Ac4aInterceptor.cs \
  "$OB_DIR/src/cartservice/src/"

echo ">>> Applying Dockerfiles..."
for svc in frontend checkoutservice productcatalogservice shippingservice \
           emailservice recommendationservice \
           currencyservice paymentservice adservice; do
  patch="patches/${svc}.Dockerfile"
  [ -f "$patch" ] && cp "$patch" "$OB_DIR/src/$svc/Dockerfile"
done
# cartservice Dockerfile lives in src/
[ -f patches/cartservice.Dockerfile ] && \
  cp patches/cartservice.Dockerfile "$OB_DIR/src/cartservice/src/Dockerfile"

echo ">>> Patching service sources (Python, Node.js, Java, C#, Go)..."
python3 - <<'PYEOF'
import os, re

OB = "online-boutique"

def patch(path, *subs):
    with open(path) as f: c = f.read()
    for old, new in subs:
        if old not in c:
            print(f"  WARN: pattern not found in {path}: {repr(old)[:60]}")
            continue
        c = c.replace(old, new, 1)
    with open(path, "w") as f: f.write(c)
    print(f"  patched {path}")

# ── Python ─────────────────────────────────────────────────────────────────
email = f"{OB}/src/emailservice/email_server.py"
patch(email,
    ("import grpc\n",
     "import grpc\nfrom ac4a import Ac4aInterceptor\n"),
    ("server = grpc.server(futures.ThreadPoolExecutor(max_workers=10),)",
     "server = grpc.server(futures.ThreadPoolExecutor(max_workers=10), interceptors=[Ac4aInterceptor()])"),
)

rec = f"{OB}/src/recommendationservice/recommendation_server.py"
patch(rec,
    ("import grpc\n",
     "import grpc\nfrom ac4a import Ac4aInterceptor\n"),
    ("server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))",
     "server = grpc.server(futures.ThreadPoolExecutor(max_workers=10), interceptors=[Ac4aInterceptor()])"),
)

# Add PyJWT to requirements.txt (idempotent)
for svc in ("emailservice", "recommendationservice"):
    req = f"{OB}/src/{svc}/requirements.txt"
    with open(req) as f: txt = f.read()
    if "PyJWT" not in txt:
        with open(req, "a") as f: f.write("\nPyJWT==2.9.0\n")
        print(f"  added PyJWT to {req}")

# ── Node.js ─────────────────────────────────────────────────────────────────
currency = f"{OB}/src/currencyservice/server.js"
patch(currency,
    ("const grpc = require('@grpc/grpc-js');",
     "const grpc = require('@grpc/grpc-js');\nconst { wrapService } = require('./ac4a');"),
    ("server.addService(shopProto.CurrencyService.service, {getSupportedCurrencies, convert});",
     "server.addService(shopProto.CurrencyService.service, wrapService({getSupportedCurrencies, convert}));"),
)

payment = f"{OB}/src/paymentservice/server.js"
patch(payment,
    ("const grpc = require('@grpc/grpc-js');",
     "const grpc = require('@grpc/grpc-js');\nconst { wrapService } = require('./ac4a');"),
    # Wrap the PaymentService handler object
    ("    this.server.addService(\n      hipsterShopPackage.PaymentService.service,\n      {\n        charge: HipsterShopServer.ChargeServiceHandler.bind(this)\n      }\n    );",
     "    this.server.addService(\n      hipsterShopPackage.PaymentService.service,\n      wrapService({ charge: HipsterShopServer.ChargeServiceHandler.bind(this) })\n    );"),
)

# Add jsonwebtoken to package.json (idempotent)
import json
for svc in ("currencyservice", "paymentservice"):
    pkgjson = f"{OB}/src/{svc}/package.json"
    with open(pkgjson) as f: pkg = json.load(f)
    if "jsonwebtoken" not in pkg.get("dependencies", {}):
        pkg.setdefault("dependencies", {})["jsonwebtoken"] = "9.0.2"
        with open(pkgjson, "w") as f: json.dump(pkg, f, indent=2)
        print(f"  added jsonwebtoken to {pkgjson}")

# ── Java ─────────────────────────────────────────────────────────────────────
adsvc = f"{OB}/src/adservice/src/main/java/hipstershop/AdService.java"
patch(adsvc,
    ("import hipstershop.Demo.Ad;\n",
     "import hipstershop.Ac4aInterceptor;\nimport hipstershop.Demo.Ad;\n"),
    ("            .addService(healthMgr.getHealthService())\n            .build()\n            .start();",
     "            .addService(healthMgr.getHealthService())\n            .intercept(new Ac4aInterceptor())\n            .build()\n            .start();"),
)

# Add jjwt to build.gradle (idempotent)
gradle = f"{OB}/src/adservice/build.gradle"
with open(gradle) as f: g = f.read()
if "jjwt" not in g:
    g = g.replace(
        '"com.google.protobuf:protobuf-java:${protocVersion}"\n\n        runtimeOnly',
        '"com.google.protobuf:protobuf-java:${protocVersion}"\n\n        implementation "io.jsonwebtoken:jjwt:0.9.1"\n\n        runtimeOnly'
    )
    with open(gradle, "w") as f: f.write(g)
    print(f"  added jjwt to {gradle}")

# ── C# ──────────────────────────────────────────────────────────────────────
startup = f"{OB}/src/cartservice/src/Startup.cs"
patch(startup,
    ("            services.AddGrpc();",
     "            services.AddGrpc(opts => opts.Interceptors.Add<cartservice.infrastructure.Ac4aInterceptor>());"),
)

csproj = f"{OB}/src/cartservice/src/cartservice.csproj"
with open(csproj) as f: cs = f.read()
if "IdentityModel" not in cs:
    cs = cs.replace(
        '    <PackageReference Include="Grpc.AspNetCore"',
        '    <PackageReference Include="System.IdentityModel.Tokens.Jwt" Version="7.7.1" />\n    <PackageReference Include="Grpc.AspNetCore"'
    )
    with open(csproj, "w") as f: f.write(cs)
    print(f"  added JWT package to {csproj}")

# ── Go: frontend ──────────────────────────────────────────────────────────
fe = f"{OB}/src/frontend/main.go"
patch(fe,
    # Add ac4a import after otelhttp import
    ('\t"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"\n',
     '\t"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"\n\t"github.com/GoogleCloudPlatform/microservices-demo/src/frontend/ac4a"\n'),
    # Insert HTTPMiddleware after OTel handler line
    ('\thandler = otelhttp.NewHandler(handler, "frontend") // add OTel tracing\n',
     '\thandler = otelhttp.NewHandler(handler, "frontend") // add OTel tracing\n\thandler = ac4a.HTTPMiddleware(handler)\n'),
    # Propagate gRPC client interceptors
    ('\t\tgrpc.WithUnaryInterceptor(otelgrpc.UnaryClientInterceptor()),\n\t\tgrpc.WithStreamInterceptor(otelgrpc.StreamClientInterceptor()))',
     '\t\tgrpc.WithChainUnaryInterceptor(otelgrpc.UnaryClientInterceptor(), ac4a.PropagateUnaryInterceptor),\n\t\tgrpc.WithChainStreamInterceptor(otelgrpc.StreamClientInterceptor(), ac4a.PropagateStreamInterceptor))'),
)

# ── Go: checkoutservice ───────────────────────────────────────────────────
co = f"{OB}/src/checkoutservice/main.go"
patch(co,
    ('"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"\n',
     '"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"\n\t"github.com/GoogleCloudPlatform/microservices-demo/src/checkoutservice/ac4a"\n'),
    ('\t\tgrpc.UnaryInterceptor(otelgrpc.UnaryServerInterceptor()),\n\t\tgrpc.StreamInterceptor(otelgrpc.StreamServerInterceptor()),',
     '\t\tgrpc.ChainUnaryInterceptor(otelgrpc.UnaryServerInterceptor(), ac4a.UnaryInterceptor),\n\t\tgrpc.ChainStreamInterceptor(otelgrpc.StreamServerInterceptor(), ac4a.StreamInterceptor),'),
)

# ── Go: productcatalogservice ─────────────────────────────────────────────
pc = f"{OB}/src/productcatalogservice/server.go"
patch(pc,
    ('"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"\n',
     '"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"\n\t"github.com/GoogleCloudPlatform/microservices-demo/src/productcatalogservice/ac4a"\n'),
    ('\t\tgrpc.UnaryInterceptor(otelgrpc.UnaryServerInterceptor()),\n\t\tgrpc.StreamInterceptor(otelgrpc.StreamServerInterceptor()))',
     '\t\tgrpc.ChainUnaryInterceptor(otelgrpc.UnaryServerInterceptor(), ac4a.UnaryInterceptor),\n\t\tgrpc.ChainStreamInterceptor(otelgrpc.StreamServerInterceptor(), ac4a.StreamInterceptor))'),
)

# ── Go: shippingservice ───────────────────────────────────────────────────
sh = f"{OB}/src/shippingservice/main.go"
patch(sh,
    ('pb "github.com/GoogleCloudPlatform/microservices-demo/src/shippingservice/genproto"\n',
     'pb "github.com/GoogleCloudPlatform/microservices-demo/src/shippingservice/genproto"\n\t"github.com/GoogleCloudPlatform/microservices-demo/src/shippingservice/ac4a"\n'),
    # Both branches have bare grpc.NewServer()
    ('\t\tsrv = grpc.NewServer()\n\t} else {\n\t\tlog.Info("Stats disabled.")\n\t\tsrv = grpc.NewServer()',
     '\t\tsrv = grpc.NewServer(grpc.ChainUnaryInterceptor(ac4a.UnaryInterceptor), grpc.ChainStreamInterceptor(ac4a.StreamInterceptor))\n\t} else {\n\t\tlog.Info("Stats disabled.")\n\t\tsrv = grpc.NewServer(grpc.ChainUnaryInterceptor(ac4a.UnaryInterceptor), grpc.ChainStreamInterceptor(ac4a.StreamInterceptor))'),
)
PYEOF

echo ">>> Generating TLS certificates..."
if [ ! -f certs/ca.crt ]; then
  bash scripts/generate-certs.sh
else
  echo "    Certificates already present."
fi

echo ">>> Done. Start a variant with:"
echo "    bash scripts/run-variant.sh 1 http"
