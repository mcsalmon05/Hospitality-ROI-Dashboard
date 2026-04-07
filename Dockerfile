FROM node:18-slim

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install --production

# Bundle app source
COPY . .

# Expose port (Cloud Run uses 8080 by default)
EXPOSE 8080

# Run the server
CMD [ "node", "server.js" ]
