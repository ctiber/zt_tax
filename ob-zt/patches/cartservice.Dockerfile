FROM mcr.microsoft.com/dotnet/sdk:8.0.303-noble AS builder
WORKDIR /app
COPY cartservice.csproj .
RUN dotnet restore cartservice.csproj -r linux-x64
COPY . .
RUN dotnet publish cartservice.csproj \
    -p:PublishSingleFile=true \
    -r linux-x64 \
    --self-contained true \
    -p:PublishTrimmed=true \
    -p:TrimMode=full \
    -c release \
    -o /cartservice

FROM mcr.microsoft.com/dotnet/runtime-deps:8.0.7-noble-chiseled
WORKDIR /app
COPY --from=builder /cartservice .
EXPOSE 7070
ENV DOTNET_EnableDiagnostics=0 \
    ASPNETCORE_HTTP_PORTS=7070
USER 1000
ENTRYPOINT ["/app/cartservice"]
