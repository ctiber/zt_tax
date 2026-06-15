# pull the official base image
FROM node:13.12.0-alpine

# set working direction
WORKDIR /app

# add `/app/node_modules/.bin` to $PATH
ENV PATH /app/node_modules/.bin:$PATH

# install application dependencies
COPY package.json ./
COPY package-lock.json ./

RUN npm i --production

RUN npm install -g serve@11.3.2 --save

# add app
COPY . ./

COPY tsconfig.prod.json ./tsconfig.json

EXPOSE 8000

# start app
CMD ["npm", "run", "build-prod"]