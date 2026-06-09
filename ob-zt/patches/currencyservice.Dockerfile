FROM node:20.15.1-alpine AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --only=production --ignore-scripts && \
    npm install jsonwebtoken --save-prod --no-package-lock --ignore-scripts

FROM node:20-alpine
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY . .
ENTRYPOINT [ "node", "server.js" ]
