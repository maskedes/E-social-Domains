FROM node:18-alpine

# Install docker-cli to allow the API to run 'docker exec'
RUN apk add --no-cache docker-cli

WORKDIR /app

COPY package.json .
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
