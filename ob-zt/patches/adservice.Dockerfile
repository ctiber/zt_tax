FROM eclipse-temurin:21 AS builder
WORKDIR /app
COPY ["build.gradle", "gradlew", "./"]
COPY gradle gradle
RUN chmod +x gradlew
RUN ./gradlew downloadRepos
COPY . .
RUN chmod +x gradlew
RUN ./gradlew installDist

FROM eclipse-temurin:21.0.3_9-jre-alpine
WORKDIR /app
COPY --from=builder /app .
ENTRYPOINT ["/app/build/install/hipstershop/bin/AdService"]
