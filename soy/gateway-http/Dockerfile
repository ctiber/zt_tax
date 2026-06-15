FROM node:18-slim as build

RUN groupadd -r user && useradd -r -g user user

ENV NPM_CONFIG_CACHE=/tmp/.npm

RUN mkdir -p /usr/src/app


WORKDIR /usr/src/app


COPY package.json package-lock.json /usr/src/app/


RUN npm install


COPY . /usr/src/app/

EXPOSE 8080


USER user

CMD ["npm", "start"]
