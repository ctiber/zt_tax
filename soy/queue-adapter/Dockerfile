FROM node:18-slim

RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app
RUN chown -R appuser:appuser /app

ENV NPM_CONFIG_CACHE=/tmp/.npm

USER appuser

COPY --chown=appuser:appuser package.json ./
RUN npm install --production

COPY --chown=appuser:appuser . .

CMD ["node", "index.js"]
