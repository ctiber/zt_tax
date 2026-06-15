FROM maven:3.9.6-eclipse-temurin-17 AS runner

WORKDIR /load-tests

# Cache dependencies first
COPY pom.xml .
RUN mvn dependency:go-offline -q

# Copy simulation sources and resources
COPY src/ ./src/

# Results will be written here (mount with -v to retrieve them)
VOLUME ["/load-tests/target/gatling-results"]

# Default: run with baseline parameters
# Override with -e flags or --build-arg:
#   docker run --rm -e baseUrl=http://gateway:5001 -e targetRps=10 soy-load-tests
ENV baseUrl="http://host.docker.internal:5001" \
    rampUp="60"   \
    sustained="300" \
    rampDown="60"   \
    targetRps="5.0" \
    sessionId="1"   \
    exerciseId="1"

CMD mvn gatling:test \
      -Dsoy.baseUrl="${baseUrl}"        \
      -Dsoy.rampUp="${rampUp}"          \
      -Dsoy.sustained="${sustained}"    \
      -Dsoy.rampDown="${rampDown}"      \
      -Dsoy.targetRps="${targetRps}"    \
      -Dsoy.sessionId="${sessionId}"    \
      -Dsoy.exerciseId="${exerciseId}"  \
      -q
