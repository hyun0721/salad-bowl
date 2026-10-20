# syntax=docker/dockerfile:1
# Render 무료 인스턴스(512MB, CPU 0.1)용. 빌드는 JDK, 실행은 JRE 이미지에서 한다.
FROM eclipse-temurin:21-jdk AS build
WORKDIR /workspace
COPY gradlew settings.gradle build.gradle ./
COPY gradle gradle
RUN chmod +x gradlew && ./gradlew --no-daemon dependencies > /dev/null
COPY src src
RUN ./gradlew --no-daemon bootJar -x test

# 메모리 예산(컨테이너 512MiB): heap은 MaxRAMPercentage=50으로 약 256MiB, 나머지는 metaspace·code cache·
# 스레드 스택·네이티브용이다. import는 서비스에서 한 번에 하나만 처리해 파싱 메모리가 겹치지 않게 한다.
# MALLOC_ARENA_MAX=2는 glibc 아레나 수를 줄여 네이티브 메모리 조각화를 막는다.
FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd --system --uid 10001 --home-dir /app app
COPY --from=build /workspace/build/libs/*.jar /app/app.jar
USER app
ENV SPRING_PROFILES_ACTIVE=prod \
    MALLOC_ARENA_MAX=2 \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=50 -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -Xss512k"
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
