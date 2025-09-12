FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./

RUN npm ci

RUN apt-get update && apt-get install -y --no-install-recommends sqlite3 \
  && rm -rf /var/lib/apt/lists/*

COPY . .


ENV NODE_ENV=development
EXPOSE 3000

CMD ["npm", "run", "dev"]