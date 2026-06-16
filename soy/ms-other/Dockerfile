FROM node:18-slim

RUN groupadd -r appuser && useradd -r -g appuser appuser

ENV NPM_CONFIG_CACHE=/tmp/.npm
WORKDIR /usr/src/app
RUN chown -R appuser:appuser /usr/src/app

USER appuser

COPY --chown=appuser:appuser package.json package-lock.json* ./
RUN npm install --production

COPY --chown=appuser:appuser . .

EXPOSE 8080
CMD ["node", "index.js"]
