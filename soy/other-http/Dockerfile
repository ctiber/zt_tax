FROM node:14 as build 

# Create a system group named "user" with the -r flag
RUN groupadd -r user \ 
&& useradd -r -g user user


ENV NPM_CONFIG_CACHE=/tmp/.npm
# Set the working directory

RUN mkdir -p /usr/src/app

WORKDIR /usr/src/app

# Change ownership of the working directory to the user
RUN chown -R user:user /usr/src/app

# Switch to the non-root user "user"
USER user

# Copy package.json and package-lock.json
COPY package.json package.json
COPY package-lock.json package-lock.json

# Install dependencies
RUN npm install --production

# Copy the rest of the application files
COPY . .

# Expose port 5001
EXPOSE 5001

# Command to run the app when the container starts
CMD [ "node", "index.js" ]
