FROM node:18-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-pip python3-psycopg2 \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -r appuser && useradd -r -g appuser appuser

ENV NPM_CONFIG_CACHE=/tmp/.npm
WORKDIR /usr/src/app
RUN mkdir -p /tmp/storage-fs && chmod -R 777 /tmp/storage-fs
RUN chown -R appuser:appuser /usr/src/app

USER appuser

COPY --chown=appuser:appuser package.json package-lock.json* ./
RUN npm install --production

COPY --chown=appuser:appuser . .

EXPOSE 8080
CMD ["node", "index.js"]
