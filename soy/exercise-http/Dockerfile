
FROM node:18

WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y --no-install-recommends python3-pip \
    && pip3 install --break-system-packages psycopg2-binary \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /tmp/storage-fs && chmod -R 777 /tmp/storage-fs

COPY package.json package.json
COPY package-lock.json package-lock.json

RUN npm install

COPY . .

USER node

EXPOSE 5001

# Command to run the app when the container starts
CMD [ "node", "index.js" ]
