# syntax=docker/dockerfile:1
# Build context is the repository root; Git and Python stay in this build stage.
FROM eclipse-temurin:21-jdk AS build
RUN apt-get update && apt-get install -y --no-install-recommends git python3 ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace/apps/api
COPY apps/api/gradlew apps/api/settings.gradle apps/api/build.gradle ./
COPY apps/api/gradle gradle
RUN chmod +x gradlew && ./gradlew --no-daemon dependencies > /dev/null
COPY release-version.json /workspace/release-version.json
COPY scripts/release/version.py /workspace/scripts/release/version.py
ARG RENDER
ARG RENDER_GIT_COMMIT
ARG RENDER_GIT_BRANCH=main
RUN python3 /workspace/scripts/release/version.py --format properties --output /workspace/version.properties
COPY apps/api/src src
RUN ./gradlew --no-daemon bootJar -x test -PreleaseMetadataFile=/workspace/version.properties

# Render 512MiB: heap 50%, remaining memory for metaspace, code cache and native work.
FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd --system --uid 10001 --home-dir /app app
COPY --from=build /workspace/apps/api/build/libs/*.jar /app/app.jar
USER app
ENV SPRING_PROFILES_ACTIVE=prod \
    MALLOC_ARENA_MAX=2 \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=50 -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -Xss512k"
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
