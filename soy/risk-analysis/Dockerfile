FROM node:18-slim

RUN groupadd -r soy && useradd -r -g soy soy

ENV NPM_CONFIG_CACHE=/tmp/.npm

WORKDIR /usr/src/app
COPY package.json ./
RUN npm install --production
COPY . .

USER soy
EXPOSE 9000
CMD ["node", "index.js"]
