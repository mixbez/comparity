FROM node:20-alpine AS base
WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY src ./src
COPY migrations ./migrations

# Run migrations then start
CMD ["sh", "-c", "node src/db/migrate.js && node src/index.js"]
